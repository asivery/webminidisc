import { CustomParameters } from '../../custom-parameters';
import { getATRACWAVEncoding } from '../../utils';
import { CodecFamily } from '../interfaces/netmd';
import { DefaultFfmpegAudioExportService, ExportParams } from '../audio/audio-export';
import { LibraryService, LocalDatabase } from './library';

const MAX_TRIES = 3;

export class RemoteLibraryService extends DefaultFfmpegAudioExportService implements LibraryService {
    // These methods are required by the DefaultFFMPEGAudioExport service, but since
    // this is a library, they won't be used
    encodeATRAC3(parameters: ExportParams): Promise<ArrayBuffer> {
        throw new Error('Method not implemented.');
    }
    encodeATRAC3Plus(parameters: ExportParams): Promise<ArrayBuffer> {
        throw new Error('Method not implemented.');
    }

    public address: string;
    public originalFileName: string = '';

    constructor(parameters: CustomParameters) {
        super();
        this.address = parameters.address as string;
    }

    getSupport(codec: CodecFamily): 'perfect' {
        return 'perfect';
    }

    async getDatabase(): Promise<LocalDatabase> {
        const dbPage = new URL(this.address);
        dbPage.pathname = "/database";
        dbPage.searchParams.append("cache", Math.random() + "");
        const resp = await fetch(dbPage);
        const json = await resp.json();
        return json as LocalDatabase;
    }

    async processLocalLibraryFile(filePath: string, params: ExportParams): Promise<ArrayBuffer> {
        if (params.format.codec === 'PCM' || params.format.codec === 'MP3') {
            // Fetch the file normally, then transcode to PCM / MP3
            const rawURL = new URL(this.address);
            if (!rawURL.pathname.endsWith('/')) rawURL.pathname += '/';
            rawURL.pathname += 'get_local';
            rawURL.searchParams.set('file_name', filePath);
            let response: Response | null = null;
            for(let i = 0; i<MAX_TRIES; i++){
                try{
                    response = await fetch(rawURL);
                    break;
                }catch(ex){
                    console.log("Error while fetching: " + ex);
                }
            }
            if(response === null) {
                throw new Error("Failed to convert audio!");
            }
            const fileTokens = filePath.split("/");
            const fileName = fileTokens[fileTokens.length - 1];
            const asFile = new File([ await response.blob() ], fileName);
            await this.prepare(asFile);
            return this.export(params);
        } else {
            const { format, enableReplayGain } = params;
            const encodingURL = new URL(this.address);
            if (!encodingURL.pathname.endsWith('/')) encodingURL.pathname += '/';
            encodingURL.pathname += 'transcode_local';
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
            encodingURL.searchParams.set('file_name', filePath);
            if (enableReplayGain !== undefined) encodingURL.searchParams.set('applyReplaygain', enableReplayGain.toString());
            let response: Response | null = null;
            for(let i = 0; i<MAX_TRIES; i++){
                try{
                    response = await fetch(encodingURL.href);
                    break;
                }catch(ex){
                    console.log("Error while fetching: " + ex);
                }
            }
            if(response === null) {
                throw new Error("Failed to convert audio!");
            }
            const source = await response.arrayBuffer();
            const content = new Uint8Array(source);
            const file = new File([content], 'test.at3');
            const headerLength = (await getATRACWAVEncoding(file))!.headerLength;
            return source.slice(headerLength);
        }
    }
}
