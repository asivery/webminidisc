import { CustomParameters } from '../../custom-parameters';
import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from './audio-export';

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

    async encode(data: ArrayBuffer, bitrate: number, lastInBatch: boolean, callback?: (obj: { state: number, total: number}) => void) {
        const total = data.byteLength;
        const eventData = await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = (msg) => {
                if(!msg.data.result) {
                    callback?.({ state: msg.data.progress, total });
                } else {
                    resolve(msg);
                    this.messageCallback = undefined;
                }
            };
            this.worker.postMessage({ action: 'encode', bitrate, data, lastInBatch }, [data]);
        });
        return eventData.data.result as ArrayBuffer;
    }

    terminate() {
        this.worker.terminate();
    }

    handleMessage(ev: MessageEvent) {
        this.messageCallback!(ev);
    }
}

export class Atrac3OSExportService extends DefaultFfmpegAudioExportService {
    public atrac3OSProcess?: Atrac3OSProcess;
    public ready?: Promise<void>;
    private gapless: boolean;
    constructor(parameters: CustomParameters) {
        super();
        this.gapless = parameters.gapless as boolean;
    }

    async prepare(file: File): Promise<void> {
        if(!this.atrac3OSProcess) {
            this.atrac3OSProcess = new Atrac3OSProcess(new Worker(new URL('./atrac3os-worker', import.meta.url), { type: 'classic' }));
            this.ready = this.atrac3OSProcess.init();
        }
        await super.prepare(file);
    }

    async encodeATRAC3(parameters: ExportParams, callback?: (obj: { state: number, total: number}) => void): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 'wav');
        const outFileName = `${this.outFileNameNoExt}.wav`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = (await this.ffmpegProcess.read(outFileName)) as { data: Uint8Array };

        await this.ready; // Make sure Worker is ready

        const finished = !this.gapless || parameters.lastInBatch;

        const resultData = await this.atrac3OSProcess!.encode(
            data.buffer as ArrayBuffer,
            parameters.format.bitrate!,
            finished,
            callback,
        );

        if(finished) {
            this.atrac3OSProcess?.terminate();
            this.atrac3OSProcess = undefined;
        }
        return resultData as ArrayBuffer;
    }

    async encodeATRAC3Plus(parameters: ExportParams, callback: (obj: { state: number, total: number}) => void): Promise<ArrayBuffer> {
        return await this.encodeATRAC3(parameters, callback);
    }

    getSupport(_codec: CodecFamily): 'perfect' {
        return 'perfect';
    }
}
