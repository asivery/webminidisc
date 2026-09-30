import type { Disc } from './services/interfaces/netmd';
import { ChineseConversion, toChinese } from './title-conversion';

export const csvHeader = [
    'INDEX',
    'GROUP RANGE',
    'GROUP NAME',
    'GROUP FULL WIDTH NAME',
    'NAME',
    'FULL WIDTH NAME',
    'HIMD ALBUM',
    'HIMD ARTIST',
    'DURATION',
    'ENCODING',
    'BITRATE',
];
const oldHeader = [...csvHeader.slice(0, 6), 'DURATION', 'ENCODING'];

export interface CsvTitle {
    id: string;
    label: string;
    unicodeTitle: string;
    title: string;
    fullWidthTitle: string;
}
export interface CsvRecord {
    index: number;
    groupRange: string;
    titleId: string;
    duration: number;
    codec: string;
    bitrate: string;
    album: string;
    artist: string;
}
export interface CsvTitleDraft {
    filename: string;
    titles: CsvTitle[];
    records: CsvRecord[];
}

function makeTitle(id: string, label: string, title: string, fullWidthTitle: string): CsvTitle {
    return { id, label, title, fullWidthTitle, unicodeTitle: fullWidthTitle || title };
}

export function parseTitleCSV(text: string, filename = ''): CsvTitleDraft {
    const rows = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((row) => row.trim() !== '')
        .map((row) => row.split(/(?<!\\),/g).map((cell) => cell.replace(/\\,/g, ',')));
    if (!rows.length) throw new Error('Empty CSV file.');
    const header = rows.shift()!.map((cell) => cell.trim());
    const legacy = header.length === oldHeader.length && header.every((cell, i) => cell === oldHeader[i]);
    if (
        !legacy &&
        (header.length !== csvHeader.length ||
            header.some((cell, i) => cell !== csvHeader[i] && !(i === 6 && cell === 'ALBUM') && !(i === 7 && cell === 'ARTIST')))
    ) {
        throw new Error('Malformed CSV header. Expected the current or legacy title CSV format.');
    }
    if (!rows.length) throw new Error('CSV is missing its disc row.');
    const titles: CsvTitle[] = [];
    const records: CsvRecord[] = [];
    const indices = new Set<number>();
    const groups = new Map<string, CsvTitle>();
    const groupRanges: [number, number][] = [];
    for (const [rowNumber, raw] of rows.entries()) {
        const fail = (message: string): never => {
            throw new Error(`CSV row ${rowNumber + 2}: ${message}`);
        };
        if (raw.length !== header.length) fail(`expected ${header.length} columns, found ${raw.length}.`);
        const cells = [...raw];
        if (legacy) {
            cells.splice(6, 0, '', '');
            cells.push('');
        }
        const [sIndex, rawRange, groupName, groupFullWidthName, name, fwName, album, artist, sDuration, codec, bitrate] = cells;
        const index = Number(sIndex);
        if (!/^\d+$/.test(sIndex) || !Number.isSafeInteger(index) || index >= rows.length || indices.has(index)) {
            fail('invalid or duplicate track index.');
        }
        if ((rowNumber === 0) !== (index === 0)) fail('the first data row must be the disc (INDEX 0).');
        indices.add(index);
        const duration = Number(sDuration);
        if (!sDuration.trim() || !Number.isFinite(duration) || duration < 0) fail('invalid duration.');
        if (index > 0 && !codec.trim()) fail('missing track encoding.');
        if (bitrate !== '' && (!/^\d+$/.test(bitrate) || !Number.isSafeInteger(Number(bitrate)))) fail('invalid bitrate.');
        const groupRange = rawRange.replace(/ /g, '');
        if (index === 0) {
            if (groupRange !== '' && groupRange !== '0-0') fail('invalid disc group range.');
        } else if (groupRange) {
            if (!/^\d+-\d+$/.test(groupRange)) fail('invalid group range.');
            const [start, end] = groupRange.split('-').map(Number);
            if (
                !Number.isSafeInteger(start) ||
                !Number.isSafeInteger(end) ||
                start > end ||
                end >= rows.length - 1 ||
                index - 1 < start ||
                index - 1 > end ||
                groupRange !== `${start}-${end}`
            )
                fail('group range is outside the CSV tracks.');
            const existing = groups.get(groupRange);
            if (existing) {
                if (existing.title !== groupName || existing.fullWidthTitle !== groupFullWidthName)
                    fail('conflicting titles for the same group.');
            } else {
                if (groupRanges.some(([a, b]) => start <= b && end >= a)) fail('overlapping group ranges.');
                groupRanges.push([start, end]);
                const group = makeTitle(`group:${groupRange}`, `Group ${start + 1}–${end + 1}`, groupName, groupFullWidthName);
                groups.set(groupRange, group);
                titles.push(group);
            }
        }
        const titleId = index === 0 ? 'disc' : `track:${index}`;
        titles.push(makeTitle(titleId, index === 0 ? 'Disc' : `Track ${index}`, name, fwName));
        records.push({ index, groupRange: index === 0 ? '' : groupRange, titleId, duration, codec, bitrate, album, artist });
    }
    for (const record of records.filter((record) => record.index > 0)) {
        for (const [start, end] of groupRanges) {
            if (record.index - 1 >= start && record.index - 1 <= end && record.groupRange !== `${start}-${end}`) {
                throw new Error(`Track ${record.index} has an inconsistent group range.`);
            }
        }
    }
    return { filename, titles, records };
}

export function createTitleCSV(disc: Disc, conversion: ChineseConversion = 'none'): { document: string; filename: string } {
    const rows: string[][] = [['0', '0-0', '', '', disc.title ?? '', disc.fullWidthTitle ?? '', '', '', String(disc.used), '', '']];
    for (const group of disc.groups) {
        const start = Math.min(...group.tracks.map((track) => track.index));
        const end = Math.max(...group.tracks.map((track) => track.index));
        for (const track of group.tracks) {
            rows.push([
                String(track.index + 1),
                group.title === null ? '' : `${start}-${end}`,
                group.title ?? '',
                group.fullWidthTitle ?? '',
                track.title ?? '',
                track.fullWidthTitle ?? '',
                track.album ?? '',
                track.artist ?? '',
                String(track.duration),
                track.encoding.codec,
                track.encoding.bitrate?.toString() ?? '',
            ]);
        }
    }
    const document = [
        csvHeader,
        ...rows.map((row) => row.map((cell, column) => (column >= 2 && column <= 7 ? toChinese(cell, conversion) : cell))),
    ]
        .map((row) => row.map((cell) => cell.replace(/,/g, '\\,')).join(','))
        .join('\n');
    const title = disc.title ? disc.title + (disc.fullWidthTitle ? ` (${disc.fullWidthTitle})` : '') : disc.fullWidthTitle || 'Disc';
    return { document, filename: toChinese(title, conversion) + '.csv' };
}
