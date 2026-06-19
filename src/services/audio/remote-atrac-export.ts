import { CustomParameters } from '../../custom-parameters';
import { getATRACWAVEncoding } from '../../utils';
import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from './audio-export';

const MAX_TRIES = 3;

export class RemoteAtracExportService extends DefaultFfmpegAudioExportService {
    public address: string;
    public originalFileName: string = '';

    constructor(parameters: CustomParameters) {
        super();
        this.address = parameters.address as string;
    }

    async prepare(file: File): Promise<void> {
        await super.prepare(file);
        this.originalFileName = file.name;
    }

    async encodeATRAC3({ format, enableReplayGain }: ExportParams): Promise<ArrayBuffer> {
        const { data } = await this.ffmpegProcess.read(this.inFileName);

        const payload = new FormData();
        payload.append('file', new Blob([data.buffer]), this.originalFileName);
        const encodingURL = new URL(this.address);
        if (!encodingURL.pathname.endsWith('/')) encodingURL.pathname += '/';
        encodingURL.pathname += 'transcode';
        let encoderFormat: string;
        switch (format.codec) {
            case 'A3+':
                if (![48, 64, 96, 128, 160, 192, 256, 320, 352].includes(format.bitrate ?? 0)) {
                    throw new Error('Invalid bitrate given to encoder');
                }
                encoderFormat = `PLUS${format.bitrate!}`;
                break;
            case 'AT3':
                // AT3@105kbps
                if (format.bitrate === 105) {
                    encoderFormat = 'LP105';
                    break;
                } else if (format.bitrate === 132) {
                    encoderFormat = 'LP2';
                    break;
                } else if (format.bitrate === 66) {
                    encoderFormat = 'LP4';
                    break;
                } // else fall through
            default:
                throw new Error('Invalid format given to encoder');
        }
        encodingURL.searchParams.set('type', encoderFormat);
        if (enableReplayGain !== undefined) encodingURL.searchParams.set('applyReplaygain', enableReplayGain.toString());
        let response: Response | null = null;
        for (let i = 0; i < MAX_TRIES; i++) {
            try {
                response = await fetch(encodingURL.href, {
                    method: 'POST',
                    body: payload,
                });
                if (response === null) {
                    throw new Error('Failed to convert audio!');
                }
                const source = await response.arrayBuffer();
                const content = new Uint8Array(source);
                const file = new File([content], 'test.at3');
                const headerLength = (await getATRACWAVEncoding(file))!.headerLength;
                return source.slice(headerLength);
            } catch (ex) {
                console.log('Error while fetching: ' + ex);
            }
        }

        throw new Error('Failed to transcode audio!');
    }

    async encodeATRAC3Plus(parameters: ExportParams): Promise<ArrayBuffer> {
        return await this.encodeATRAC3(parameters);
    }

    getSupport(_codec: CodecFamily) {
        return { state: 'perfect' as const, gapless: false };
    }
}
