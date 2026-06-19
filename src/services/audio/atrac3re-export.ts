import { CustomParameters } from '../../custom-parameters';
import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from './audio-export';

export class Atrac3Re {
    private messageCallback?: (ev: MessageEvent) => void;
    private progress?: (progress: number) => void;

    constructor(public worker: Worker) {
        worker.onmessage = this.handleMessage.bind(this);
    }

    async init() {
        await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'init' });
        });
    }

    async encode(data: ArrayBuffer, bitrate: number, lastInBatch: boolean, progress?: (pg: number) => void) {
        this.progress = progress;
        const eventData = await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'encode', bitrate, data, lastInBatch }, [data]);
        });
        return eventData.data.result as ArrayBuffer;
    }

    terminate() {
        this.worker.terminate();
    }

    handleMessage(ev: MessageEvent) {
        if (ev.data.pcm_cursor !== undefined) {
            this.progress?.(ev.data.pcm_cursor as number);
        } else {
            this.messageCallback!(ev);
            this.messageCallback = undefined;
        }
    }
}

export class Atrac3REExportService extends DefaultFfmpegAudioExportService {
    public atrac3REProcess?: Atrac3Re;
    public ready?: Promise<void>;

    async prepare(file: File): Promise<void> {
        if (!this.atrac3REProcess) {
            this.atrac3REProcess = new Atrac3Re(new Worker(new URL('./atrac3re-worker', import.meta.url), { type: 'classic' }));
            this.ready = this.atrac3REProcess.init();
        }
        await super.prepare(file);
    }

    async encodeATRAC3(parameters: ExportParams, callback?: (obj: { state: number; total: number }) => void): Promise<ArrayBuffer> {
        const ffmpegCommand = await this.createFfmpegParams(parameters, 'wav');
        const outFileName = `${this.outFileNameNoExt}.wav`;
        await this.ffmpegProcess.transcode(this.inFileName, outFileName, ffmpegCommand);
        const { data } = (await this.ffmpegProcess.read(outFileName)) as { data: Uint8Array };
        const length = data.length;

        await this.ready; // Make sure Worker is ready

        const finished = !parameters.writeGapless;

        const resultData = await this.atrac3REProcess!.encode(
            data.buffer as ArrayBuffer,
            parameters.format.bitrate!,
            finished,
            callback && ((bytesEncoded) => callback({ state: bytesEncoded, total: length }))
        );

        if (finished) {
            this.atrac3REProcess?.terminate();
            this.atrac3REProcess = undefined;
        }
        return resultData as ArrayBuffer;
    }

    async encodeATRAC3Plus(parameters: ExportParams, callback: (obj: { state: number; total: number }) => void): Promise<ArrayBuffer> {
        return await this.encodeATRAC3(parameters, callback);
    }

    getSupport(codec: CodecFamily) {
        return { state: 'perfect' as const, gapless: codec === 'AT3' || codec === 'A3+' };
    }
}
