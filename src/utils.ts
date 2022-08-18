import { Disc, formatTimeFromFrames, Encoding, Group } from 'netmd-js';
import { useSelector, shallowEqual } from 'react-redux';
import { RootState } from './redux/store';
import { Mutex } from 'async-mutex';
import { Theme } from '@material-ui/core';
import * as mm from 'music-metadata-browser';

export function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function debounce<T extends Function>(func: T, timeout = 300): T {
    let timer: ReturnType<typeof setTimeout>;
    const debouncedFn = (...args: any) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func(...args);
        }, timeout);
    };
    return (debouncedFn as any) as T;
}

export function removeExtension(filename: string) {
    const extStartIndex = filename.lastIndexOf('.');
    if (extStartIndex > 0) {
        filename = filename.substring(0, extStartIndex);
    }
    return filename;
}

export type TitledFile = {
    file: File;
    title: string;
    fullWidthTitle: string;
    forcedEncoding: 'LP2' | 'LP4' | null;
    bytesToSkip: number;
};

export async function getMetadataFromFile(file: File) {
    try {
        const fileData = await file.arrayBuffer();
        const blob = new Blob([new Uint8Array(fileData)]);
        let metadata = await mm.parseBlob(blob, { duration: true });
        let duration = metadata.format.duration ?? 0;
        const title = metadata.common.title ?? removeExtension(file.name); //Fallback to file name if there's no title in the metadata.
        const artist = metadata.common.artist ?? 'Unknown Artist';
        const album = metadata.common.album ?? 'Unknown Album';
        return { title, artist, album, duration };
    } catch (ex) {
        console.log(ex);
        return {
            title: removeExtension(file.name),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: 0,
        };
    }
}

export async function getATRACOMAEncoding(file: File): Promise<{ format: 'LP2' | 'LP4'; headerLength: number } | 'ILLEGAL' | null> {
    const fileData = new Uint8Array(await file.arrayBuffer());
    if (file.size < 96) return null; // Too short to be an OMA

    let ea3Offset;

    if (Buffer.from(fileData.slice(0, 3)).toString() === 'ea3') {
        let tagLength = ((fileData[6] & 0x7f) << 21) | ((fileData[7] & 0x7f) << 14) | ((fileData[8] & 0x7f) << 7) | (fileData[9] & 0x7f);
        ea3Offset = tagLength + 10;
        if ((fileData[5] & 0x10) !== 0) {
            ea3Offset += 10;
        }
    } else {
        ea3Offset = 0;
    }
    let ea3Header = fileData.slice(ea3Offset, ea3Offset + 96);
    const headerLength = ea3Offset + 96;

    if (Buffer.from(ea3Header.slice(0, 4)).toString() !== 'EA3\x01') return null; // Not a valid OMA - invalid EA3 header

    if (ea3Header[5] !== 96) return null; // Invalid EA3 tag size;
    let encryptionType = (ea3Header[6] << 8) | ea3Header[7];
    if (encryptionType !== 0xffff && encryptionType !== 0xff80) {
        return 'ILLEGAL'; // It's an OMA, but encrypted.
    }
    let codecInfo = (ea3Header[33] << 16) | (ea3Header[34] << 8) | ea3Header[35];
    let codecType = ea3Header[32];
    if (codecType === 1) return 'ILLEGAL'; // ATRAC3Plus
    if ([3, 4, 5].includes(codecType)) return null; // MP3 / LPCM / WMA - pass to ffmpeg.
    if (codecType !== 0) return 'ILLEGAL'; // Unknown codec.
    // At this point, the OMA is known to be ATRAC3

    const sampleRateTable = [320, 441, 480, 882, 960, 0];
    const sampleRate = sampleRateTable[(codecInfo >> 13) & 7] * 100;
    if (sampleRate !== 44100) return 'ILLEGAL'; // Unknown sample rate.
    const frameSize = (codecInfo & 0x3ff) * 8;
    const jointStereo = (codecInfo >> 17) & 1;

    if (frameSize === 384 && jointStereo === 0) return { format: 'LP2', headerLength };
    if (frameSize === 192 && jointStereo === 1) return { format: 'LP4', headerLength };
    return 'ILLEGAL';
}

export async function getATRACWAVEncoding(file: File): Promise<{ format: 'LP2' | 'LP4'; headerLength: number } | null> {
    const fileData = await file.arrayBuffer();
    if (file.size < 44) return null; // Too short to be a WAV

    if (Buffer.from(fileData.slice(0, 4)).toString() !== 'RIFF') return null; // Missing header part 1
    if (Buffer.from(fileData.slice(8, 16)).toString() !== 'WAVEfmt ') return null; // Missing header part 2

    const wavType = Buffer.from(fileData.slice(20, 22)).readUInt16LE(0);
    const channels = Buffer.from(fileData.slice(22, 24)).readUInt16LE(0);
    if (wavType !== 0x270 || channels !== 0x02) return null; // Not ATRAC3

    let headerLength = 12;
    while (headerLength < fileData.byteLength) {
        const chunkType = Buffer.from(fileData.slice(headerLength, headerLength + 4)).toString();
        const chunkSize = Buffer.from(fileData.slice(headerLength + 4, headerLength + 8)).readUInt32LE(0);
        if (chunkType === 'data') {
            headerLength = headerLength + 8;
            break;
        } else {
            headerLength = headerLength + chunkSize + 8;
        }
    }

    const bytesSampleRate = Buffer.from(fileData.slice(24, 28)).readUInt32LE(0);
    const bytesPerFrame = Buffer.from(fileData.slice(32, 34)).readUInt16LE(0) / 2;
    if (bytesSampleRate !== 44100) return null;
    switch (bytesPerFrame) {
        case 192:
            return { format: 'LP2', headerLength };
        case 96:
            return { format: 'LP4', headerLength };
        default:
            return null;
    }
}

export async function sleepWithProgressCallback(ms: number, cb: (perc: number) => void) {
    let elapsedSecs = 1;
    let interval = setInterval(() => {
        elapsedSecs++;
        cb(Math.min(100, ((elapsedSecs * 1000) / ms) * 100));
    }, 1000);
    await sleep(ms);
    window.clearInterval(interval);
}

export function useShallowEqualSelector<TState = RootState, TSelected = unknown>(selector: (state: TState) => TSelected): TSelected {
    return useSelector(selector, shallowEqual);
}

export function debugEnabled() {
    return process.env.NODE_ENV === 'development';
}

export function getPublicPathFor(script: string) {
    return `${process.env.PUBLIC_URL}/${script}`;
}

export function savePreference(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadPreference<T>(key: string, defaultValue: T): T {
    let res = localStorage.getItem(key);
    if (res === null) {
        return defaultValue;
    } else {
        try {
            return JSON.parse(res) as T;
        } catch (e) {
            return defaultValue;
        }
    }
}

export function framesToSec(frames: number) {
    return frames / 512;
}

export function timeToSeekArgs(timeInSecs: number): number[] {
    let value = Math.round(timeInSecs); // ignore frames

    let s = value % 60;
    value = (value - s) / 60; // min

    let m = value % 60;
    value = (value - m) / 60; // hour

    let h = value;

    return [h, m, s, 0];
}

export function secondsToNormal(time: number): string {
    const [h, m, s] = timeToSeekArgs(time);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const EncodingName: { [k: number]: string } = {
    [Encoding.sp]: 'SP',
    [Encoding.lp2]: 'LP2',
    [Encoding.lp4]: 'LP4',
};

export type DisplayTrack = {
    index: number;
    title: string;
    fullWidthTitle: string;
    group: string | null;
    duration: string;
    encoding: string;
    durationInSecs: number;
};

export function getSortedTracks(disc: Disc | null) {
    let tracks: DisplayTrack[] = [];
    if (disc !== null) {
        for (let group of disc.groups) {
            for (let track of group.tracks) {
                tracks.push({
                    index: track.index,
                    title: track.title ?? `Unknown Title`,
                    fullWidthTitle: track.fullWidthTitle ?? ``,
                    group: group.title ?? null,
                    encoding: EncodingName[track.encoding],
                    duration: formatTimeFromFrames(track.duration, false),
                    durationInSecs: track.duration / 512, // CAVEAT: 1s = 512 frames
                });
            }
        }
    }
    tracks.sort((l, r) => l.index - r.index);
    return tracks;
}

export function getGroupedTracks(disc: Disc | null) {
    if (!disc) {
        return [];
    }
    let groupedList: Group[] = [];
    let ungroupedTracks = [...(disc.groups.find(n => n.title === null)?.tracks ?? [])];

    let lastIndex = 0;

    for (let group of disc.groups) {
        if (group.title === null) {
            continue; // Ungrouped tracks
        }
        let toCopy = group.tracks[0].index - lastIndex;
        groupedList.push({
            index: -1,
            title: null,
            fullWidthTitle: null,
            tracks: toCopy === 0 ? [] : ungroupedTracks.splice(0, toCopy),
        });
        lastIndex = group.tracks[group.tracks.length - 1].index + 1;
        groupedList.push(group);
    }
    groupedList.push({
        index: -1,
        title: null,
        fullWidthTitle: null,
        tracks: ungroupedTracks,
    });
    return groupedList;
}

export function recomputeGroupsAfterTrackMove(disc: Disc, trackIndex: number, targetIndex: number) {
    // Used for moving tracks in netmd-mock and deleting
    let offset = trackIndex > targetIndex ? 1 : -1;
    let deleteMode = targetIndex === -1;

    if (deleteMode) {
        offset = -1;
        targetIndex = disc.trackCount;
    }

    let boundsStart = Math.min(trackIndex, targetIndex);
    let boundsEnd = Math.max(trackIndex, targetIndex);

    let allTracks = disc.groups
        .map(n => n.tracks)
        .reduce((a, b) => a.concat(b), [])
        .sort((a, b) => a.index - b.index)
        .filter(n => !deleteMode || n.index !== trackIndex);

    let groupBoundaries: {
        name: string | null;
        fullWidthName: string | null;
        start: number;
        end: number;
    }[] = disc.groups
        .filter(n => n.title !== null)
        .map(group => ({
            name: group.title,
            fullWidthName: group.fullWidthTitle,
            start: group.tracks[0].index,
            end: group.tracks[0].index + group.tracks.length - 1,
        })); // Convert to a format better for shifting

    let anyChanges = false;

    for (let group of groupBoundaries) {
        if (group.start > boundsStart && group.start <= boundsEnd) {
            group.start += offset;
            anyChanges = true;
        }
        if (group.end >= boundsStart && group.end < boundsEnd) {
            group.end += offset;
            anyChanges = true;
        }
    }

    if (!anyChanges) return disc;

    let newDisc: Disc = { ...disc };

    // Convert back
    newDisc.groups = groupBoundaries
        .map(n => ({
            title: n.name,
            fullWidthTitle: n.fullWidthName,
            index: n.start,
            tracks: allTracks.slice(n.start, n.end + 1),
        }))
        .filter(n => n.tracks.length > 0);

    // Convert ungrouped tracks
    let allGrouped = newDisc.groups.map(n => n.tracks).reduce((a, b) => a.concat(b), []);
    let ungrouped = allTracks.filter(n => !allGrouped.includes(n));

    // Fix all the track indexes
    if (deleteMode) {
        for (let i = 0; i < allTracks.length; i++) {
            allTracks[i].index = i;
        }
    }

    if (ungrouped.length) newDisc.groups.unshift({ title: null, fullWidthTitle: null, index: 0, tracks: ungrouped });

    return newDisc;
}

export function isSequential(numbers: number[]) {
    if (numbers.length === 0) return true;
    let last = numbers[0];
    for (let num of numbers) {
        if (num === last) {
            ++last;
        } else return false;
    }
    return true;
}

export function asyncMutex(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // This is meant to be used only with classes having a "mutex" instance property
    const oldValue = descriptor.value;
    descriptor.value = async function (...args: any) {
        const mutex = (this as any).mutex as Mutex;
        const release = await mutex.acquire();
        try {
            return await oldValue.apply(this, args);
        } finally {
            release();
        }
    };
    return descriptor;
}

export function forAnyDesktop(theme: Theme) {
    return theme.breakpoints.up(600 + theme.spacing(2) * 2);
}

export function belowDesktop(theme: Theme) {
    return theme.breakpoints.down(600 + theme.spacing(2) * 2);
}

export function forWideDesktop(theme: Theme) {
    return theme.breakpoints.up(700 + theme.spacing(2) * 2) + ` and (min-height: 750px)`;
}

export function askNotificationPermission(): Promise<NotificationPermission> {
    // Adapted from: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
    function checkNotificationPromise() {
        try {
            Notification.requestPermission().then();
        } catch (e) {
            return false;
        }
        return true;
    }

    if (checkNotificationPromise()) {
        return Notification.requestPermission();
    } else {
        return new Promise(resolve => Notification.requestPermission(resolve));
    }
}

export function downloadBlob(buffer: Blob, fileName: string) {
    let url = URL.createObjectURL(buffer);
    let a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

declare let process: any;
