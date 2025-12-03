import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from './audio-export';
import { getATRACWAVEncoding } from '../../utils';

class Atrac3OSProcess {
    private messageCallback?: (ev: MessageEvent) => void;

    constructor(public worker: Worker) {
        worker.onmessage = this.handleMessage.bind(this);
    }

    async init() {
        await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'init' });
        });
    }

    async encode(data: ArrayBuffer, bitrate: string) {
        const eventData = await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'encode', bitrate, data }, [data]);
        });
        return eventData.data.result as ArrayBuffer;
    }

    terminate() {
        this.worker.terminate();
    }

    handleMessage(ev: MessageEvent) {
        this.messageCallback!(ev);
        this.messageCallback = undefined;
    }
}

export class Atrac3OSExportService extends DefaultFfmpegAudioExportService {
    public atrac3OSProcess?: Atrac3OSProcess;
    public ready?: Promise<void>;

    async prepare(file: File): Promise<void> {
        this.atrac3OSProcess = new Atrac3OSProcess(new Worker(new URL('./atrac3os-worker', import.meta.url), { type: 'classic' }));
        this.ready = this.atrac3OSProcess.init();
        await super.prepare(file);
    }

    async encodeATRAC3(parameters: ExportParams): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 'wav');
        const outFileName = `${this.outFileNameNoExt}.wav`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = (await this.ffmpegProcess.read(outFileName)) as { data: Uint8Array };

        await this.ready; // Make sure Worker is ready

        const resultData = await this.atrac3OSProcess!.encode(data.buffer, parameters.format.bitrate!.toString());

        const file = new File([new Uint8Array(resultData)], `outAt3File.at3`);
        const headerLength = (await getATRACWAVEncoding(file))!.headerLength;
        const at3Data = resultData.slice(headerLength);

        this.atrac3OSProcess?.terminate();
        return at3Data as ArrayBuffer;
    }

    async encodeATRAC3Plus(parameters: ExportParams): Promise<ArrayBuffer> {
        return await this.encodeATRAC3(parameters);
    }

    getSupport(_codec: CodecFamily): 'perfect' {
        return 'perfect';
    }
}
