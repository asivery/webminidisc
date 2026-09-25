import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { getPublicPathFor } from '../../../utils';
import { AudioEncoderV1ExportCodec, AudioEncoderV1ExportParams, AudioEncoderV1Instance } from '../apiv1/external-interface';

export interface LogPayload {
    message: string;
    action: string;
}

export class FfmpegAudioEncoder implements AudioEncoderV1Instance {
    public ffmpegProcess?: ReturnType<typeof createWorker>;
    public loglines: { action: string; message: string }[] = [];
    public inFileName: string = ``;
    public outFileNameNoExt: string = ``;

    async init() {
        setLogging(true);
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

    createFfmpegParams(parameters: AudioEncoderV1ExportParams, outputFormat: string, moreParams?: string): string {
        const { enableReplayGain } = parameters;
        let additionalCommands = '';
        const commonFormatting = `-ac 2 -ar 44100`;
        if (enableReplayGain) {
            additionalCommands += `-af volume=replaygain=track`;
        }
        return `${additionalCommands} ${commonFormatting} ${moreParams ?? ''} -f ${outputFormat}`;
    }

    async transcode(
        source: Uint8Array<ArrayBuffer>,
        fileName: string,
        exportParams: AudioEncoderV1ExportParams,
        transcodeCallback?: (obj: { stage: string; progress: number; total: number }) => void
    ): Promise<Uint8Array<ArrayBuffer>> {
        this.loglines = [];
        const dotIndex = fileName.lastIndexOf('.') + 1;
        const fileExtension = dotIndex > 0 ? fileName.substring(dotIndex) : 'unknown';

        this.inFileName = `inAudioFile.${fileExtension}`;
        this.outFileNameNoExt = `outAudioFile`;

        await this.ffmpegProcess.write(this.inFileName, source);

        const { format } = exportParams;
        let result: Uint8Array<ArrayBuffer>;
        transcodeCallback?.({ stage: 'encoding', progress: 0, total: 1 });
        switch (format.codec) {
            case 'PCM':
                result = await this.encodePCM(exportParams);
                break;
            case 'MP3':
                result = await this.encodeMP3(exportParams);
                break;
            default:
                throw new Error('Invalid format');
        }
        transcodeCallback?.({ stage: 'encoding', progress: 1, total: 1 });
        return result;
    }

    async deinit(): Promise<void> {
        this.ffmpegProcess?.worker.terminate();
    }

    async encodePCM(parameters: AudioEncoderV1ExportParams): Promise<Uint8Array<ArrayBuffer>> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 's16be');
        const outFileName = `${this.outFileNameNoExt}.raw`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data;
    }

    async encodeMP3(parameters: AudioEncoderV1ExportParams): Promise<Uint8Array<ArrayBuffer>> {
        const ffmpegCommand = await this.createFfmpegParams(
            parameters,
            'mp3',
            `-map 0:a:0 -c:a libmp3lame -b:a ${parameters.format.bitrate!}k`
        );
        const outFileName = `${this.outFileNameNoExt}.mp3`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = await this.ffmpegProcess.read(outFileName);
        return data;
    }

    getUserFriendyStageName(stage: string): string | null {
        return (
            (
                {
                    encoding: 'encoding',
                } as const
            )[stage] ?? null
        );
    }
    getSupportFor(codec: AudioEncoderV1ExportCodec): { state: 'perfect' | 'poor' | 'unsupported'; gapless: boolean; bitrates?: number[] } {
        return {
            gapless: true,
            state: (
                {
                    AT3: 'unsupported',
                    'A3+': 'unsupported',
                    MP3: 'perfect',
                    PCM: 'perfect',
                } as const
            )[codec],
        };
    }
}
