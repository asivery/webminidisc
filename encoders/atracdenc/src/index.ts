import { type PublicFfmpegAudioEncoderV1, type AudioEncoderV1API, type AudioEncoderV1ExportCodec, type AudioEncoderV1ExportParams, type AudioEncoderV1Instance, type CustomParameters } from "./external/external-interface";

class AtracdencProcess {
    private messageCallback?: (ev: MessageEvent) => void;

    constructor(public worker: Worker, private atracdencJsURL: string) {
        worker.onmessage = this.handleMessage.bind(this);
    }

    async init() {
        await new Promise<MessageEvent>((resolve) => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'init', atracdencJsURL: this.atracdencJsURL });
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

function createJSResource(contents: Uint8Array<ArrayBuffer>) {
    return URL.createObjectURL(new Blob([ contents ], { type: 'text/javascript; encoding=utf-8'}))
}

export default class AtracdencAudioExportService implements AudioEncoderV1Instance {
    public atracdencProcess?: AtracdencProcess;
    private atracdencJsURL?: string;
    private workerURL?: string;
    private ffmpeg: PublicFfmpegAudioEncoderV1;

    constructor(private api: AudioEncoderV1API) {
        this.ffmpeg = api.getBuiltinEncoder('ffmpeg');
    }

    async init(): Promise<void> {
        // Create the two urls.
        await this.ffmpeg.init();
        this.atracdencJsURL = createJSResource(this.api.getOwnFile('atracdenc.js'));
        this.workerURL = createJSResource(this.api.getOwnFile('worker.js'));
        this.atracdencProcess = new AtracdencProcess(new Worker(this.workerURL, { type: 'classic' }), this.atracdencJsURL);
        await this.atracdencProcess.init();
    }

    async deinit(): Promise<void> {
        this.atracdencProcess?.terminate();
        if(this.atracdencJsURL) URL.revokeObjectURL(this.atracdencJsURL);
        if(this.workerURL) URL.revokeObjectURL(this.workerURL);
        await this.ffmpeg.deinit();
    }

    async transcode(
        source: Uint8Array<ArrayBuffer>,
        fileName: string,
        exportParams: AudioEncoderV1ExportParams,
        transcodeCallback?: (obj: { stage: string; progress: number; total: number; }) => void
    ): Promise<Uint8Array<ArrayBuffer>> {
        if(exportParams.format.codec in ['PCM', 'MP3']) {
            return this.ffmpeg.transcode(source, fileName, exportParams, transcodeCallback);
        }
        if(exportParams.format.codec === 'A3+') throw new Error("Unavailable.");

        const ffmpegCommand = this.ffmpeg.createFfmpegParams(exportParams, 'wav');

        const dotIndex = fileName.lastIndexOf('.') + 1;
        const fileExtension = dotIndex > 0 ? fileName.substring(dotIndex) : 'unknown';
        const inFileName = `inAudioFile.${fileExtension}`;

        transcodeCallback?.({ stage: 'ffmpeg', progress: 0, total: 2 });

        await this.ffmpeg.ffmpegProcess.write(inFileName, source);
        await this.ffmpeg.ffmpegProcess.transcode(inFileName, 'outAudioFile.wav', ffmpegCommand);
        const { data } = await this.ffmpeg.ffmpegProcess.read('outAudioFile.wav');
        transcodeCallback?.({ stage: 'atrac', progress: 1, total: 2 });
        
        let bitrate: string = `0`;
        switch (exportParams.format.bitrate) {
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
        transcodeCallback?.({ stage: 'atrac', progress: 2, total: 2 });

        this.atracdencProcess?.terminate();
        return new Uint8Array(result);
    }

    getUserFriendyStageName(stage: string): string | null {
        return {
            ffmpeg: 'Transcoding to PCM...',
            atrac: 'Transcoding to ATRAC...',
        }[stage] ?? this.ffmpeg.getUserFriendyStageName(stage);
    }

    getSupportFor(codec: AudioEncoderV1ExportCodec): { state: "perfect" | "poor" | "unsupported"; gapless: boolean; bitrates?: number[]; } {
        switch(codec) {
            case 'A3+': return { state: 'unsupported', gapless: false };
            case 'AT3': return { state: 'poor', gapless: false };
            case 'PCM':
            case 'MP3': return { state: 'perfect', gapless: true }
        }
    }
}
