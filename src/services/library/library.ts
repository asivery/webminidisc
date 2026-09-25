import { AudioEncoderV1ExportParams } from "../audio/apiv1/external-interface";

export type LocalDatabase = { [filename: string]: LocalDatabase | { artist: string, album: string, title: string, duration: number }};

// TODO: For now getSupport() is assumed to return 'perfect' all the time
// FIX THIS
export interface LibraryService {
    getDatabase(): Promise<LocalDatabase>;
    processLocalLibraryFile(filePath: string, params: AudioEncoderV1ExportParams): Promise<ArrayBuffer>;
}
