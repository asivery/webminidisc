import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AudioEncoderV1API, AudioEncoderV1Constructor, AudioEncoderV1Instance, AudioEncoderV1Metadata, BuiltinEncoderID, CustomParameterInfo, CustomParameters, PublicFfmpegAudioEncoderV1 } from './external-interface';
import { SARFile } from './external-archive';
import { FfmpegAudioEncoder } from '../ffmpeg/ffmpeg-audio-export';
import { getATRACOMAEncoding, getATRACWAVEncoding } from '../../../utils';
interface EncoderStorageDBV1 extends DBSchema {
    encoders: {
        value: {
            metadata: AudioEncoderV1Metadata,
            rawArchive: Uint8Array,
        },
        key: string,
    }
};

/*
Encoder file layout:

/ (root)
|
|-> metadata.json
|
|-> index.js            - The entry point for the encoder.
|                         It's meant to be a module with a class default export
|                         This class should implement AudioEncoderV1Instance
|
\ ...                   - Any other files
*/

export class EncoderStorageManager {
    static INSTANCE = new EncoderStorageManager();

    private db!: IDBPDatabase<EncoderStorageDBV1>;
    private encoders: Record<string, { metadata: AudioEncoderV1Metadata, sarFile: SARFile, ctor: AudioEncoderV1Constructor }> = {};
    private builtinEncoders: Record<BuiltinEncoderID, AudioEncoderV1Instance> = {
        ffmpeg: new FfmpegAudioEncoder(),
    };
    async init() {
        this.db = await openDB<EncoderStorageDBV1>('encoders', 1, {
            upgrade(db) {
                console.log("Running encoder database upgrade!")
                db.createObjectStore('encoders');
            }
        });

        for(const entry of await this.db.getAll('encoders')) {
            switch(entry.metadata.apiVersion) {
                case '1':
                    await this._loadV1FromSAR(new SARFile(entry.rawArchive));
                    break;
            }
        }
    }

    async _loadV1FromSAR(sarFile: SARFile) {
        const indexJSFile = sarFile.getFile("index.js");
        const metadataRaw = sarFile.getFile("metadata.json");
        const metadata: AudioEncoderV1Metadata = JSON.parse(new TextDecoder().decode(metadataRaw));
        const blob = new Blob([ indexJSFile ], { type: 'text/javascript; encoding=UTF-8'});
        const url = URL.createObjectURL(blob);
        const module = await import(/* @vite-ignore */ url, { });
        const klass = module.default as AudioEncoderV1Constructor;
        this.encoders[metadata.encoderId] = {
            ctor: klass,
            metadata,
            sarFile,
        };
    }

    getBuiltinEncoder(encoder: 'ffmpeg'): PublicFfmpegAudioEncoderV1;
    getBuiltinEncoder(encoder: BuiltinEncoderID): AudioEncoderV1Instance {
        return this.builtinEncoders[encoder];
    }

    getEncoder(id: string, customParams: CustomParameters): { instance: AudioEncoderV1Instance, metadata: AudioEncoderV1Metadata, sarFile: SARFile } {
        const assertHasEncoder = (id: string) => {
            if(!this.hasEncoder(id)) throw new Error(`No such encoder: ${id}`);
        };

        assertHasEncoder(id);

        const found = this.encoders[id];
        const api = {
            getEncoder: this.getEncoder.bind(this),
            getOtherEncoderFile: (encoderId, fileName) => {
                assertHasEncoder(encoderId);
                return this.encoders[encoderId].sarFile.getFile(fileName);
            },
            getOwnFile: found.sarFile.getFile.bind(found.sarFile),
            hasEncoderPresent: this.hasEncoder.bind(this),
            getBuiltinEncoder: this.getBuiltinEncoder.bind(this),
            
            getATRACOMAEncoding: getATRACOMAEncoding,
            getATRACWAVEncoding: getATRACWAVEncoding,
        } satisfies AudioEncoderV1API;

        return { sarFile: found.sarFile, metadata: found.metadata, instance: new found.ctor(api, customParams) };
    }

    getEncoderMetadata(id: string): { customParameters: CustomParameterInfo[], metadata: AudioEncoderV1Metadata } {
        if(!this.hasEncoder(id)) throw new Error(`No such encoder: ${id}`);
        return { customParameters: this.encoders[id].ctor.customConstructionParameters, metadata: this.encoders[id].metadata };
    }

    listAvailableEncoders(): string[] {
        return Object.keys(this.encoders);
    }

    listAvailableEncodersMetadata(): (AudioEncoderV1Metadata & { customParameters?: CustomParameterInfo[] })[] {
        return Object.values(this.encoders).map(e => ({...e.metadata, customParameters: e.ctor.customConstructionParameters }));
    }

    hasEncoder(id: string): boolean {
        return id in this.encoders;
    }

    // The dependency check shall be done in the caller
    // If I were to implement it here, I'd have to make sure the caller
    // installs these encoders in order, and that's a pain.
    async installEncoderSkipDependencyCheck(archiveFile: Uint8Array): Promise<void> {
        const sarFile = new SARFile(archiveFile);
        const metadata: AudioEncoderV1Metadata = JSON.parse(new TextDecoder().decode(sarFile.getFile("metadata.json")));

        if(metadata.apiVersion !== '1') throw new Error("Unknown apiVersion provided in the encoder");

        console.log(`Installing encoder ${metadata.encoderId} (${metadata.userFriendlyName}) @ ${metadata.version}`);

        await this.db.put('encoders', { metadata, rawArchive: archiveFile }, metadata.encoderId);
        await this._loadV1FromSAR(sarFile);
    }

    buildReverseDependentsList(id: string): string[] {
        let toTraverse = new Set([ id ]);
        let finalList = new Set<string>();
        while(toTraverse.size) {
            const newToTraverse = new Set<string>();
            toTraverse.forEach(finalList.add.bind(finalList));
            for(const e of Object.values(this.encoders)) {
                if(!(e.metadata.encoderId in finalList)) {
                    for(const z of toTraverse) {
                        if(e.metadata.encoderDependencies.includes(z)) {
                            newToTraverse.add(e.metadata.encoderId);
                        }
                    }
                }
            }
            toTraverse = newToTraverse;
        }

        return Array.from(finalList);
    }

    async uninstallEncoders(ids: string[]) {
        for(const id of ids) {
            delete this.encoders[id];
            await this.db.delete('encoders', id);
        }
    }
}
