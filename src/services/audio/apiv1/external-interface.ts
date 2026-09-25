export type CustomParameters = { [key: string]: string | number | boolean };
export type CustomParameterType = 'string' | 'number' | 'boolean' | 'hostFilePath' | 'hostDirPath' | { name: string, value: string }[];
export type CustomParameterInfo = {
    userFriendlyName: string;
    varName: string;
    type: CustomParameterType;
    defaultValue?: string | number | boolean;
    validator?: (content: string) => boolean;
};

export type BuiltinEncoderID = 'ffmpeg';
export type AudioEncoderV1ExportCodec = 'AT3' | 'A3+' | 'PCM' | 'MP3';

export type AudioEncoderV1ExportParams = {
    format: { bitrate: number; codec: AudioEncoderV1ExportCodec };
    enableReplayGain?: boolean;
    writeGapless: boolean;
};

export interface PublicFfmpegAudioEncoderV1 extends AudioEncoderV1Instance {
    createFfmpegParams(parameters: AudioEncoderV1ExportParams, outputFormat: string, moreParams?: string): string;
    ffmpegProcess: {
        read(fileName: string): Promise<{ data: Uint8Array }>
        write(fileName: string, buffer: Uint8Array): Promise<void>
        transcode(source: string, destination: string, command: string): Promise<void>
    }
}

export function transferCodecToExportCodec(format: {
    bitrate: number;
    codec: 'SPS' | 'SPM' | AudioEncoderV1ExportCodec;
}): AudioEncoderV1ExportParams['format'] {
    switch (format.codec) {
        case 'SPM':
        case 'SPS':
        case 'PCM':
            return { codec: 'PCM', bitrate: 1411 };
        default:
            return format as any;
    }
}

export interface AudioEncoderV1Constructor {
    new (api: AudioEncoderV1API, parameters: CustomParameters): AudioEncoderV1Instance;
    customConstructionParameters: CustomParameterInfo[]
}

export interface AudioEncoderV1Instance {
    init(): Promise<void>;
    deinit(): Promise<void>;

    transcode(
        source: Uint8Array<ArrayBuffer>,
        sourceFileName: string,
        exportParams: AudioEncoderV1ExportParams,
        transcodeCallback?: (obj: { stage: string; progress: number; total: number }) => void
    ): Promise<Uint8Array<ArrayBuffer>>;
    getUserFriendyStageName(stage: string): string | null;
    // Bitrates being unset means "all supported".
    getSupportFor(codec: AudioEncoderV1ExportCodec): { state: 'perfect' | 'poor' | 'unsupported', gapless: boolean, bitrates?: number[] };
}

export interface AudioEncoderV1API {
    getOwnFile(fileName: string): Uint8Array<ArrayBuffer>;
    getOtherEncoderFile(encoderId: string, fileName: string): Uint8Array<ArrayBuffer>;

    // You must not use the following methods before init() is called.
    hasEncoderPresent(encoderId: string): boolean;
    getEncoder(encoderId: string, customParams: CustomParameters): { instance: AudioEncoderV1Instance; metadata: AudioEncoderV1Metadata };

    getBuiltinEncoder(encoderId: BuiltinEncoderID): AudioEncoderV1Instance;
    getBuiltinEncoder(encoderId: 'ffmpeg'): PublicFfmpegAudioEncoderV1;

    getATRACOMAEncoding(
        fileData: Uint8Array
    ): { format: { codec: 'AT3' | 'A3+'; bitrate: number }; headerLength: number } | 'ILLEGAL' | null;
    getATRACWAVEncoding(
        fileData: Uint8Array
    ): { format: { codec: 'AT3' | 'A3+'; bitrate: number }; headerLength: number } | null
}

export interface AudioEncoderV1Metadata {
    encoderId: string;
    userFriendlyName: string;
    description: string;
    encoderDependencies: string[];
    version: string;
    apiVersion: '1';
}
