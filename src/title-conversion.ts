import { pinyin } from 'pinyin-pro';
import * as OpenCC from 'opencc-js';
import { encodeToSJIS, decodeFromSJIS, sanitizeFullWidthTitle, sanitizeHalfWidthTitle } from 'netmd-js/dist/utils';

export type PinyinSettings = { separator: ' ' | '-' | ''; letterCase: 'lower' | 'title' | 'upper' };
export const defaultPinyinSettings: PinyinSettings = { separator: ' ', letterCase: 'title' };
const preferenceKey = 'renamePinyinSettings.v1';

export function loadPinyinSettings(): PinyinSettings {
    try {
        return normalizePinyinSettings(JSON.parse(localStorage.getItem(preferenceKey) || 'null'));
    } catch {
        return { ...defaultPinyinSettings };
    }
}

export function savePinyinSettings(settings: PinyinSettings) {
    try {
        localStorage.setItem(preferenceKey, JSON.stringify(settings));
    } catch {
        // Settings still apply to the current dialog when storage is unavailable.
    }
}

export function normalizePinyinSettings(value: unknown): PinyinSettings {
    const settings = value as Partial<PinyinSettings> | null;
    return {
        separator: [' ', '-', ''].includes(settings?.separator as string) ? settings!.separator! : ' ',
        letterCase: ['lower', 'title', 'upper'].includes(settings?.letterCase as string) ? settings!.letterCase! : 'title',
    };
}

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });
const toJapanese = OpenCC.Converter({ from: 'cn', to: 'jp' });
const japaneseToSimplified = OpenCC.Converter({ from: 'jp', to: 'cn' });
const japaneseToTraditional = OpenCC.Converter({ from: 'jp', to: 't' });
export type ChineseConversion = 'none' | 'simplified' | 'traditional';

export function toChinese(text: string, conversion: ChineseConversion): string {
    if (conversion === 'simplified') return japaneseToSimplified(text);
    if (conversion === 'traditional') return japaneseToTraditional(text);
    return text;
}
// Construct at runtime because this project still targets ES5 syntax.
const hanRun = new RegExp('\\p{Script=Han}+', 'gu');

export function toPinyin(text: string, settings: PinyinSettings = defaultPinyinSettings): string {
    return text.replace(hanRun, (run) =>
        pinyin(toSimplified(run), { toneType: 'none', type: 'array', v: true })
            .map((syllable) => {
                if (settings.letterCase === 'upper') return syllable.toUpperCase();
                if (settings.letterCase === 'title') return syllable.charAt(0).toUpperCase() + syllable.slice(1);
                return syllable;
            })
            .join(settings.separator)
    );
}

export function toJIS(text: string): string {
    return normalizeFullWidth(toJapanese(text));
}

export function normalizeFullWidth(text: string): string {
    // justRemap deliberately avoids the library's lossy SJIS fallback.
    return sanitizeFullWidthTitle(text, true);
}

export function validateDeviceTitles(title: string, fullWidthTitle: string) {
    const normalizedFullWidth = normalizeFullWidth(fullWidthTitle);
    const unsupported = [
        ...new Set(
            Array.from(normalizedFullWidth).filter((character) => {
                const encoded = encodeToSJIS(character);
                return encoded.length !== 2 || decodeFromSJIS(encoded) !== character;
            })
        ),
    ];
    return {
        normalizedFullWidth,
        titleError: [
            Array.from(title).length > 120 ? 'Name exceeds the 120-character limit.' : '',
            sanitizeHalfWidthTitle(title) !== title
                ? 'Name contains unsupported characters. Put the original in Unicode and use To Pinyin, or edit this field.'
                : '',
        ]
            .filter(Boolean)
            .join(' '),
        fullWidthError: [
            Array.from(normalizedFullWidth).length > 105 ? 'Full-Width Name exceeds the 105-character limit.' : '',
            unsupported.length ? `Unsupported device characters: ${unsupported.join(' ')}. Edit or clear this field to save.` : '',
        ]
            .filter(Boolean)
            .join(' '),
    };
}
