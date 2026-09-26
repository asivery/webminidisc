import { type PublicFfmpegAudioEncoderV1, type AudioEncoderV1API, type AudioEncoderV1ExportCodec, type AudioEncoderV1ExportParams, type AudioEncoderV1Instance, type CustomParameters } from "./external/external-interface";

const MAX_TRIES = 3;

export default class RemoteAtracExportService implements AudioEncoderV1Instance {
    static customConstructionParameters = [
        {
            userFriendlyName: 'Server Address',
            varName: 'address',
            type: 'string',
            defaultValue: 'https://atrac.minidisc.wiki/',
            validator: (content: string) => {
                try {
                    new URL(content);
                    return true;
                } catch (e) {
                    return false;
                }
            },
        },
    ]

    public address: string;
    private ffmpeg: PublicFfmpegAudioEncoderV1;

    constructor(private api: AudioEncoderV1API, parameters: CustomParameters) {
        this.address = parameters.address as string;
        this.ffmpeg = api.getBuiltinEncoder('ffmpeg');
    }

    init(): Promise<void> { return this.ffmpeg.init(); }
    deinit(): Promise<void> { return this.ffmpeg.deinit(); }

    getSupportFor(_codec: AudioEncoderV1ExportCodec): { state: 'perfect' | 'poor' | 'unsupported'; gapless: boolean; bitrates?: number[]; } {
        return { state: 'perfect', gapless: false };
    }

    async transcode(source: Uint8Array<ArrayBuffer>, sourceFileName: string, exportParams: AudioEncoderV1ExportParams, transcodeCallback?: (obj: { stage: string; progress: number; total: number; }) => void): Promise<Uint8Array<ArrayBuffer>> {
        if(exportParams.format.codec in ['MP3', 'PCM']) {
            return this.ffmpeg.transcode(source, sourceFileName, exportParams, transcodeCallback);
        }

        const payload = new FormData();
        payload.append('file', new Blob([ source ]), sourceFileName);
        const encodingURL = new URL(this.address);
        if (!encodingURL.pathname.endsWith('/')) encodingURL.pathname += '/';
        encodingURL.pathname += 'transcode';
        let encoderFormat: string;
        switch (exportParams.format.codec) {
            case 'A3+':
                if (![48, 64, 96, 128, 160, 192, 256, 320, 352].includes(exportParams.format.bitrate ?? 0)) {
                    throw new Error('Invalid bitrate given to encoder');
                }
                encoderFormat = `PLUS${exportParams.format.bitrate!}`;
                break;
            case 'AT3':
                // AT3@105kbps
                if (exportParams.format.bitrate === 105) {
                    encoderFormat = 'LP105';
                    break;
                } else if (exportParams.format.bitrate === 132) {
                    encoderFormat = 'LP2';
                    break;
                } else if (exportParams.format.bitrate === 66) {
                    encoderFormat = 'LP4';
                    break;
                } // else fall through
            default:
                throw new Error('Invalid format given to encoder');
        }
        encodingURL.searchParams.set('type', encoderFormat);
        if (exportParams.enableReplayGain !== undefined) encodingURL.searchParams.set('applyReplaygain', exportParams.enableReplayGain.toString());
        let response: Response | null = null;
        for (let i = 0; i < MAX_TRIES; i++) {
            try {
                transcodeCallback?.({ stage: 'sending', progress: 0, total: 2});
                response = await fetch(encodingURL.href, {
                    method: 'POST',
                    body: payload,
                });
                if (response === null) {
                    throw new Error('Failed to convert audio!');
                }
                transcodeCallback?.({ stage: 'receiving', progress: 1, total: 2});
                const source = await response.arrayBuffer();
                const content = new Uint8Array(source);
                const headerLength = (this.api.getATRACWAVEncoding(content))!.headerLength;
                transcodeCallback?.({ stage: 'receiving', progress: 2, total: 2});
                return new Uint8Array(source.slice(headerLength));
            } catch (ex) {
                console.log('Error while fetching: ' + ex);
            }
        }

        throw new Error("Encoding error!");
    }

    getUserFriendyStageName(stage: string): string | null {
        return {
            sending: 'Sending...',
            receiving: 'Receiving...',
        }[stage] ?? this.ffmpeg.getUserFriendyStageName(stage);
    }
}
