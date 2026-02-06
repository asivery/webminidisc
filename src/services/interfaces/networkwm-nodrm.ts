import { DeviceStatus, TrackFlag } from "netmd-js";
import { Capability, Codec, Disc, Group, NetMDService, TitleParameter, Track } from "./netmd";
import { resolvePathFromGlobalIndex, TrackMetadata, DeviceDefinition, decryptMP3, initializeIfNeeded } from 'networkwm-js';
import { FSAHiMDFilesystem, HiMDKBPSToFrameSize, generateCodecInfo } from "himd-js";
import { AbstractedTrack, DatabaseAbstraction } from "networkwm-js";

const CHUNK_SIZE = 524288;

export class NetworkWMService extends NetMDService {
    private name: string = "";
    private database: DatabaseAbstraction | null = null;
    private dirty = false;
    private cache: {
        nwjsTracks: AbstractedTrack[],
        groups: Group[],
        left: number,
        total: number,
        used: number,
    } | null = null;
    public constructor(private device: DeviceDefinition){ super(); }

    isDeviceConnected(): boolean {
        return true;
    }

    async getServiceCapabilities(): Promise<Capability[]> {
        return [
            Capability.himdTitles,
            Capability.contentList,
            Capability.trackUpload,
            Capability.metadataEdit,
            Capability.trackDownload,
        ];
    }
    async getDeviceStatus(): Promise<DeviceStatus> {
        return {
            discPresent: true,
            state: "ready",
            time: { frame: 0, minute: 0, second: 0 },
            track: 0,
        }
    }
    async pair(): Promise<boolean> {
        const fs = await FSAHiMDFilesystem.init(false);
        await initializeIfNeeded(fs, this.device.databaseParameters?.initLayers);
        this.database = await DatabaseAbstraction.create(fs, this.device);
        this.name = this.device.name;
        return true;
    }

    async connect(): Promise<boolean> {
        return false;
    }

    async listContent(dropCache?: boolean): Promise<Disc> {
        if(this.cache === null || dropCache) {
            const sorted = this.database!.getTracksSortedArtistAlbum();
            const nwjsTracks: AbstractedTrack[] = [];
            const groups = [];

            let { left, total, used } = await this.database!.database.filesystem.statFilesystem();

            if(left < 4 * 1048576) {
                // If we have less than 4 MiB left, make it seem the drive is 100% filled.
                used += left;
                left = 0;
            }

            let i = 0;
            for(let artist of sorted){
                for(let album of artist.contents) {
                    let tracks: Track[] = [];
                    groups.push({
                        fullWidthTitle: null,
                        title: `${artist.name} - ${album.name}`,
                        tracks,
                        index: i,
                    })
                    for(let track of album.contents) {
                        nwjsTracks.push(track);
                        tracks.push({
                            channel: 2,
                            duration: track.trackDuration / 1000, // In milliseconds
                            encoding: { codec: track.codecName, bitrate: track.codecKBPS },
                            fullWidthTitle: '',
                            index: i++,
                            protected: TrackFlag.unprotected,
                            title: track.title,
                            album: track.album,
                            artist: track.artist,
                        });
                    }
                }
            }
            this.cache = {
                left, total, used,

                groups,
                nwjsTracks,
            }
        }

        const disc: Disc = {
            fullWidthTitle: '',
            title: ' ',
            left: this.cache!.left,
            total: this.cache!.total,
            trackCount: this.cache!.nwjsTracks.length,
            used: this.cache!.used,
            writable: true,
            writeProtected: false,
            groups: [{fullWidthTitle: null, title: null, index: 0, tracks: []}, ...this.cache!.groups]
        };

        return disc;
    }
    async getDeviceName(): Promise<string> {
        return this.name;
    }

    async prepareUpload() {}

    async finalizeUpload() {
        await this.database!.flushUpdates();
    }

    async upload(_title: TitleParameter, _: string, data: ArrayBuffer, format: Codec, progressCallback: (progress: { written: number; encrypted: number; total: number; }) => void): Promise<void> {
        const { artist, title, album } = _title as {
            title?: string;
            album?: string;
            artist?: string;
        };

        if(format.codec === 'MP3') {
            this.cache = null;
            return this.database!.uploadMP3Track(
                {
                    artist: artist ?? 'Unknown Artist',
                    album: album ?? 'Unknown Album',
                    genre: 'Genre',
                    title: title ?? 'Unknown Title',
                },
                new Uint8Array(data),
                (done, outOf) => progressCallback({ written: done, encrypted: outOf, total: outOf }),
                CHUNK_SIZE,
            );
        }

        const codecFrameSizeFamily = format.codec === 'A3+' ? HiMDKBPSToFrameSize.atrac3plus : HiMDKBPSToFrameSize.atrac3;
        if(format.codec !== 'A3+' && format.codec !== 'AT3') throw new Error("Invalid format!");
        const codecInfo = generateCodecInfo(format.codec, codecFrameSizeFamily[format.bitrate!]);

        await this.database!.uploadTrack(
            {
                artist: artist ?? 'Unknown Artist',
                album: album ?? 'Unknown Album',
                genre: 'Genre',
                title: title ?? 'Unknown Title',
            }, codecInfo,
            new Uint8Array(data),
            undefined,
            (done, outOf) => progressCallback({ written: done, encrypted: outOf, total: outOf }),
            CHUNK_SIZE,
        );
        this.cache = null;
    }

    async renameTrack(index: number, newTitle: TitleParameter, newFullWidthTitle?: string): Promise<void> {
        // The objects are never cloned - current cache maintains a reference to the database abstraction's track structure
        if(!this.cache) await this.listContent();
        const track = this.cache!.nwjsTracks[index];
        const metadata: TrackMetadata = {
            artist: track.artist ?? 'Unknown Artist',
            album: track.album ?? 'Unknown Album',
            genre: 'Genre',
            title: typeof newTitle === 'string' ? newTitle : newTitle.title ?? 'Unknown Title',
            trackDuration: -1,
            trackNumber: track.trackNumber,
        }
        if(!(typeof newTitle === 'string')) {
            if(newTitle.album) metadata.album = newTitle.album;
            if(newTitle.artist) metadata.artist = newTitle.artist;
        }

        await this.database!.renameTrack(track.systemIndex, metadata);
        await this.flush(); // Do not let the OMA files get desync'd with database.
        this.cache = null;
    }

    async deleteTracks(indices: number[]) {
        // Sorting here does not matter.
        // Deleting an index does not move any other indices around
        for(let index of indices) {
            await this.database!.deleteTrack(this.cache!.nwjsTracks[index].systemIndex);
        }
        await this.flush();
        this.cache = null;
    }

    async moveTrack(src: number, dst: number, updateGroups?: boolean) {
        // Assure the user cannot move this track beyond the limits of its region.
        if(!this.cache) await this.listContent();
        // Find top and bottom of this album.
        let thisTrack = this.cache!.nwjsTracks[src]!;
        const isInThisAlbum = (index: number) => this.cache!.nwjsTracks[index]?.album === thisTrack.album && this.cache!.nwjsTracks[index]?.artist === thisTrack.artist;
        let bottomIndex = src, topIndex = src;
        while(isInThisAlbum(bottomIndex - 1)) bottomIndex--;
        while(isInThisAlbum(topIndex + 1)) topIndex++;
        // Clamp dst
        dst = Math.max(bottomIndex, Math.min(topIndex, dst));
        this.cache!.nwjsTracks.splice(dst, 0, ...this.cache!.nwjsTracks.splice(src, 1));
        // Rebuild track indices
        for(let i = bottomIndex; i<=topIndex; i++) {
            this.cache!.nwjsTracks[i].trackNumber = i - bottomIndex;
        }
        this.cache = null;
        this.dirty = true;
    }

    wipeDisc(): Promise<void> {
        this.cache = null;
        return this.database!.eraseAll();
    }

    async flush(): Promise<void> {
        await this.database!.flushUpdates();
        this.dirty = false;
        this.cache = null;
    }

    async canBeFlushed() {
        return this.dirty;
    }

    finalize(): Promise<void> {
        return Promise.resolve();
    }

    async download(index: number, progressCallback: (progress: { read: number; total: number; }) => void): Promise<{ extension: string; data: Uint8Array<ArrayBuffer>; }> {
        // NW files are stored with known decryption keys.
        // Simply invoke FS functions to read the file back...
        if(!this.cache) await this.listContent();
        const fsEntry = await this.database!.database.filesystem.open(resolvePathFromGlobalIndex(this.cache!.nwjsTracks![index].systemIndex), 'ro');
        if(!fsEntry) throw new Error("Cannot read audio file!");
        let buffer = new Uint8Array(fsEntry.length);
        for(let cursor = 0; cursor < buffer.length; cursor += Math.min(4096, buffer.length - cursor)) {
            buffer.set(await fsEntry.read(4096), cursor);
            progressCallback({ read: cursor, total: buffer.length });
        }
        // Unless MP3s are being processed
        let extension;
        if(this.cache!.nwjsTracks![index].codecName === "MP3") {
            // MP3s need to be decrypted
            if(!this.database!.mp3DeviceKey) {
                // TODO: Bruteforce it.
                throw new Error("No MP3 device key!");
            }
            buffer = decryptMP3(buffer, this.cache!.nwjsTracks![index].systemIndex, this.database!.mp3DeviceKey!);
            extension = "mp3";
        } else if(this.cache!.nwjsTracks![index].codecName === "PCM") {
            extension = "wav";
        } else {
            extension = "oma";
        }
        return { extension, data: buffer };
    }

    virtualGroupError = () => {
        window.alert("In Network Walkmans groups are virtual! (?)");
        return Promise.resolve();
    }

    async renameGroup(groupIndex: number, newTitle: string, newFullWidthTitle?: string): Promise<void> {
        // Check if the new title isn't ambiguous.
        if(!this.cache) await this.listContent();
        if((newTitle.length - newTitle.replace('-', '').length) !== 1) {
            window.alert("Ambiguous format!");
            return;
        }
        const [artist, album] = newTitle.split("-").map(e => e.trim());
        // groupIndex is the index of the first track in group.
        const firstTrack = {...this.cache!.nwjsTracks[groupIndex]};
        let currentTrack = firstTrack;
        let currentIndex = groupIndex;
        while(currentTrack?.album === firstTrack.album && currentTrack?.artist === firstTrack.artist) {
            await this.database!.renameTrack(currentTrack.systemIndex, { artist, album, title: currentTrack.title, genre: currentTrack.genre, trackDuration: currentTrack.trackDuration, trackNumber: currentTrack.trackNumber});
            currentTrack = this.cache!.nwjsTracks[++currentIndex];
        }
        await this.flush();
        this.cache = null;
    }
    addGroup(groupBegin: number, groupLength: number, name: string, fullWidthTitle?: string): Promise<void> {
        return this.virtualGroupError();
    }
    deleteGroup(groupIndex: number): Promise<void> {
        return this.virtualGroupError();
    }
    rewriteGroups(groups: Group[]): Promise<void> {
        return Promise.resolve();
    }

    // Can't be implemented
    notAvailableInThisMode = () => window.alert("Not available");
    async play(): Promise<void> { this.notAvailableInThisMode(); }
    async pause(): Promise<void> { this.notAvailableInThisMode(); }
    async stop(): Promise<void> {}
    async next(): Promise<void> { this.notAvailableInThisMode(); }
    async prev(): Promise<void> { this.notAvailableInThisMode(); }
    async gotoTrack(index: number): Promise<void> { this.notAvailableInThisMode(); }
    async gotoTime(index: number, hour: number, minute: number, second: number, frame: number): Promise<void> { this.notAvailableInThisMode(); }
    async getPosition(): Promise<number[]> { throw new Error("Not implemented!"); }
    ejectDisc(): Promise<void> { throw new Error("Not implemented!"); }
    wipeDiscTitleInfo(): Promise<void> { throw new Error("Not implemented!"); }
    renameDisc(newName: string, newFullWidthName?: string): Promise<void> { window.alert("No disc to be renamed in Network Walkmans!"); return Promise.resolve(); } // TODO: Volume label support...
}
