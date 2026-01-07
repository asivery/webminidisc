import { DefaultFfmpegAudioExportService, ExportParams } from './audio-export';
import { AtracdencProcess } from './atracdenc-worker';
import { CodecFamily } from '../interfaces/netmd';

export class AtracdencAudioExportService extends DefaultFfmpegAudioExportService {
    public atracdencProcess?: AtracdencProcess;

    async prepare(file: File): Promise<void> {
        await super.prepare(file);
        this.atracdencProcess = new AtracdencProcess(new Worker(new URL('./atracdenc-worker', import.meta.url), { type: 'classic' }));
        await this.atracdencProcess.init();
    }

    async encodeATRAC3Plus(parameters: ExportParams): Promise<ArrayBuffer> {
        throw new Error('Unsupported codec! Please select a different encoder');
    }

    async encodeATRAC3(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 'wav');
        const outFileName = `${this.outFileNameNoExt}.wav`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = (await this.ffmpegProcess.read(outFileName)) as { data: Uint8Array };
        let bitrate: string = `0`;

        switch (parameters.format.bitrate) {
            case 132:
                bitrate = `128`;
                break;
            case 105:
                bitrate = `102`;
                break;
            case 66:
                bitrate = `64`;
                break;
            default:
                throw new Error('Invalid format');
        }
        const result = await this.atracdencProcess!.encode(data.buffer as ArrayBuffer, bitrate);
        this.atracdencProcess?.terminate();
        return result;
    }

    getSupport(codec: CodecFamily) {
        if (['PCM', 'MP3', 'SPS', 'SPM'].includes(codec)) return 'perfect';
        if (['LP2', 'LP4', 'AT3'].includes(codec)) return 'mediocre';
        return 'unsupported';
    }
}
