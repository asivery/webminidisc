import type { Font } from 'fontkit';
import type { LocalFontRef } from './model';
import type { GlyphFont } from './render';

export interface LocalFontData extends LocalFontRef {
    fullName: string;
    blob(): Promise<Blob>;
}
const available = new Map<string, LocalFontData>();
const cache = new Map<string, Promise<GlyphFont>>();
const previewCache = new Map<string, Promise<string | null>>();

/** Browser-only aliases keep each local face distinct without parsing its outline data. */
export function loadLocalFontPreview(data: LocalFontData): Promise<string | null> {
    const existing = previewCache.get(data.postscriptName);
    if (existing) return existing;
    const family = `md-local-preview-${previewCache.size}`;
    const pending = (async () => {
        try {
            const face = new FontFace(family, `local(${JSON.stringify(data.postscriptName)}), local(${JSON.stringify(data.fullName)})`);
            await face.load();
            document.fonts.add(face);
            return family;
        } catch {
            // A failed preview must not prevent selecting a font for outline rendering.
            return null;
        }
    })();
    previewCache.set(data.postscriptName, pending);
    return pending;
}

export async function listLocalFonts(postscriptNames?: string[]): Promise<LocalFontData[]> {
    const api = (window as unknown as { queryLocalFonts?: (options?: { postscriptNames: string[] }) => Promise<LocalFontData[]> })
        .queryLocalFonts;
    if (!api) throw new Error('此环境不支持本机字体访问，请使用 ElectronWMD 桌面应用');
    const fonts = await api.call(window, postscriptNames ? { postscriptNames } : undefined);
    fonts.forEach((font) => available.set(font.postscriptName, font));
    return fonts.sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));
}
export function adaptLocalFont(font: Font): GlyphFont {
    if (!Number.isFinite(font.unitsPerEm) || font.unitsPerEm <= 0) throw new Error('字体度量无效');
    const probe = [65, 97, 0x4e2d, 0x65e5, ...font.characterSet.slice(0, 256)];
    if (!probe.some((cp) => font.hasGlyphForCodePoint(cp) && font.glyphForCodePoint(cp).path.commands.length > 0)) {
        throw new Error('字体没有可用的矢量轮廓，请选择 TrueType / OpenType 字体');
    }
    return {
        hasChar: (char) => font.hasGlyphForCodePoint(char.codePointAt(0)!),
        getAdvanceWidth: (text, size) =>
            Array.from(text).reduce(
                (sum, char) => sum + (font.glyphForCodePoint(char.codePointAt(0)!).advanceWidth * size) / font.unitsPerEm,
                0
            ),
        getPath: (text, x, y, size) => {
            let cursor = x;
            const paths = Array.from(text)
                .map((char) => {
                    const glyph = font.glyphForCodePoint(char.codePointAt(0)!);
                    const scale = size / font.unitsPerEm;
                    const path = glyph.path.transform(scale, 0, 0, -scale, cursor, y).toSVG();
                    cursor += glyph.advanceWidth * scale;
                    return path;
                })
                .join(' ');
            return { toPathData: () => paths };
        },
    };
}
export function loadLocalFont(ref: LocalFontRef): Promise<GlyphFont> {
    const existing = cache.get(ref.postscriptName);
    if (existing) return existing;
    const pending = (async () => {
        const data = available.get(ref.postscriptName) || (await listLocalFonts([ref.postscriptName]))[0];
        if (!data || data.postscriptName !== ref.postscriptName) throw new Error(`本机缺少字体：${ref.family} · ${ref.style}`);
        const bytes = await (await data.blob()).arrayBuffer();
        const { create } = await import('fontkit');
        const parsed = create(new Uint8Array(bytes) as any);
        const font = 'fonts' in parsed ? parsed.getFont(ref.postscriptName) : parsed;
        if (!font) throw new Error('无法匹配字体样式');
        return adaptLocalFont(font);
    })().catch((error) => {
        cache.delete(ref.postscriptName);
        throw error;
    });
    cache.set(ref.postscriptName, pending);
    return pending;
}
