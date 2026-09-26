import { type PublicFfmpegAudioEncoderV1, type AudioEncoderV1API, type AudioEncoderV1ExportCodec, type AudioEncoderV1ExportParams, type AudioEncoderV1Instance, type CustomParameters } from "./external/external-interface";

function createJSResource(contents: Uint8Array<ArrayBuffer>) {
    return URL.createObjectURL(new Blob([ contents ], { type: 'text/javascript; encoding=utf-8'}))
}

interface Links {
    worker: string,
    emuWorker: string,

    cmi: string,
    bios: string,
    kernel: string,

    emulator: string,
}

class Atrac3OSProcess {
    private messageCallback?: (ev: MessageEvent) => void;

    constructor(public worker: Worker) {
        worker.onmessage = this.handleMessage.bind(this);
    }

    async init(links: Links) {
        await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'init', links });
        });
    }

    async encode(data: ArrayBuffer, bitrate: number, lastInBatch: boolean, callback?: (obj: { stage: string; progress: number; total: number }) => void) {
        const total = data.byteLength;
        const eventData = await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = (msg) => {
                if (!msg.data.result) {
                    callback?.({ stage: 'atrac', progress: msg.data.progress, total });
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

export default class Atrac3OSExportService implements AudioEncoderV1Instance {
    public atrac3OSProcess?: Atrac3OSProcess;
    public ready?: Promise<void>;
    private ffmpeg: PublicFfmpegAudioEncoderV1;

    private links: Links;
    constructor(private api: AudioEncoderV1API, _parameters: CustomParameters) {
        this.ffmpeg = api.getBuiltinEncoder('ffmpeg');

        this.links = {
            worker: createJSResource(api.getOwnFile('worker.js')),
            emuWorker: createJSResource(api.getOwnFile('libv86.js')),

            cmi: createJSResource(api.getOwnFile('system.cmi')),
            bios: createJSResource(api.getOwnFile('seabios.bin')),
            kernel: createJSResource(api.getOwnFile('kernel.bin')),

            emulator: createJSResource(api.getOwnFile('v86-patched.wasm')),
        };
    }

    getUserFriendyStageName(stage: string): string | null {
        return {
            ffmpeg: 'Transcoding to PCM...',
            atrac: 'Transcoding to ATRAC...',
        }[stage] ?? null;
    }

    async init(): Promise<void> {
        await this.ffmpeg.init();
        this.atrac3OSProcess = new Atrac3OSProcess(new Worker(this.links.worker, { type: 'classic' }));
        this.ready = this.atrac3OSProcess.init(this.links);
    }

    async deinit(): Promise<void> {
        await this.ffmpeg.deinit();
        this.atrac3OSProcess?.terminate();
    }

    async transcode(source: Uint8Array<ArrayBuffer>, sourceFileName: string, exportParams: AudioEncoderV1ExportParams, transcodeCallback?: (obj: { stage: string; progress: number; total: number; }) => void): Promise<Uint8Array<ArrayBuffer>> {
        if(exportParams.format.codec in ['PCM', 'MP3']) {
            return this.ffmpeg.transcode(source, sourceFileName, exportParams, transcodeCallback);
        }

        const ffmpegCommand = this.ffmpeg.createFfmpegParams(exportParams, 'wav');

        const dotIndex = sourceFileName.lastIndexOf('.') + 1;
        const fileExtension = dotIndex > 0 ? sourceFileName.substring(dotIndex) : 'unknown';
        const inFileName = `inAudioFile.${fileExtension}`;

        transcodeCallback?.({ stage: 'ffmpeg', progress: 0, total: 1 });

        await this.ffmpeg.ffmpegProcess.write(inFileName, source);
        await this.ffmpeg.ffmpegProcess.transcode(inFileName, 'outAudioFile.wav', ffmpegCommand);
        const { data } = await this.ffmpeg.ffmpegProcess.read('outAudioFile.wav');
        transcodeCallback?.({ stage: 'atrac', progress: 1, total: data.byteLength });

        await this.ready; // Make sure Worker is ready

        const finished = !exportParams.writeGapless;

        const resultData = await this.atrac3OSProcess!.encode(data.buffer as ArrayBuffer, exportParams.format.bitrate!, finished, transcodeCallback);

        if (finished) {
            this.atrac3OSProcess?.terminate();
            this.atrac3OSProcess = undefined;
        }
        return new Uint8Array(resultData as ArrayBuffer);
    }

    getSupportFor(codec: AudioEncoderV1ExportCodec): { state: "perfect" | "poor" | "unsupported"; gapless: boolean; bitrates?: number[]; } {
        return { state: 'perfect' as const, gapless: codec === 'AT3' || codec === 'A3+' };
    }
}
