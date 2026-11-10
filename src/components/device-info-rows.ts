import { bytesToHumanReadable, formatTimeFromSeconds, getTracks } from '../utils';
import { DeviceInfo, Disc, MinidiscSpec, Track } from '../services/interfaces/netmd';

const VENDOR_NAMES: Record<number, string> = {
    0x054c: 'Sony',
    0x04dd: 'Sharp',
};

export interface DeviceInfoRow {
    label: string;
    value: string;
}

export function formatUsbId(id: number) {
    return id.toString(16).toUpperCase().padStart(4, '0');
}

function describeDisc(disc: Disc | null, usesBytes: boolean) {
    if (!disc) return 'No disc';
    const size = usesBytes ? bytesToHumanReadable(disc.total) : `${Math.floor(disc.total / 60)} min`;
    const free = usesBytes ? bytesToHumanReadable(disc.left) : formatTimeFromSeconds(disc.left);
    const protection = disc.writeProtected ? 'write protected' : disc.writable ? 'writable' : 'read only';
    return `${size}, ${free} free, ${protection}`;
}

// Same naming as the badge in the track list: SP, MONO, LP2, LP4 on NetMD.
export function recordingModeName(track: Track, spec: MinidiscSpec | undefined) {
    const format = spec?.availableFormats.find(
        (e) => e.codec === track.encoding.codec && e.availableBitrates.includes(track.encoding.bitrate)
    );
    return format?.userFriendlyName ?? track.encoding.codec;
}

function describeTracks(disc: Disc | null, spec: MinidiscSpec | undefined) {
    if (!disc) return 'No disc';
    const tracks = getTracks(disc);
    if (tracks.length === 0) return 'Empty disc';
    const counts = new Map<string, number>();
    for (const track of tracks) {
        const mode = recordingModeName(track, spec);
        counts.set(mode, (counts.get(mode) ?? 0) + 1);
    }
    const total = `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`;
    if (counts.size === 1) return `${total}, all ${[...counts.keys()][0]}`;
    return `${total}: ${[...counts.entries()].map(([mode, n]) => `${n} ${mode}`).join(', ')}`;
}

export function buildDeviceInfoRows(
    deviceName: string,
    deviceInfo: DeviceInfo | null,
    disc: Disc | null,
    spec: MinidiscSpec | undefined
): DeviceInfoRow[] {
    const rows: DeviceInfoRow[] = [{ label: 'Model', value: deviceName || 'Unknown' }];
    if (deviceInfo) {
        rows.push({
            label: 'Manufacturer',
            value: VENDOR_NAMES[deviceInfo.vendorId] ?? `Unknown (${formatUsbId(deviceInfo.vendorId)})`,
        });
        rows.push({ label: 'USB ID', value: `${formatUsbId(deviceInfo.vendorId)}:${formatUsbId(deviceInfo.productId)}` });
    }
    rows.push({ label: 'Disc', value: describeDisc(disc, spec?.measurementUnits === 'bytes') });
    rows.push({ label: 'Tracks', value: describeTracks(disc, spec) });
    return rows;
}
