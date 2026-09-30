import { parseBlob } from 'music-metadata-browser';
import type { AdaptiveFile } from './utils';
import type { TitleFormatType } from './redux/convert-dialog-feature';

export type UnicodeTag = { title: string; artist: string; album: string; source: string };
export function formatUnicodeTag(tag: Pick<UnicodeTag, 'title' | 'artist' | 'album'>, format: TitleFormatType): string {
    switch (format) {
        case 'artist-title':
            return `${tag.artist} - ${tag.title}`;
        case 'title-artist':
            return `${tag.title} - ${tag.artist}`;
        case 'album-title':
            return `${tag.album} - ${tag.title}`;
        case 'artist-album-title':
            return `${tag.artist} - ${tag.album} - ${tag.title}`;
        default:
            return tag.title;
    }
}

export async function readUnicodeTag(file: File | AdaptiveFile): Promise<UnicodeTag> {
    if ('getForEncoding' in file) {
        return { title: file.title, artist: file.artist, album: file.album, source: `Library metadata: ${file.name}` };
    }
    // The parser decodes the encoding declared by the tag. Do not round-trip
    // decoded strings through SJIS, or guess at already corrupted text.
    const metadata = await parseBlob(file, { duration: false, skipCovers: true });
    if (!metadata.format.codec && !metadata.format.tagTypes?.length) {
        throw new Error('No readable audio metadata found in this file.');
    }
    const title = metadata.common.title;
    return {
        title: title || file.name.replace(/\.[^.]+$/, ''),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        source: title ? `Tag: ${file.name}` : `Filename (no Title tag): ${file.name}`,
    };
}
