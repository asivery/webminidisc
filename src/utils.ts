import { AppDispatch, RootState } from './redux/store';
import { Mutex } from 'async-mutex';
import * as mm from 'music-metadata-browser';
import { Disc, Group, Track } from './services/interfaces/netmd';
import { createWorker } from '@ffmpeg/ffmpeg';
import { ForcedEncodingFormat } from './redux/convert-dialog-feature';
import { HiMDKBPSToFrameSize } from 'himd-js';
import { ExportParams } from './services/audio/audio-export';

export type Promised<R> = R extends Promise<infer Q> ? Q : never;

export const acceptedTypes = {
    "audio/*": [],
    "video/mp4": [],
    "video/webm": [],
    'video/x-matroska': [],
    "application/octet-stream": [".oma", ".at3", ".aea"],
}

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

export interface AdaptiveFile {
    name: string;

    title: string;
    album: string;
    artist: string;
    duration: number;
    getForEncoding(encoding: ExportParams): Promise<ArrayBuffer>;
}

export type TitledFile = {
    file: File | AdaptiveFile;
    title: string;
    fullWidthTitle: string;
    forcedEncoding: ForcedEncodingFormat;
    bytesToSkip: number;
    artist: string;
    album: string;
};

export async function getMetadataFromFile(
    file: File
): Promise<{ title: string; artist: string; album: string; duration: number; bitrate: number }> {
    // Parse AEAs / ATRAC wavs
    if (file.name.toLowerCase().endsWith('.aea')) {
        // Is most likely an AEA
        const channelCount = await getChannelsFromAEA(file);
        if (channelCount !== null) {
            const dataSectionLength = file.size - 2048;
            const soundGroupsCount = dataSectionLength / 212;
            const totalSecondsOfAudio = (soundGroupsCount * 11.6) / 1000 / channelCount;
            const titleBytes = new Uint8Array((await file.arrayBuffer()).slice(4, 4 + 256));
            const firstNull = titleBytes.indexOf(0);
            const titleString = new TextDecoder('ascii').decode(titleBytes.slice(0, firstNull === -1 ? 256 : firstNull));
            return {
                title: titleString || removeExtension(file.name),
                artist: 'Unknown Artist',
                album: 'Unknown Album',
                duration: totalSecondsOfAudio,
                bitrate: channelCount === 1 ? 146 : 292,
            };
        }
    }

    let at3CodecInfo = await getATRACOMAEncoding(file);
    if (!at3CodecInfo) at3CodecInfo = await getATRACWAVEncoding(file);

    if (at3CodecInfo !== 'ILLEGAL' && at3CodecInfo !== null) {
        const dataSectionLengthKBits = ((file.size - at3CodecInfo.headerLength) * 8) / 1000;
        // Estimate duration from bitrate.
        const totalSecondsOfAudio = dataSectionLengthKBits / at3CodecInfo.format.bitrate;
        return {
            title: removeExtension(file.name),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: totalSecondsOfAudio,
            bitrate: at3CodecInfo.format.bitrate,
        };
    }

    try {
        const fileData = await file.arrayBuffer();
        const blob = new Blob([new Uint8Array(fileData)]);
        const metadata = await mm.parseBlob(blob, { duration: true });
        const bitrate = (metadata.format.bitrate ?? 0) / 1000;
        const duration = metadata.format.duration ?? 0;
        const title = metadata.common.title ?? removeExtension(file.name); //Fallback to file name if there's no title in the metadata.
        const artist = metadata.common.artist ?? 'Unknown Artist';
        const album = metadata.common.album ?? 'Unknown Album';
        return { title, artist, album, duration, bitrate };
    } catch (ex) {
        console.log(ex);
        return {
            title: removeExtension(file.name),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: 0,
            bitrate: 0,
        };
    }
}

export async function getChannelsFromAEA(file: File) {
    if (file.size < 2048) return null; // Too short to be an AEA
    const channelsOffset = 4 /* Magic */ + 256 /* title */ + 4 /* soundgroups */;
    const channels = new Uint8Array((await file.arrayBuffer()).slice(channelsOffset, channelsOffset + 1))[0];
    if (channels !== 1 && channels !== 2) return null;
    return channels as 1 | 2;
}

export async function getATRACOMAEncoding(
    file: File
): Promise<{ format: { codec: 'AT3' | 'A3+'; bitrate: number }; headerLength: number } | 'ILLEGAL' | null> {
    const fileData = new Uint8Array(await file.arrayBuffer());
    if (file.size < 96) return null; // Too short to be an OMA

    let ea3Offset;
    if (Buffer.from(fileData.slice(0, 3)).toString() === 'ea3') {
        const tagLength = ((fileData[6] & 0x7f) << 21) | ((fileData[7] & 0x7f) << 14) | ((fileData[8] & 0x7f) << 7) | (fileData[9] & 0x7f);
        ea3Offset = tagLength + 10;
        if ((fileData[5] & 0x10) !== 0) {
            ea3Offset += 10;
        }
    } else {
        ea3Offset = 0;
    }
    const ea3Header = fileData.slice(ea3Offset, ea3Offset + 96);
    const headerLength = ea3Offset + 96;

    if (Buffer.from(ea3Header.slice(0, 4)).toString() !== 'EA3\x01') return null; // Not a valid OMA - invalid EA3 header

    if (ea3Header[5] !== 96) return null; // Invalid EA3 tag size;
    const encryptionType = (ea3Header[6] << 8) | ea3Header[7];
    if (encryptionType !== 0xffff && encryptionType !== 0xff80) {
        return 'ILLEGAL'; // It's an OMA, but encrypted.
    }
    const codecInfo = (ea3Header[33] << 16) | (ea3Header[34] << 8) | ea3Header[35];
    const codecType = ea3Header[32];
    if ([3, 4, 5].includes(codecType)) return null; // MP3 / LPCM / WMA - pass to ffmpeg.
    if (codecType !== 0 && codecType !== 1) return 'ILLEGAL'; // Unknown codec.
    // At this point, the OMA is known to be ATRAC3

    const sampleRateTable = [320, 441, 480, 882, 960, 0];
    const sampleRate = sampleRateTable[(codecInfo >> 13) & 7] * 100;
    if (sampleRate !== 44100) return 'ILLEGAL'; // Unknown sample rate.
    const frameSize = (codecInfo & 0x3ff) * 8;
    const jointStereo = (codecInfo >> 17) & 1;

    if (codecType === 0) {
        if (frameSize === 384 && jointStereo === 0) return { format: { codec: 'AT3', bitrate: 132 }, headerLength };
        if (frameSize === 304 && jointStereo === 0) return { format: { codec: 'AT3', bitrate: 105 }, headerLength };
        if (frameSize === 192 && jointStereo === 1) return { format: { codec: 'AT3', bitrate: 66 }, headerLength };
        return 'ILLEGAL';
    }

    for (const [_kbps, fSize] of Object.entries(HiMDKBPSToFrameSize.atrac3plus)) {
        const kbps = parseInt(_kbps);
        if (fSize === frameSize + 8 && jointStereo === 0) {
            return { format: { codec: 'A3+', bitrate: kbps }, headerLength };
        }
    }
    return 'ILLEGAL';
}

export async function getATRACWAVEncoding(
    file: File
): Promise<{ format: { codec: 'AT3' | 'A3+'; bitrate: number }; headerLength: number } | null> {
    const fileData = await file.arrayBuffer();
    if (file.size < 44) return null; // Too short to be a WAV

    if (Buffer.from(fileData.slice(0, 4)).toString() !== 'RIFF') return null; // Missing header part 1
    if (Buffer.from(fileData.slice(8, 16)).toString() !== 'WAVEfmt ') return null; // Missing header part 2

    const wavType = Buffer.from(fileData.slice(20, 22)).readUInt16LE(0);
    const channels = Buffer.from(fileData.slice(22, 24)).readUInt16LE(0);
    if ((wavType !== 0x270 && wavType !== 0xfffe) || channels !== 0x02) return null; // Not ATRAC3

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
            return { format: { codec: 'AT3', bitrate: 132 }, headerLength };
        case 152:
            return { format: { codec: 'AT3', bitrate: 105 }, headerLength };
        case 96:
            return { format: { codec: 'AT3', bitrate: 66 }, headerLength };
    }

    for (const [_kbps, fSize] of Object.entries(HiMDKBPSToFrameSize.atrac3plus)) {
        const kbps = parseInt(_kbps);
        if (fSize === bytesPerFrame * 2 && channels === 2) {
            return { format: { codec: 'A3+', bitrate: kbps }, headerLength };
        }
    }
    return null;
}

export async function sleepWithProgressCallback(ms: number, cb: (perc: number) => void) {
    let elapsedSecs = 1;
    const interval = setInterval(() => {
        elapsedSecs++;
        cb(Math.min(100, ((elapsedSecs * 1000) / ms) * 100));
    }, 1000);
    await sleep(ms);
    window.clearInterval(interval);
}

export function getPublicPathFor(script: string) {
    return `${import.meta.env.BASE_URL}${script}`;
}

export function savePreference(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadPreference<T>(key: string, defaultValue: T): T {
    const res = localStorage.getItem(key);
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

export function timeToSeekArgs(timeInSecs: number): number[] {
    let value = Math.round(timeInSecs); // ignore frames

    const s = value % 60;
    value = (value - s) / 60; // min

    const m = value % 60;
    value = (value - m) / 60; // hour

    const h = value;

    return [h, m, s, 0];
}

export function secondsToNormal(time: number): string {
    const negative = time < 0;
    const [h, m, s] = timeToSeekArgs(Math.abs(time));
    return `${negative ? '-' : ''}${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export type DisplayTrack = {
    index: number;
    title: string;
    fullWidthTitle: string;
    group: string | null;
    duration: number;
    encoding: string;

    album?: string;
    artist?: string;
};

export function pad(str: string | number, pad: string) {
    return (pad + str).slice(-pad.length);
}

export function formatTimeFromSeconds(seconds: number, withHours = true) {
    const s = seconds % 60;
    seconds = (seconds - s) / 60; // min

    const m = seconds % 60;
    seconds = (seconds - m) / 60; // hour

    const h = seconds;

    return (withHours ? `${pad(h, '00')}:` : '') + `${pad(m, '00')}:${pad(s, '00')}`;
}

export function getSortedTracks(disc: Disc | null): DisplayTrack[] {
    const tracks: DisplayTrack[] = [];
    if (disc !== null) {
        for (const group of disc.groups) {
            for (const track of group.tracks) {
                tracks.push({
                    index: track.index,
                    title: track.title ?? `Unknown Title`,
                    fullWidthTitle: track.fullWidthTitle ?? ``,
                    group: group.title ?? null,
                    encoding: track.encoding.codec,
                    duration: track.duration,

                    album: track.album,
                    artist: track.artist,
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
    const groupedList: Group[] = [];
    const ungroupedTracks = [...(disc.groups.find(n => n.title === null)?.tracks ?? [])];

    let lastIndex = 0;

    for (const group of disc.groups) {
        if (group.title === null) {
            continue; // Ungrouped tracks
        }
        const toCopy = group.tracks[0].index - lastIndex;
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
    const deleteMode = targetIndex === -1;

    if (deleteMode) {
        offset = -1;
        targetIndex = disc.trackCount;
    }

    const boundsStart = Math.min(trackIndex, targetIndex);
    const boundsEnd = Math.max(trackIndex, targetIndex);

    const allTracks = disc.groups
        .map(n => n.tracks)
        .reduce((a, b) => a.concat(b), [])
        .sort((a, b) => a.index - b.index)
        .filter(n => !deleteMode || n.index !== trackIndex);

    const groupBoundaries: {
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

    for (const group of groupBoundaries) {
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

    const newDisc: Disc = { ...disc };

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
    const allGrouped = newDisc.groups.map(n => n.tracks).reduce((a, b) => a.concat(b), []);
    const ungrouped = allTracks.filter(n => !allGrouped.includes(n));

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
    for (const num of numbers) {
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
    const url = URL.createObjectURL(buffer);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export function getTrackExtension(track: Track) {
    const fileExtMap: { [key in typeof track.encoding.codec]: string } = {
        SP: 'aea',
        MONO: 'aea',
        LP2: 'wav',
        LP4: 'wav',
        'A3+': 'oma',
        AT3: 'oma',
        MP3: 'mp3',
        PCM: 'wav',
    };
    const extension = fileExtMap[track.encoding.codec];
    return extension;
}

export function createDownloadTrackName(track: Track, useNERAWExtension?: boolean) {
    let title;
    const index = (track.index + 1).toString().padStart(2, '0');
    if (track.title) {
        title = `${index}. ${track.title}`;
        if (track.fullWidthTitle) {
            title += ` (${track.fullWidthTitle})`;
        }
    } else if (track.fullWidthTitle) {
        title = `${index}. ${track.fullWidthTitle}`;
    } else {
        title = `${index}. No title`;
    }
    const fileName = `${title}.${useNERAWExtension ? 'neraw' : getTrackExtension(track)}`;
    return fileName;
}

export function getTracks(disc: Disc): Track[] {
    const tracks: Track[] = [];
    for (const group of disc.groups) {
        for (const track of group.tracks) {
            tracks.push(track);
        }
    }
    return tracks;
}

export async function ffmpegTranscode(data: Uint8Array, inputFormat: string, outputParameters: string) {
    const ffmpegProcess = createWorker({
        logger: (payload: any) => {
            console.log(payload.action, payload.message);
        },
        corePath: getPublicPathFor('ffmpeg-core.js'),
        workerPath: getPublicPathFor('worker.min.js'),
    });
    await ffmpegProcess.load();

    await ffmpegProcess.write(`audio.${inputFormat}`, data);
    try {
        await ffmpegProcess.transcode(`audio.${inputFormat}`, `raw`, outputParameters);
    } catch (er) {
        console.log(er);
    }
    const output = (await ffmpegProcess.read(`raw`)).data;
    await ffmpegProcess.worker.terminate();
    return output;
}

export async function convertToWAV(data: Uint8Array, track: Track): Promise<Uint8Array> {
    const extension = getTrackExtension(track);
    return ffmpegTranscode(data, extension, '-f wav');
}

export function dispatchQueue(
    ...entries: ((dispatch: AppDispatch, getState: () => RootState) => Promise<void>)[]
): (dispatch: AppDispatch, getState: () => RootState) => Promise<void> {
    return async function (dispatch: AppDispatch, getState: () => RootState) {
        for (const entry of entries) {
            await entry(dispatch, getState);
        }
    };
}

declare let process: any;
