import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { CodecFamily } from '../interfaces/netmd';
import { getPublicPathFor } from '../../utils';

export interface LogPayload {
    message: string;
    action: string;
}

export type ExportParams = {
    format: { bitrate: number; codec: 'AT3' | 'A3+' | 'PCM' | 'MP3' };
    enableReplayGain?: boolean;
};

export interface AudioExportService {
    init(): Promise<void>;
    export(params: ExportParams, callback: (obj: { state: number, total: number }) => void): Promise<ArrayBuffer>;
    info(): Promise<{ format: string | null; input: string | null }>;
    prepare(file: File): Promise<void>;

    getSupport(codec: CodecFamily): 'perfect' | 'mediocre' | 'unsupported';
}

export abstract class DefaultFfmpegAudioExportService implements AudioExportService {
    public ffmpegProcess?: ReturnType<typeof createWorker>;
    public loglines: { action: string; message: string }[] = [];
    public inFileName: string = ``;
    public outFileNameNoExt: string = ``;

    async init() {
        setLogging(true);
    }

    async prepare(file: File) {
        this.loglines = [];
        await this.loadFfmpeg();

        const ext = file.name.split('.').slice(-1);
        if (ext.length === 0) {
            throw new Error(`Unrecognized file format: ${file.name}`);
        }

        this.inFileName = `inAudioFile.${ext[0]}`;
        this.outFileNameNoExt = `outAudioFile`;

        await this.ffmpegProcess.write(this.inFileName, file);
    }

    async loadFfmpeg() {
        this.ffmpegProcess = createWorker({
            logger: (payload: LogPayload) => {
                this.loglines.push(payload);
                console.log(payload.action, payload.message);
            },
            corePath: getPublicPathFor('ffmpeg-core.js'),
            workerPath: getPublicPathFor('worker.min.js'),
        });
        await this.ffmpegProcess.load();
    }

    async volumeDetect() {
        await this.ffmpegProcess.transcode(this.inFileName, 'null', `-af volumedetect -f null`);

        const maxVolumeRegex = /max_volume: ((-)?[\d]*\.[\d]*) dB/;
        let maxVolume;

        for (const line of this.loglines) {
            const match = line.message.match(maxVolumeRegex);
            if (match !== null) {
                maxVolume = parseFloat(match[1]);
            }
        }
        this.loglines = [];
        return maxVolume ?? 0;
    }

    async info() {
        await this.ffmpegProcess.transcode(this.inFileName, `${this.outFileNameNoExt}.metadata`, `-f ffmetadata`);

        const audioFormatRegex = /Audio:\s(.*?),/; // Actual content
        const inputFormatRegex = /Input #0,\s(.*?),/; // Container
        let format: string | null = null;
        let input: string | null = null;

        for (const line of this.loglines) {
            let match = line.message.match(audioFormatRegex);
            if (match !== null) {
                format = match[1];
                continue;
            }
            match = line.message.match(inputFormatRegex);
            if (match !== null) {
                input = match[1];
                continue;
            }
            if (format !== null && input !== null) {
                break;
            }
        }

        return { format, input };
    }

    async createFfmpegParams(parameters: ExportParams, outputFormat: string, moreParams?: string) {
        const { enableReplayGain } = parameters;
        let additionalCommands = '';
        const commonFormatting = `-ac 2 -ar 44100`;
        if (enableReplayGain) {
            additionalCommands += `-af volume=replaygain=track`;
        }
        return `${additionalCommands} ${commonFormatting} ${moreParams ?? ''} -f ${outputFormat}`;
    }

    async export(parameters: ExportParams, callback?: (obj: { state: number, total: number}) => void) {
        const { format } = parameters;
        let result: ArrayBuffer;
        if (format.codec === `PCM`) {
            result = await this.encodePCM(parameters);
        } else if (format.codec === 'AT3') {
            result = await this.encodeATRAC3(parameters, callback);
        } else if (format.codec === 'MP3') {
            result = await this.encodeMP3(parameters);
        } else if (format.codec === 'A3+') {
            result = await this.encodeATRAC3Plus(parameters, callback);
        } else throw new Error('Invalid format');
        this.ffmpegProcess?.worker.terminate();
        return result;
    }

    async encodePCM(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 's16be');
        const outFileName = `${this.outFileNameNoExt}.raw`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data.buffer;
    }

    async encodeMP3(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(
            parameters,
            'mp3',
            `-map 0:a:0 -c:a libmp3lame -b:a ${parameters.format.bitrate!}k`
        );
        const outFileName = `${this.outFileNameNoExt}.mp3`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data.buffer;
    }

    abstract encodeATRAC3(parameters: ExportParams, callback?: (obj: { state: number, total: number}) => void): Promise<ArrayBuffer>;
    abstract encodeATRAC3Plus(parameters: ExportParams, callback?: (obj: { state: number, total: number}) => void): Promise<ArrayBuffer>;
    abstract getSupport(codec: CodecFamily): 'perfect' | 'mediocre' | 'unsupported';
}
