import { Channels, TrackFlag, DeviceStatus, getCellsForTitle, getRemainingCharactersForTitles } from 'netmd-js';
import {
    Capability,
    ExploitCapability,
    Track,
    NetMDFactoryService,
    NetMDService,
    Group,
    convertTrackToNJS,
    convertDiscToNJS,
    Disc,
    Codec,
    DefaultMinidiscSpec,
} from './netmd';
import { sleep, asyncMutex, recomputeGroupsAfterTrackMove, isSequential } from '../../utils';
import { assert, sanitizeFullWidthTitle, sanitizeHalfWidthTitle } from 'netmd-js/dist/utils';
import { Mutex } from 'async-mutex';

const spec = new DefaultMinidiscSpec();

class NetMDMockService extends NetMDService {
    public _discCapacity: number = this.useBytes ? 305758208 : 80 * 60;
    public _defaultCodec = this.useBytes ? { codec: 'AT3' as const, bitrate: 132 } : { codec: 'SPS' as const, bitrate: 292 };
    public statusMonitorTimer: any;
    public mutex = new Mutex();
    public _tracksTitlesMaxLength = 1700;
    public _discTitle: string = 'Mock Disc';
    public _fullWidthDiscTitle: string = '';
    public _tracks: Track[] = [
        {
            duration: 3 * 60,
            encoding: this._defaultCodec,
            index: 0,
            channel: Channels.stereo,
            protected: TrackFlag.unprotected,
            title: 'Long name for - Mock Track 1 - by some artist -12398729837198723',
            fullWidthTitle: '',
        },
        {
            duration: 5 * 60,
            encoding: { codec: 'SPM' as const, bitrate: 146 },
            index: 1,
            channel: Channels.mono,
            protected: TrackFlag.unprotected,
            title: 'Mock Track 2 (mono)',
            fullWidthTitle: '',
        },
        {
            duration: 5 * 60,
            encoding: this._defaultCodec,
            index: 2,
            channel: Channels.stereo,
            protected: TrackFlag.unprotected,
            title: 'Mock Track 3',
            fullWidthTitle: '',
        },
        {
            duration: 5 * 60,
            encoding: this._defaultCodec,
            index: 3,
            channel: Channels.stereo,
            protected: TrackFlag.unprotected,
            title: 'Mock Track 4',
            fullWidthTitle: '',
        },
        {
            duration: 5 * 60,
            encoding: this._defaultCodec,
            index: 4,
            channel: Channels.stereo,
            protected: TrackFlag.unprotected,
            title: 'Mock Track 5',
            fullWidthTitle: 'スコット と リバース',
        },
    ];
    public _groupsDef: {
        index: number;
        title: string | null;
        fullWidthTitle: string | null;
        tracksIdx: number[];
    }[] = [
        {
            title: null,
            fullWidthTitle: '',
            index: 0,
            tracksIdx: [2, 3, 4],
        },
        {
            title: 'Test',
            fullWidthTitle: '',
            index: 1,
            tracksIdx: [0, 1],
        },
    ];

    private capabilities: Capability[] = [];

    public _status: DeviceStatus = {
        discPresent: true,
        track: 0,
        time: { minute: 0, second: 0, frame: 4 },
        state: 'ready',
    };

    constructor({
        overrideTitle,
        overrideFWTitle,
        capabilityContentList,
        capabilityPlaybackControl,
        capabilityMetadataEdit,
        capabilityTrackUpload,
        capabilityTrackDownload,
        capabilityDiscEject,
        capabilityFactoryMode,
        capabilityFullWidthTitles,
    }: any, private useBytes: boolean) {
        super();
        if (overrideTitle) this._discTitle = overrideTitle;
        if (overrideFWTitle) this._fullWidthDiscTitle = overrideFWTitle;
        if (capabilityDiscEject) this.capabilities.push(Capability.discEject);
        if (capabilityContentList) this.capabilities.push(Capability.contentList);
        if (capabilityPlaybackControl) this.capabilities.push(Capability.playbackControl);
        if (capabilityMetadataEdit) this.capabilities.push(Capability.metadataEdit);
        if (capabilityTrackUpload) this.capabilities.push(Capability.trackUpload);
        if (capabilityTrackDownload) this.capabilities.push(Capability.trackDownload);
        if (capabilityFactoryMode) this.capabilities.push(Capability.factoryMode);
        if (capabilityFullWidthTitles) this.capabilities.push(Capability.fullWidthSupport);
    }

    public _getGroups(): Group[] {
        return this._groupsDef.map(g => ({
            title: g.title,
            index: g.index,
            tracks: this._tracks.filter(t => g.tracksIdx.includes(t.index)),
            fullWidthTitle: g.fullWidthTitle,
        }));
    }

    _updateTrackIndexes() {
        for (let i = 0; i < this._tracks.length; i++) {
            this._tracks[i].index = i;
        }
    }

    _getUsed() {
        let used = 0;
        for (const t of this._tracks) {
            used += spec.translateToDefaultMeasuringModeFrom(t.encoding, t.duration);
        }
        if(this.useBytes) {
            used *= ((this._defaultCodec.bitrate * 1000) / 8);
        }
        return used;
    }

    _getTracksTitlesLength() {
        return this._tracks.reduce((acc, track) => acc + (track.title?.length ?? 0), 0);
    }

    _getDisc() {
        return {
            title: this._discTitle,
            fullWidthTitle: this._fullWidthDiscTitle,
            writeProtected: false,
            writable: true,
            left: this._discCapacity - this._getUsed(),
            used: this._getUsed(),
            total: this._discCapacity,
            trackCount: this._tracks.length,
            groups: this._getGroups(),
        };
    }

    isDeviceConnected(){
        return false;
    }

    async getServiceCapabilities() {
        return this.capabilities;
    }

    async pair() {
        return true;
    }

    async connect() {
        // Test the button spinner
        await sleep(1200);
        return true;
    }

    async listContent() {
        // This object ends up in the state of redux and Immer will freeze it.
        // That's why it's deep cloned
        return JSON.parse(JSON.stringify(this._getDisc()));
    }

    async renameGroup(gropuIndex: number, newName: string, newFullWidth?: string) {
        const group = this._groupsDef.find(n => n.index === gropuIndex);
        if (!group) {
            return;
        }
        group.title = newName;
        if (newFullWidth !== undefined) {
            group.fullWidthTitle = newFullWidth;
        }
    }

    async addGroup(groupBegin: number, groupLength: number, newName: string, fullWidthTitle: string = '') {
        const ungroupedDefs = this._groupsDef.find(g => g.title === null);
        if (!ungroupedDefs) {
            return; // You can only group tracks that aren't already in a different group, if there's no such tracks, there's no point to continue
        }
        const ungroupedLengthBeforeGroup = ungroupedDefs.tracksIdx.length;

        const newGroupTracks = ungroupedDefs.tracksIdx.filter(idx => idx >= groupBegin && idx < groupBegin + groupLength);
        if (!isSequential(newGroupTracks)) {
            throw new Error('Invalid sequence of tracks!');
        }

        const newGroupDef = {
            title: newName,
            fullWidthTitle,
            index: groupBegin,
            tracksIdx: newGroupTracks,
        };
        this._groupsDef.push(newGroupDef);

        this._groupsDef = this._groupsDef.filter(g => g.tracksIdx.length !== 0).sort((a, b) => a.tracksIdx[0] - b.tracksIdx[0]);

        ungroupedDefs.tracksIdx = ungroupedDefs.tracksIdx.filter(idx => !newGroupTracks.includes(idx));
        if (ungroupedLengthBeforeGroup - ungroupedDefs.tracksIdx.length !== groupLength) {
            throw new Error('A track cannot be in 2 groups!');
        }
    }

    async deleteGroup(index: number) {
        const groups = this._getGroups();
        const group = groups.find(g => g.index === index);
        if (!group) {
            return;
        }
        let ungroupedGroup = this._groupsDef.find(n => n.title === null);
        if (!ungroupedGroup) {
            ungroupedGroup = {
                title: null,
                fullWidthTitle: null,
                tracksIdx: [],
                index: 0,
            };
            this._groupsDef.unshift(ungroupedGroup);
        }
        ungroupedGroup.tracksIdx = ungroupedGroup.tracksIdx.concat(group.tracks.map(t => t.index)).sort();
        this._groupsDef.splice(groups.indexOf(group), 1);
    }

    async rewriteGroups(groups: Group[]) {
        this._groupsDef = groups.map(g => ({
            title: g.title,
            fullWidthTitle: g.fullWidthTitle,
            index: g.index,
            tracksIdx: g.tracks.map(t => t.index),
        }));
    }

    async getDeviceStatus() {
        return JSON.parse(JSON.stringify(this._status));
    }

    async getDeviceName() {
        return `Generic MD Unit`;
    }

    async finalize() {}
    async prepareUpload() {}
    async finalizeUpload() {}

    async renameTrack(index: number, newTitle: string, fullWidthTitle?: string) {
        newTitle = sanitizeHalfWidthTitle(newTitle);
        if (this._getTracksTitlesLength() + newTitle.length > this._tracksTitlesMaxLength) {
            throw new Error(`Track's title too long`);
        }
        if (fullWidthTitle !== undefined) {
            this._tracks[index].fullWidthTitle = sanitizeFullWidthTitle(fullWidthTitle);
        }
        this._tracks[index].title = newTitle;
    }

    async renameDisc(newName: string, fullWidthName?: string) {
        this._discTitle = sanitizeHalfWidthTitle(newName);
        if (fullWidthName !== undefined) this._fullWidthDiscTitle = sanitizeFullWidthTitle(fullWidthName);
    }

    async deleteTracks(indexes: number[]) {
        indexes = indexes.sort((a, b) => a - b);
        indexes.reverse();
        for (const index of indexes) {
            this._groupsDef = recomputeGroupsAfterTrackMove(this._getDisc(), index, -1).groups.map(g => ({
                title: g.title,
                fullWidthTitle: g.fullWidthTitle,
                index: g.index,
                tracksIdx: g.tracks.map(t => t.index),
            }));
            this._tracks.splice(index, 1);
            this._groupsDef.forEach(
                g => (g.tracksIdx = g.tracksIdx.filter(tidx => this._tracks.find(t => t.index === tidx) !== undefined))
            );
        }
        this._updateTrackIndexes();
    }

    async moveTrack(src: number, dst: number, updateGroups?: boolean) {
        const t = this._tracks.splice(src, 1);
        assert(t.length === 1);
        this._tracks.splice(dst, 0, t[0]);
        this._updateTrackIndexes();
        if (updateGroups || updateGroups === undefined) {
            this._groupsDef = recomputeGroupsAfterTrackMove(this._getDisc(), src, dst).groups.map(g => ({
                title: g.title,
                fullWidthTitle: g.fullWidthTitle,
                index: g.index,
                tracksIdx: g.tracks.map(t => t.index),
            }));
        }
    }

    async wipeDisc() {
        this._tracks = [];
        await this.wipeDiscTitleInfo();
    }

    async ejectDisc() {
        console.log('Disc ejected!');
    }

    async wipeDiscTitleInfo() {
        this._groupsDef = [
            {
                index: 0,
                title: null,
                fullWidthTitle: null,
                tracksIdx: this._tracks.map(t => t.index),
            },
        ];
        this._discTitle = '';
        this._fullWidthDiscTitle = '';
    }

    async upload(
        title: string,
        fullWidthTitle: string,
        data: ArrayBuffer,
        format: Codec,
        progressCallback: (progress: { written: number; encrypted: number; total: number }) => void
    ) {
        progressCallback({ written: 0, encrypted: 0, total: 100 });

        const halfWidthTitle = sanitizeHalfWidthTitle(title);
        fullWidthTitle = sanitizeFullWidthTitle(fullWidthTitle);

        if ((data as any).buffer !== undefined) {
            throw new Error(`Passing Uint8Array as ArrayBuffer to upload()!`);
        }

        if (this._getTracksTitlesLength() + title.length > this._tracksTitlesMaxLength) {
            throw new Error(`Track's title too long`); // Simulates reject from device
        }

        const totalSteps = 3;
        for (let step = 0; step <= totalSteps; step++) {
            const written = (100 / totalSteps) * step;
            progressCallback({ written, encrypted: 100, total: 100 });
            await sleep(1000);
        }

        const newTrack = {
            title: halfWidthTitle,
            duration: 5 * 60,
            encoding: JSON.parse(JSON.stringify(format)),
            index: this._tracks.length,
            protected: TrackFlag.unprotected,
            channel: 0,
            fullWidthTitle: fullWidthTitle,
        } as Track;
        this._tracks.push(newTrack);
        this._groupsDef[0].tracksIdx.push(newTrack.index);

        await sleep(1000);
        progressCallback({ written: 100, encrypted: 100, total: 100 });
    }

    async download(index: number, progressCallback: (progress: { read: number; total: number }) => void) {
        return null;
    }

    @asyncMutex
    async play() {
        this._status.state = 'playing';
    }

    @asyncMutex
    async pause() {
        this._status.state = 'paused';
    }

    @asyncMutex
    async stop() {
        this._status.state = 'ready';
    }

    @asyncMutex
    async next() {
        if (this._status.track === null) {
            return;
        }
        this._status.track = Math.min(this._status.track + 1, this._tracks.length - 1) % this._tracks.length;
    }

    @asyncMutex
    async prev() {
        if (this._status.track === null) {
            return;
        }
        this._status.track = Math.max(this._status.track - 1, 0) % this._tracks.length;
    }

    async gotoTrack(index: number) {
        this._status.track = index;
        await sleep(500);
    }

    async gotoTime(index: number, hour = 0, minute = 0, second = 0, frame = 0) {
        this._status.track = index;
        await sleep(500);
    }

    async getPosition() {
        if (this._status.track === null || this._status.time === null) {
            return null;
        }
        return [this._status.track, 0, this._status.time.minute, this._status.time.second, this._status.time.frame];
    }

    getRemainingCharactersForTitles(disc: Disc) {
        return getRemainingCharactersForTitles(convertDiscToNJS(disc));
    }

    getCharactersForTitle(track: Track) {
        const { halfWidth, fullWidth } = getCellsForTitle(convertTrackToNJS(track));
        return {
            halfWidth: halfWidth * 7,
            fullWidth: fullWidth * 7,
        };
    }

    async factory() {
        return new NetMDFactoryMockService();
    }

    async flush(): Promise<void> {}
    async himdRenameTrack(
        index: number,
        newName: { title?: string | undefined; album?: string | undefined; artist?: string | undefined }
    ): Promise<void> {}
}
class NetMDFactoryMockService implements NetMDFactoryService {
    async prepareDownload(): Promise<void> {}
    async finalizeDownload(): Promise<void> {}
    async setDiscSwapDetection(enable: boolean): Promise<void> {}
    async uploadSP(
        title: string,
        fullWidthTitle: string,
        mono: boolean,
        data: ArrayBuffer,
        progressCallback: (progress: { written: number; encrypted: number; total: number }) => void
    ): Promise<number> {
        return 0;
    }
    async finalizeSPUpload(tracks: { index: number; channels: 1 | 2 }[]): Promise<void> {}
    async getExploitCapabilities() {
        return [ExploitCapability.downloadAtrac];
    }

    mutex = new Mutex();
    // prettier-ignore
    utoc = [
        new Uint8Array(Buffer.from(`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`, 'base64')),
        new Uint8Array(Buffer.from(`QCggEAAAjjpsMJjOAAMBEQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfAAcdAQkNDhEUFxgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEknbSB3YWkDXldBU1VSRQJaQUtJXgAAAHRpbmcgZm8EciB5b3UvRwVBUk5FVCBDBlJPVwAAAAAAXllVVURVSwhJWU9eAAAAAF5LSU1JV08KS0FaQVJVSAtBTkFXT1NBDEtBU09VXgAAVQAAAAAAAABeQk9LVVJBD0RBS0VOT00QSVJBSV4AAABeS09OT0hVEllVTk9TSVITT1NBTkleAABwaWN0dXJlFSBvZiB3b3IWbGQAAAAAAABTa3kAAAAAAF5LSU1JIFQZVVJFU0FSVRpUT0tJTk9PG1RPRFVSRVccT14AAAAAAABeVFVNRVRBHklLQUdFXgAAAAAAAAAAACAAAAAAAAAAIQAAAAAAAAAiAAAAAAAAACMAAAAAAAAAJAAAAAAAAAAlAAAAAAAAACYAAAAAAAAAJwAAAAAAAAAoAAAAAAAAACkAAAAAAAAAKgAAAAAAAAArAAAAAAAAACwAAAAAAAAALQAAAAAAAAAuAAAAAAAAAC8AAAAAAAAAMAAAAAAAAAAxAAAAAAAAADIAAAAAAAAAMwAAAAAAAAA0AAAAAAAAADUAAAAAAAAANgAAAAAAAAA3AAAAAAAAADgAAAAAAAAAOQAAAAAAAAA6AAAAAAAAADsAAAAAAAAAPAAAAAAAAAA9AAAAAAAAAD4AAAAAAAAAPwAAAAAAAABAAAAAAAAAAEEAAAAAAAAAQgAAAAAAAABDAAAAAAAAAEQAAAAAAAAARQAAAAAAAABGAAAAAAAAAEcAAAAAAAAASAAAAAAAAABJAAAAAAAAAEoAAAAAAAAASwAAAAAAAABMAAAAAAAAAE0AAAAAAAAATgAAAAAAAABPAAAAAAAAAFAAAAAAAAAAUQAAAAAAAABSAAAAAAAAAFMAAAAAAAAAVAAAAAAAAABVAAAAAAAAAFYAAAAAAAAAVwAAAAAAAABYAAAAAAAAAFkAAAAAAAAAWgAAAAAAAABbAAAAAAAAAFwAAAAAAAAAXQAAAAAAAABeAAAAAAAAAF8AAAAAAAAAYAAAAAAAAABhAAAAAAAAAGIAAAAAAAAAYwAAAAAAAABkAAAAAAAAAGUAAAAAAAAAZgAAAAAAAABnAAAAAAAAAGgAAAAAAAAAaQAAAAAAAABqAAAAAAAAAGsAAAAAAAAAbAAAAAAAAABtAAAAAAAAAG4AAAAAAAAAbwAAAAAAAABwAAAAAAAAAHEAAAAAAAAAcgAAAAAAAABzAAAAAAAAAHQAAAAAAAAAdQAAAAAAAAB2AAAAAAAAAHcAAAAAAAAAeAAAAAAAAAB5AAAAAAAAAHoAAAAAAAAAewAAAAAAAAB8AAAAAAAAAH0AAAAAAAAAfgAAAAAAAAB/AAAAAAAAAIAAAAAAAAAAgQAAAAAAAACCAAAAAAAAAIMAAAAAAAAAhAAAAAAAAACFAAAAAAAAAIYAAAAAAAAAhwAAAAAAAACIAAAAAAAAAIkAAAAAAAAAigAAAAAAAACLAAAAAAAAAIwAAAAAAAAAjQAAAAAAAACOAAAAAAAAAI8AAAAAAAAAkAAAAAAAAACRAAAAAAAAAJIAAAAAAAAAkwAAAAAAAACUAAAAAAAAAJUAAAAAAAAAlgAAAAAAAACXAAAAAAAAAJgAAAAAAAAAmQAAAAAAAACaAAAAAAAAAJsAAAAAAAAAnAAAAAAAAACdAAAAAAAAAJ4AAAAAAAAAnwAAAAAAAACgAAAAAAAAAKEAAAAAAAAAogAAAAAAAACjAAAAAAAAAKQAAAAAAAAApQAAAAAAAACmAAAAAAAAAKcAAAAAAAAAqAAAAAAAAACpAAAAAAAAAKoAAAAAAAAAqwAAAAAAAACsAAAAAAAAAK0AAAAAAAAArgAAAAAAAACvAAAAAAAAALAAAAAAAAAAsQAAAAAAAACyAAAAAAAAALMAAAAAAAAAtAAAAAAAAAC1AAAAAAAAALYAAAAAAAAAtwAAAAAAAAC4AAAAAAAAALkAAAAAAAAAugAAAAAAAAC7AAAAAAAAALwAAAAAAAAAvQAAAAAAAAC+AAAAAAAAAL8AAAAAAAAAwAAAAAAAAADBAAAAAAAAAMIAAAAAAAAAwwAAAAAAAADEAAAAAAAAAMUAAAAAAAAAxgAAAAAAAADHAAAAAAAAAMgAAAAAAAAAyQAAAAAAAADKAAAAAAAAAMsAAAAAAAAAzAAAAAAAAADNAAAAAAAAAM4AAAAAAAAAzwAAAAAAAADQAAAAAAAAANEAAAAAAAAA0gAAAAAAAADTAAAAAAAAANQAAAAAAAAA1QAAAAAAAADWAAAAAAAAANcAAAAAAAAA2AAAAAAAAADZAAAAAAAAANoAAAAAAAAA2wAAAAAAAADcAAAAAAAAAN0AAAAAAAAA3gAAAAAAAADfAAAAAAAAAOAAAAAAAAAA4QAAAAAAAADiAAAAAAAAAOMAAAAAAAAA5AAAAAAAAADlAAAAAAAAAOYAAAAAAAAA5wAAAAAAAADoAAAAAAAAAOkAAAAAAAAA6gAAAAAAAADrAAAAAAAAAOwAAAAAAAAA7QAAAAAAAADuAAAAAAAAAO8AAAAAAAAA8AAAAAAAAADxAAAAAAAAAPIAAAAAAAAA8wAAAAAAAAD0AAAAAAAAAPUAAAAAAAAA9gAAAAAAAAD3AAAAAAAAAPgAAAAAAAAA+QAAAAAAAAD6AAAAAAAAAPsAAAAAAAAA/AAAAAAAAAD9AAAAAAAAAP4AAAAAAAAA/wAAAAAAAAAA`, 'base64')),
        new Uint8Array(Buffer.from(`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`, 'base64')),
        new Uint8Array(Buffer.from(`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`, 'base64')),
        new Uint8Array(Buffer.from(`UABAAgAAkACAAAIQ/8sAEQAAAAAAAAAATUlOST4NAAAIzAABAAIAAAADAAAAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, 'base64')),
        new Uint8Array(2352),
    ];

    async getDeviceFirmware() {
        return 'Mock Firmware';
    }

    async readUTOCSector(index: number) {
        return this.utoc[index] ?? new Uint8Array(Array(2352).fill(0));
    }

    async writeUTOCSector(index: number, data: Uint8Array) {
        this.utoc[index] = new Uint8Array(data);
    }

    async runTetris(): Promise<void> {}

    async flushUTOCCacheToDisc() {}

    async readFirmware(callback: (progress: { type: 'RAM' | 'ROM'; readBytes: number; totalBytes: number }) => void) {
        return {
            ram: new Uint8Array(Buffer.from('***MOCK DATA***')),
            rom: new Uint8Array(Buffer.from('***MOCK DATA***')),
        };
    }

    async readRAM(callback?: (progress: { readBytes: number; totalBytes: number }) => void): Promise<Uint8Array> {
        return new Uint8Array(Buffer.from('***MOCK DATA***'));
    }

    async exploitDownloadTrack(
        track: number,
        nerawDownload: boolean,
        callback: (data: { read: number; total: number; action: 'READ' | 'SEEK' | 'CHUNK'; sector?: string }) => void,
        config?: any
    ): Promise<{ data: Uint8Array, extension: string }> {
        return Promise.resolve({
            extension: 'bin',
            data: new Uint8Array(Buffer.from('***MOCK DATA***'))
        });
    }

    async setSPSpeedupActive(newState: boolean) {}
    async enableHiMDFullMode(): Promise<void> {}
    async enableMonoUpload(enable: boolean): Promise<void> {}
    async enterServiceMode(): Promise<void> {}
}

export { NetMDMockService };
