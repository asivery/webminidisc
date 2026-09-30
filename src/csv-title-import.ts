import type { CsvTitle, CsvTitleDraft } from './csv-titles';
import type { NetMDService } from './services/interfaces/netmd';
import { validateDeviceTitles } from './title-conversion';

export interface CsvImportOptions {
    usesHiMDTitles: boolean;
    supportsFullWidth: boolean;
    allowFullWidth: boolean;
}
export function validateCsvTitle(row: CsvTitle, options: CsvImportOptions) {
    if (options.usesHiMDTitles) return { titleError: '', fullWidthError: '', normalizedFullWidth: row.fullWidthTitle };
    const result = validateDeviceTitles(row.title, row.fullWidthTitle);
    if (row.fullWidthTitle && !options.supportsFullWidth)
        result.fullWidthError = 'This device does not support full-width titles. Clear this field to import.';
    else if (row.fullWidthTitle && !options.allowFullWidth)
        result.fullWidthError = 'Enable full-width title editing, or clear this field to import.';
    return result;
}

type ImportService = Pick<NetMDService, 'listContent' | 'wipeDiscTitleInfo' | 'renameDisc' | 'addGroup' | 'renameTrack'>;

// All prompts and validation run before the first device mutation.
export async function writeTitleCSV(
    draft: CsvTitleDraft,
    service: ImportService,
    options: CsvImportOptions,
    confirm: (message: string) => boolean,
    beforeWrite: () => void
): Promise<boolean> {
    const titles = new Map(
        draft.titles.map((row) => {
            const validation = validateCsvTitle(row, options);
            if (validation.titleError || validation.fullWidthError)
                throw new Error(`${row.label}: ${validation.titleError} ${validation.fullWidthError}`.trim());
            return [row.id, { ...row, fullWidthTitle: validation.normalizedFullWidth }] as const;
        })
    );
    const disc = await service.listContent();
    const tracks = new Map(disc.groups.flatMap((group) => group.tracks).map((track) => [track.index, track]));
    const trackRecords = draft.records.filter((record) => record.index > 0);
    if (
        disc.trackCount !== trackRecords.length &&
        !confirm(
            `The CSV file describes a disc with ${trackRecords.length} tracks.\nThe disc inserted has ${disc.trackCount} tracks.\nContinue importing?`
        )
    )
        return false;
    const accepted = [];
    for (const record of trackRecords) {
        const track = tracks.get(record.index - 1);
        if (!track) continue;
        if (
            Math.abs(track.duration - record.duration) >= 2 ||
            track.encoding.codec.toLowerCase() !== record.codec.toLowerCase() ||
            (record.bitrate !== '' && track.encoding.bitrate !== Number(record.bitrate))
        ) {
            if (
                !confirm(
                    `The CSV file describes track ${record.index} as duration ${record.duration}, ${record.codec}${record.bitrate ? ` (${record.bitrate} kbps)` : ''}.\n` +
                        `The actual track has duration ${track.duration}, ${track.encoding.codec}${track.encoding.bitrate === undefined ? '' : ` (${track.encoding.bitrate} kbps)`}.\nLabel it according to the file? Cancel skips this track.`
                )
            )
                continue;
        }
        accepted.push(record);
    }
    const discTitle = titles.get('disc');
    if (!discTitle) throw new Error('CSV is missing its disc title.');
    beforeWrite();
    await service.wipeDiscTitleInfo();
    await service.renameDisc(discTitle.title, discTitle.fullWidthTitle);
    const addedGroups = new Set<string>();
    for (const record of accepted) {
        if (record.groupRange && !addedGroups.has(record.groupRange)) {
            const group = titles.get(`group:${record.groupRange}`)!;
            const [start, csvEnd] = record.groupRange.split('-').map(Number);
            const end = Math.min(csvEnd, disc.trackCount - 1);
            await service.addGroup(start, end - start + 1, group.title, group.fullWidthTitle);
            addedGroups.add(record.groupRange);
        }
        const title = titles.get(record.titleId)!;
        if (options.usesHiMDTitles)
            await service.renameTrack(record.index - 1, { title: title.title, album: record.album, artist: record.artist });
        else await service.renameTrack(record.index - 1, title.title, title.fullWidthTitle);
    }
    return true;
}
