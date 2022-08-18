import { createWorker, setLogging } from '@ffmpeg/ffmpeg';
import { AtracdencProcess } from './atracdenc-worker';
import { getPublicPathFor, getATRACWAVEncoding } from '../utils';
const AtracdencWorker = require('worker-loader!./atracdenc-worker'); // eslint-disable-line import/no-webpack-loader-syntax

interface LogPayload {
    message: string;
    action: string;
}

export interface AudioExportService {
    init(): Promise<void>;
    export(params: { format: string }): Promise<ArrayBuffer>;
    info(): Promise<{ format: string | null; input: string | null }>;
    prepare(file: File): Promise<void>;
}

export class FFMpegAudioExportService implements AudioExportService {
    public ffmpegProcess: any;
    public atracdencProcess?: AtracdencProcess;
    public loglines: { action: string; message: string }[] = [];
    public inFileName: string = ``;
    public outFileNameNoExt: string = ``;

    async init() {
        setLogging(true);
    }

    async prepare(file: File) {
        this.loglines = [];
        this.ffmpegProcess = createWorker({
            logger: (payload: LogPayload) => {
                this.loglines.push(payload);
                console.log(payload.action, payload.message);
            },
            corePath: getPublicPathFor('ffmpeg-core.js'),
            workerPath: getPublicPathFor('worker.min.js'),
        });
        await this.ffmpegProcess.load();

        this.atracdencProcess = new AtracdencProcess(new AtracdencWorker());
        await this.atracdencProcess.init();

        let ext = file.name.split('.').slice(-1);
        if (ext.length === 0) {
            throw new Error(`Unrecognized file format: ${file.name}`);
        }

        this.inFileName = `inAudioFile.${ext[0]}`;
        this.outFileNameNoExt = `outAudioFile`;

        await this.ffmpegProcess.write(this.inFileName, file);
    }

    async info() {
        await this.ffmpegProcess.transcode(this.inFileName, `${this.outFileNameNoExt}.metadata`, `-f ffmetadata`);

        let audioFormatRegex = /Audio:\s(.*?),/; // Actual content
        let inputFormatRegex = /Input #0,\s(.*?),/; // Container
        let format: string | null = null;
        let input: string | null = null;

        for (let line of this.loglines) {
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

    async export({ format }: { format: string }) {
        let result: ArrayBuffer;
        if (format === `SP`) {
            const outFileName = `${this.outFileNameNoExt}.raw`;
            await this.ffmpegProcess.transcode(this.inFileName, outFileName, '-ac 2 -ar 44100 -f s16be');
            let { data } = await this.ffmpegProcess.read(outFileName);
            result = data.buffer;
        } else {
            const outFileName = `${this.outFileNameNoExt}.wav`;
            await this.ffmpegProcess.transcode(this.inFileName, outFileName, '-f wav -ar 44100 -ac 2');
            let { data } = await this.ffmpegProcess.read(outFileName);
            let bitrate: string = `0`;
            switch (format) {
                case `LP2`:
                    bitrate = `132`;
                    break;
                case `LP105`:
                    bitrate = `102`;
                    break;
                case `LP4`:
                    bitrate = `66`;
                    break;
            }
            //result = await this.atracdencProcess!.encode(data.buffer, bitrate);
            const payload = new FormData();
            payload.append('file', new Blob([data.buffer]), `${this.outFileNameNoExt}.wav`)
            let response = await fetch(`http://localhost:5000/encode?type=${format}`, {
                method: 'POST',
                body: payload
            })
            const file = new File([await response.arrayBuffer()], 'test.at3')
            let encoding: null | { format: 'LP2' | 'LP4'; headerLength: number } = await getATRACWAVEncoding(file);
            result = (await file.arrayBuffer()).slice(encoding!.headerLength)
        }
        this.ffmpegProcess.worker.terminate();
        //this.atracdencProcess!.terminate();
        return result;
    }
}
