import type { Codec, NetMDService } from './services/interfaces/netmd';

interface SpecialSettingValue{}

export interface SpecialEncoderSettingValue extends SpecialSettingValue {
    name: string,
    description: string,
    
}

export interface SpecialSetting {
    name: string;
    specialType: 'encoder';
    specialValue: SpecialSettingValue,
}

export interface NormalSetting {
    name: string;
    family: string;
    type: 'boolean' | 'string' | 'number' | 'action' | 'hostFilePath' | 'hostDirPath';
    state: boolean | string | number;
} 

export interface SettingInterface extends NormalSetting {
    update(newValue: boolean | string | number): Promise<void>;
}

declare global {
    interface Window {
        // ElectronWMD bridge
        native?: {
            // Required:
            unrestrictedFetchJSON: (url: string, parameters?: any) => any;

            // Services:
            interface?: NetMDService;
            himdFullInterface?: NetMDService;

            // Optional:
            reload?: () => void;

            // Settings API:
            getSettings?: () => Promise<SettingInterface[]>;
            openFileHostDialog?: (filters: { name: string, extensions: string[] }[], directory?: boolean) => Promise<string | null>;

            // Encoder settings
            invokeLocalEncoder?: (ffmpegPath: string, encoderPath: string, data: ArrayBuffer, sourceFilename: string, parameters: { format: Codec, enableReplayGain?: boolean }) => Promise<ArrayBuffer | null>;
        };

        reload: () => void;
    }
}
