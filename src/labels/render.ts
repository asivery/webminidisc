import * as opentype from 'opentype.js';
import bwipjs from 'bwip-js';
import { LabelProject, Design, Layer, Face, definition, boundText, textEffects, hasTextEffectSettings } from './model';
import { ExportPiece, ExportTarget, exportPieces, pieceGap, MARK_GAP, MARK_LENGTH } from './export-pieces';

export interface GlyphFont {
    hasChar(char: string): boolean;
    getAdvanceWidth(text: string, size: number, options?: { kerning: boolean }): number;
    getPath(text: string, x: number, y: number, size: number, options?: { kerning: boolean }): { toPathData(decimals?: number): string };
}
export type Fonts = { sans: GlyphFont; serif: GlyphFont; local?: Record<string, GlyphFont> };
let fontsPromise: Promise<Fonts> | undefined;
export function loadFonts(): Promise<Fonts> {
    if (!fontsPromise)
        fontsPromise = Promise.all(
            ['NotoSansCJKsc-Regular.otf', 'NotoSerifCJKsc-Regular.otf'].map(async (file) => {
                const response = await fetch(new URL(`label-fonts/${file}`, document.baseURI));
                if (!response.ok) throw new Error('离线字体加载失败');
                return opentype.parse(await response.arrayBuffer());
            })
        )
            .then(([sans, serif]) => ({ sans, serif }))
            .catch((e) => {
                fontsPromise = undefined;
                throw e;
            });
    return fontsPromise;
}
export const escapeXML = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const n = (x: number) => Number(x.toFixed(4));
export interface Rendered {
    width: number;
    height: number;
    body: string;
    warnings: string[];
    hits: { id: string; x: number; y: number; width: number; height: number; rotation: number }[];
}
export const svgDocument = (r: Pick<Rendered, 'width' | 'height' | 'body'>) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(r.width)}mm" height="${n(
        r.height
    )}mm" viewBox="0 0 ${n(r.width)} ${n(r.height)}">${r.body}</svg>`;

interface Glyph {
    char: string;
    bold: boolean;
    italic: boolean;
    size: number;
}
function glyphs(text: string, l: Layer, markdown: boolean): Glyph[][] {
    return text.split('\n').map((raw) => {
        let size = l.fontSize,
            bold = l.weight >= 600;
        if (markdown) {
            const h = raw.match(/^(#{1,3})\s+(.*)$/);
            if (h) {
                size *= 1.6 - h[1].length * 0.12;
                bold = true;
                raw = h[2];
            }
            raw = raw.replace(/^[-*]\s+/, '• ');
        }
        const chunks = markdown ? raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g) : [raw];
        return chunks.flatMap((chunk) => {
            const strong = markdown && chunk.startsWith('**') && chunk.endsWith('**');
            const em = markdown && !strong && chunk.startsWith('*') && chunk.endsWith('*');
            const code = markdown && chunk.startsWith('`') && chunk.endsWith('`');
            const value = strong ? chunk.slice(2, -2) : em || code ? chunk.slice(1, -1) : chunk;
            return Array.from(value).map((char) => ({ char, bold: bold || strong, italic: l.italic || em, size }));
        });
    });
}
export function textEffectPadding(l: Layer): number {
    if (!hasTextEffectSettings(l)) return 0;
    // The largest markdown heading is 1.48 times the base size. Allow for italic shear,
    // half the stroke width, and three blur standard deviations around the text box.
    const width = l.outlineWidth ?? l.fontSize * 1.48 * 0.035;
    const outline = l.outline ? width * (l.outlineDiffuse ? 2 : 0.5) * 1.25 : 0;
    return outline + (l.shadow ? textEffects(l).shadowDistance / Math.SQRT2 : 0);
}
export function textArtwork(text: string, l: Layer, fonts: Fonts, warnings: string[], key = `text-${++renderSequence}`): string {
    const custom = l.localFont && fonts.local?.[l.localFont.postscriptName];
    const font = custom || (l.font === 'serif' ? fonts.serif : fonts.sans);
    if (l.localFont && !custom)
        warnings.push(
            `${l.name}：缺少本机字体 ${l.localFont.family} · ${l.localFont.style}，暂用内置字体显示；请恢复字体或选择替代字体后导出`
        );
    const cols = l.binding === 'tracks' ? l.columns : 1;
    const colWidth = (l.width - (cols - 1) * 2) / cols;
    const lines: Glyph[][] = [];
    const advance = (g: Glyph) => (!l.localFont && l.font === 'mono' ? g.size : font.getAdvanceWidth(g.char, g.size, { kerning: false }));
    for (const line of glyphs(text, l, l.binding === 'credits' || l.binding === 'lyrics')) {
        let current: Glyph[] = [],
            width = 0;
        for (const g of line) {
            const a = advance(g);
            if (width + a > colWidth && current.length) {
                lines.push(current);
                current = [];
                width = 0;
            }
            current.push(g);
            width += a;
        }
        lines.push(current);
    }
    const perCol = Math.ceil(lines.length / cols);
    let result = '';
    const enhanced = hasTextEffectSettings(l);
    const shadows: string[] = [];
    const fills: string[] = [];
    const outlines = new Map<number, string[]>();
    for (let col = 0; col < cols; col++) {
        let y = 0;
        for (const line of lines.slice(col * perCol, (col + 1) * perCol)) {
            const size = Math.max(l.fontSize, ...line.map((g) => g.size));
            y += size;
            if (y > l.height + 0.001) {
                warnings.push(`${l.name}：文字超出区域，请缩小字号或增大文本框`);
                break;
            }
            const total = line.reduce((v, g) => v + advance(g), 0);
            let x = col * (colWidth + 2) + (l.align === 'center' ? (colWidth - total) / 2 : l.align === 'right' ? colWidth - total : 0);
            for (const g of line) {
                if (!font.hasChar(g.char) && g.char.trim()) warnings.push(`${l.name}：字体缺少字符 ${g.char}`);
                const path = font.getPath(g.char, 0, 0, g.size, { kerning: false }).toPathData(3);
                const transform = `translate(${n(x)} ${n(y)})${g.italic ? ' skewX(-12)' : ''}`;
                if (!enhanced) {
                    // Preserve the exact appearance and paint order of legacy projects.
                    const stroke = l.outline
                        ? `fill="none" stroke="${l.color}" stroke-width="${g.size * 0.035}"`
                        : `fill="${l.color}"${g.bold ? ` stroke="${l.color}" stroke-width="${g.size * 0.018}"` : ''}`;
                    if (l.shadow) result += `<path d="${path}" transform="translate(.18 .18) ${transform}" fill="#000000" opacity=".24"/>`;
                    result += `<path d="${path}" transform="${transform}" ${stroke}/>`;
                } else {
                    const effects = textEffects(l, g.size);
                    if (l.shadow) {
                        const offset = n(effects.shadowDistance / Math.SQRT2);
                        shadows.push(
                            `<path d="${path}" transform="translate(${offset} ${offset}) ${transform}" fill="${effects.shadowColor}"/>`
                        );
                    }
                    if (l.outline && effects.outlineWidth > 0) {
                        const paths = outlines.get(effects.outlineWidth) || [];
                        paths.push(
                            `<path d="${path}" transform="${transform}" fill="none" stroke="${effects.outlineColor}" stroke-width="${n(effects.outlineWidth)}" stroke-linejoin="round"/>`
                        );
                        outlines.set(effects.outlineWidth, paths);
                    }
                    if (!l.outline || !effects.outlineHollow)
                        fills.push(
                            `<path d="${path}" transform="${transform}" fill="${l.color}"${g.bold ? ` stroke="${l.color}" stroke-width="${g.size * 0.018}"` : ''}/>`
                        );
                }
                x += advance(g);
            }
            y += size * (l.lineHeight - 1);
        }
    }
    if (!enhanced) return result;
    let border = '';
    let index = 0;
    for (const [width, paths] of outlines) {
        if (l.outlineDiffuse) {
            const id = `${key}-glow-${index++}`;
            const padding = textEffectPadding(l);
            border += `<defs><filter id="${id}" filterUnits="userSpaceOnUse" x="${n(-padding)}" y="${n(-padding)}" width="${n(l.width + 2 * padding)}" height="${n(l.height + 2 * padding)}"><feGaussianBlur stdDeviation="${n(width / 2)}"/></filter></defs><g filter="url(#${id})">${paths.join('')}</g>`;
        } else border += paths.join('');
    }
    return `${shadows.length ? `<g opacity=".24">${shadows.join('')}</g>` : ''}${border}${fills.join('')}`;
}
let renderSequence = 0;
function rotation(l: Layer): string {
    // Quarter turns rotate the horizontal text box into a vertical physical box.
    if (l.rotation === 90) return `translate(${n(l.height)} 0) rotate(90)`;
    if (l.rotation === -90) return `translate(0 ${n(l.width)}) rotate(-90)`;
    return `rotate(${n(l.rotation)} ${n(l.width / 2)} ${n(l.height / 2)})`;
}
export function layerBounds(l: Layer) {
    const angle = (l.rotation * Math.PI) / 180;
    const cos = Math.cos(angle),
        sin = Math.sin(angle);
    const points = [
        [0, 0],
        [l.width, 0],
        [l.width, l.height],
        [0, l.height],
    ].map(([x, y]) => {
        if (l.rotation === 90) return [l.x + l.height - y, l.y + x];
        if (l.rotation === -90) return [l.x + y, l.y + l.width - x];
        return [
            l.x + l.width / 2 + (x - l.width / 2) * cos - (y - l.height / 2) * sin,
            l.y + l.height / 2 + (x - l.width / 2) * sin + (y - l.height / 2) * cos,
        ];
    });
    const x = Math.min(...points.map((p) => p[0])),
        y = Math.min(...points.map((p) => p[1]));
    return { x, y, width: Math.max(...points.map((p) => p[0])) - x, height: Math.max(...points.map((p) => p[1])) - y };
}
function layerArtwork(l: Layer, project: LabelProject, fonts: Fonts, warnings: string[], key: string, padding = 0): string {
    if (l.kind === 'text') return textArtwork(boundText(l, project.data), l, fonts, warnings, key);
    if (l.kind === 'image') {
        const a = project.assets[l.assetId || ''];
        if (!a) {
            warnings.push(`${l.name}：图片缺失`);
            return '';
        }
        const scale =
            l.fit === 'cover' ? Math.max(l.width / a.width, l.height / a.height) : Math.min(l.width / a.width, l.height / a.height);
        const w = (l.fit === 'stretch' ? l.width : a.width * scale) * l.zoom,
            h = (l.fit === 'stretch' ? l.height : a.height * scale) * l.zoom;
        if (a.mime !== 'image/svg+xml' && Math.min(a.width / w, a.height / h) * 25.4 < 200)
            warnings.push(`${l.name}：有效分辨率低于 200 DPI`);
        const x = (l.width - w) / 2 + l.offsetX,
            y = (l.height - h) / 2 + l.offsetY;
        const image = `<image href="${escapeXML(a.data)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"/>`;
        if (!padding) return image;
        // Repeat the outermost source pixel only where the source itself runs out.
        // The original image/crop stays untouched; the finished opaque panel covers everything except the bleed ring.
        // Adjacent pixel strips overlap 0.04 mm to prevent antialiased viewport seams in PDF.
        const patch = (dx: number, dy: number, dw: number, dh: number, sx: number, sy: number, sw: number, sh: number) =>
            dw > 0 && dh > 0
                ? `<svg x="${n(dx - 0.04)}" y="${n(dy - 0.04)}" width="${n(dw + 0.08)}" height="${n(dh + 0.08)}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none"><use href="#${key}-pixels"/></svg>`
                : '';
        const left = x <= 0.001 ? Math.max(0, x + padding) : 0;
        const right = x + w >= l.width - 0.001 ? Math.max(0, l.width + padding - x - w) : 0;
        const top = y <= 0.001 ? Math.max(0, y + padding) : 0;
        const bottom = y + h >= l.height - 0.001 ? Math.max(0, l.height + padding - y - h) : 0;
        return (
            `<defs><image id="${key}-pixels" href="${escapeXML(a.data)}" width="${a.width}" height="${a.height}" preserveAspectRatio="none"/></defs>` +
            `<svg x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" viewBox="0 0 ${a.width} ${a.height}"><use href="#${key}-pixels"/></svg>` +
            patch(x - left, y, left, h, 0, 0, 1, a.height) +
            patch(x + w, y, right, h, a.width - 1, 0, 1, a.height) +
            patch(x, y - top, w, top, 0, 0, a.width, 1) +
            patch(x, y + h, w, bottom, 0, a.height - 1, a.width, 1) +
            patch(x - left, y - top, left, top, 0, 0, 1, 1) +
            patch(x + w, y - top, right, top, a.width - 1, 0, 1, 1) +
            patch(x - left, y + h, left, bottom, 0, a.height - 1, 1, 1) +
            patch(x + w, y + h, right, bottom, a.width - 1, a.height - 1, 1, 1)
        );
    }
    if (l.kind === 'code') {
        try {
            let svg = bwipjs.toSVG({
                bcid: l.code,
                text: l.text || ' ',
                scale: 1,
                padding: 4,
                barcolor: l.color.slice(1),
                backgroundcolor: 'FFFFFF',
                includetext: l.code !== 'qrcode',
            });
            const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
            if (!viewBox) throw new Error('代码生成失败');
            svg = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
            return `<svg width="${l.width}" height="${l.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
        } catch (e) {
            warnings.push(`${l.name}：${e instanceof Error ? e.message : String(e)}`);
            return `<rect width="${l.width}" height="${l.height}" fill="#ffe0df"/>`;
        }
    }
    if (l.shape === 'ellipse')
        return `<ellipse cx="${l.width / 2}" cy="${l.height / 2}" rx="${l.width / 2}" ry="${l.height / 2}" fill="${l.color}"/>`;
    if (l.shape === 'rect')
        return `<rect x="${-padding}" y="${-padding}" width="${l.width + 2 * padding}" height="${l.height + 2 * padding}" fill="${l.color}"/>`;
    return `<defs><pattern id="${key}-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">${
        l.shape === 'dots' ? `<circle cx="2" cy="2" r=".5" fill="${l.color}"/>` : `<rect width="1" height="4" fill="${l.color}"/>`
    }</pattern></defs><rect x="${-padding}" y="${-padding}" width="${l.width + 2 * padding}" height="${l.height + 2 * padding}" fill="url(#${key}-pattern)"/>`;
}
export function renderDesign(
    project: LabelProject,
    d: Design,
    face: Face,
    fonts: Fonts,
    options: { panel?: string; piece?: number; separated?: boolean; guides?: boolean; sourceBleed?: number; strictFonts?: boolean } = {}
): Rendered {
    const def = definition(d),
        prefix = `md${++renderSequence}`;
    const warnings: string[] = [],
        hits: Rendered['hits'] = [];
    const selectedPanels = options.panel ? def.panels.filter((p) => p.id === options.panel) : def.panels;
    // sourceBleed is an internal, untrimmed background/image pass for export masks.
    // Normal editor/preview rendering never sees export bleed or marks.
    const b = options.sourceBleed || 0;
    let width = options.panel ? selectedPanels[0]?.width || def.width : def.width;
    let height = options.panel ? selectedPanels[0]?.height || def.height : def.height;
    let body = '';
    for (const p of selectedPanels) {
        let px = options.panel ? 0 : p.x,
            py = options.panel ? 0 : p.y;
        const key = `${prefix}-${p.id}`;
        const full = d.template === 'full' && p.id === 'main' && options.sourceBleed === undefined;
        const paths = full ? (options.piece !== undefined ? [p.clipPaths![options.piece]] : p.clipPaths!) : [];
        const panelShape = full
            ? `${paths
                  .map((path) => `<path transform="scale(${p.width / p.clipViewBox![0]} ${p.height / p.clipViewBox![1]})" d="${path}"/>`)
                  .join('')}`
            : `<rect x="${-b}" y="${-b}" width="${p.width + 2 * b}" height="${p.height + 2 * b}"/>`;
        const contentWidth = p.artworkWidth ?? p.width,
            contentHeight = p.artworkHeight ?? p.height;
        let artwork = `<rect x="${-b}" y="${-b}" width="${contentWidth + 2 * b}" height="${contentHeight + 2 * b}" fill="${
            face === 'back' ? d.backBackground ?? d.background : d.background
        }"/>`;
        for (const l of d.layers.filter((l) => l.panel === p.id && l.face === face && l.visible)) {
            if (options.strictFonts && l.kind === 'text' && l.localFont && !fonts.local?.[l.localFont.postscriptName])
                throw new Error(`${l.name}：缺少字体 ${l.localFont.family} · ${l.localFont.style}，请加载原字体或明确选择替代字体后导出`);
            if (options.sourceBleed !== undefined && (l.kind === 'text' || l.kind === 'code')) continue;
            const bounds = layerBounds(l);
            if (
                bounds.x < def.safe ||
                bounds.y < def.safe ||
                bounds.x + bounds.width > contentWidth - def.safe ||
                bounds.y + bounds.height > contentHeight - def.safe
            ) {
                if (l.kind === 'text' || l.kind === 'code') warnings.push(`${l.name}：接近或越过裁切安全线`);
            }
            const hit =
                p.rotation === -90
                    ? {
                          x: bounds.y,
                          y: contentWidth - bounds.x - bounds.width,
                          width: bounds.height,
                          height: bounds.width,
                      }
                    : bounds;
            hits.push({ id: l.id, ...hit, x: px + hit.x, y: py + hit.y, rotation: l.rotation });
            const clip = `${key}-${l.id}`;
            const touchesEdge =
                bounds.x <= 0.001 ||
                bounds.y <= 0.001 ||
                bounds.x + bounds.width >= contentWidth - 0.001 ||
                bounds.y + bounds.height >= contentHeight - 0.001;
            const padding =
                l.kind === 'text'
                    ? textEffectPadding(l)
                    : b && touchesEdge && (l.kind === 'image' || (l.kind === 'shape' && l.shape !== 'ellipse'))
                      ? b * 2
                      : 0;
            artwork += `<g transform="translate(${n(l.x)} ${n(l.y)}) ${rotation(l)}" opacity="${l.opacity}"><defs><clipPath id="${clip}"><rect x="${-padding}" y="${-padding}" width="${l.width + 2 * padding}" height="${l.height + 2 * padding}"/></clipPath></defs><g clip-path="url(#${clip})">${layerArtwork(l, project, fonts, warnings, clip, padding)}</g></g>`;
        }
        if (p.rotation === -90) artwork = `<g transform="translate(0 ${contentWidth}) rotate(-90)">${artwork}</g>`;
        let panelBody = `<defs><clipPath id="${key}">${panelShape}</clipPath></defs><g clip-path="url(#${key})">${artwork}</g>`;
        if (options.guides)
            panelBody += `<g fill="none" stroke="#527975" stroke-width=".12">${panelShape}</g><rect x="1.5" y="1.5" width="${Math.max(
                0,
                p.width - 3
            )}" height="${Math.max(0, p.height - 3)}" fill="none" stroke="#527975" stroke-width=".12" stroke-dasharray=".5 1"/>`;
        body += `<g transform="translate(${px} ${py})">${panelBody}</g>`;
    }
    if (options.separated && d.template === 'full' && options.piece === undefined) {
        const main = def.panels[0];
        const parts = [0, 1, 2].map((piece) =>
            renderDesign(project, d, face, fonts, { panel: 'main', piece, guides: options.guides, strictFonts: options.strictFonts })
        );
        width = main.width * 3 + 8;
        height = main.height;
        body = parts.map((part, i) => `<g transform="translate(${i * (main.width + 4)} 0)">${part.body}</g>`).join('');
        hits.length = 0;
    }
    return { width, height, body, warnings: [...new Set(warnings)], hits };
}

function pieceShape(piece: ExportPiece): string {
    return piece.trimPath
        ? `<path d="${piece.trimPath}" transform="translate(${-piece.source.x} ${-piece.source.y})"/>`
        : `<rect width="${piece.source.width}" height="${piece.source.height}"/>`;
}
function pieceMarks(project: LabelProject, d: Design, piece: ExportPiece, rear: boolean): string {
    const s = project.print,
        w = piece.source.width,
        h = piece.source.height;
    const distance = s.bleed + MARK_GAP;
    let marks = '';
    if (s.crop) {
        if (piece.trimPath) marks += pieceShape(piece);
        else
            for (const [x, y, dx, dy] of [
                [0, 0, -1, -1],
                [w, 0, 1, -1],
                [0, h, -1, 1],
                [w, h, 1, 1],
            ])
                marks += `<path d="M${n(x + dx * distance)} ${n(y)}h${dx * MARK_LENGTH}M${n(x)} ${n(y + dy * distance)}v${dy * MARK_LENGTH}"/>`;
    }
    if (s.folds && piece.folded) {
        const def = definition(d);
        for (let f of def.folds) {
            if (def.foldAxis === 'x') {
                if (rear && s.flip === 'long') f = w - f;
                marks += `<path d="M${n(f)} ${-distance}v-${MARK_LENGTH}M${n(f)} ${n(h + distance)}v${MARK_LENGTH}" stroke-dasharray=".5 .5"/>`;
            } else {
                if (rear && s.flip === 'short') f = h - f;
                marks += `<path d="M${-distance} ${n(f)}h-${MARK_LENGTH}M${n(w + distance)} ${n(f)}h${MARK_LENGTH}" stroke-dasharray=".5 .5"/>`;
            }
        }
    }
    return marks ? `<g fill="none" stroke="#555555" stroke-width=".1">${marks}</g>` : '';
}
/** A background/image underpaint covers the expanded contour. Finished artwork is then
 * composited over it with its opaque panel background, preserving all interior colours,
 * opacity, text and geometry. No complementary mask seam crosses the trim edge. */
export function renderExportPiece(project: LabelProject, d: Design, face: Face, fonts: Fonts, piece: ExportPiece, rear = false): Rendered {
    const b = project.print.bleed,
        def = definition(d),
        key = `export${++renderSequence}`;
    const warnings: string[] = [];
    let original = '',
        extension = '';
    const panels = piece.panel ? def.panels.filter((p) => p.id === piece.panel) : def.panels;
    for (const p of panels) {
        const x = piece.panel ? -piece.source.x : rear && project.print.flip === 'long' ? def.width - p.x - p.width : p.x;
        const y = piece.panel ? -piece.source.y : rear && project.print.flip === 'short' ? def.height - p.y - p.height : p.y;
        const r = renderDesign(project, d, face, fonts, { panel: p.id, piece: piece.piece, strictFonts: true });
        warnings.push(...r.warnings);
        original += `<g transform="translate(${n(x)} ${n(y)})">${r.body}</g>`;
        if (b) {
            const rb = renderDesign(project, d, face, fonts, { panel: p.id, sourceBleed: b });
            // Adjacent packaging panels retain their original dividing line, including in
            // the exterior top/bottom bleed. Only outer edges extend, never internal folds.
            const left = piece.panel || x <= 0.001 ? b : 0;
            const top = piece.panel || y <= 0.001 ? b : 0;
            const right = piece.panel || x + p.width >= def.width - 0.001 ? b : 0;
            const bottom = piece.panel || y + p.height >= def.height - 0.001 ? b : 0;
            const clip = `${key}-${p.id}-exterior`;
            extension += `<g transform="translate(${n(x)} ${n(y)})"><defs><clipPath id="${clip}"><rect x="${-left}" y="${-top}" width="${p.width + left + right}" height="${p.height + top + bottom}"/></clipPath></defs><g clip-path="url(#${clip})">${rb.body}</g></g>`;
        }
    }
    const shape = pieceShape(piece),
        bounds = piece.bleedBounds;
    let body = '';
    if (b) {
        // Outward offset via a 2*b stroke. Paths are in mm, so resizing the artwork
        // cannot scale the bleed. Do not subtract the trim: every panel has an opaque
        // background, so finished artwork covers this underpaint completely. Subtraction
        // would produce white seams where Chromium antialiases the two adjoining clips.
        const expanded = piece.trimPath
            ? `<g fill="#ffffff" stroke="#ffffff" stroke-width="${2 * b}" stroke-linejoin="round">${shape}</g>`
            : `<rect x="${-b}" y="${-b}" width="${bounds.width}" height="${bounds.height}" fill="#ffffff"/>`;
        body += `<defs><mask id="${key}-bleed" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="${-b}" y="${-b}" width="${bounds.width}" height="${bounds.height}">${expanded}</mask></defs><g mask="url(#${key}-bleed)">${extension}</g>`;
    }
    body += `<defs><clipPath id="${key}-trim">${shape}</clipPath></defs><g clip-path="url(#${key}-trim)">${original}</g>`;
    body += pieceMarks(project, d, piece, rear);
    return {
        width: piece.footprint.width,
        height: piece.footprint.height,
        body: `<g transform="translate(${piece.inset} ${piece.inset})">${body}</g>`,
        warnings: [...new Set(warnings)],
        hits: [],
    };
}
export function renderExport(project: LabelProject, d: Design, face: Face, fonts: Fonts, target: ExportTarget = {}): Rendered {
    const pieces = exportPieces(d, project.print, target);
    let x = 0,
        height = 0,
        body = '';
    const warnings: string[] = [];
    pieces.forEach((piece, index) => {
        const r = renderExportPiece(project, d, face, fonts, piece, face === 'back' && d.duplex);
        body += `<g transform="translate(${n(x)} 0)">${r.body}</g>`;
        x += r.width + (index < pieces.length - 1 ? pieceGap(piece, pieces[index + 1], project.print.gap) : 0);
        height = Math.max(height, r.height);
        warnings.push(...r.warnings);
    });
    return { width: x, height, body, warnings: [...new Set(warnings)], hits: [] };
}
export interface PrintResult {
    pages: string[];
    paperSize: { width: number; height: number };
    warnings: string[];
}
export function printPages(project: LabelProject, fonts: Fonts): PrintResult {
    const s = project.print,
        margin = s.margin;
    const designs = s.templates.map((id) => project.designs[id]).filter((d): d is Design => !!d);
    if (!designs.length) throw new Error('请选择至少一个已有设计的模板');
    const isDuplex = (d: Design) => d.duplex && ['jcard', 'cover', 'tray'].includes(d.template);
    const duplex = designs.some(isDuplex);
    const items = designs.flatMap((d) => exportPieces(d, s).map((piece) => ({ d, piece })));
    const paperSize =
        s.paper === 'A4'
            ? { width: 210, height: 297 }
            : s.paper === 'Letter'
              ? { width: 215.9, height: 279.4 }
              : {
                    width: Math.max(...items.map((i) => i.piece.footprint.width)) + 2 * margin,
                    height: Math.max(...items.map((i) => i.piece.footprint.height)) + 2 * margin,
                };
    // Conservative shared gap also protects pieces in different shelf rows.
    const gap = Math.max(s.gap, ...items.map((i) => pieceGap(i.piece, i.piece, 0)));
    let x = margin,
        y = margin,
        rowH = 0,
        front = '',
        back = '';
    const pages: string[] = [],
        warnings: string[] = [];
    const calibration = () =>
        s.calibration
            ? [
                  [7, 7],
                  [paperSize.width - 7, 7],
                  [7, paperSize.height - 7],
                  [paperSize.width - 7, paperSize.height - 7],
              ]
                  .map(([x, y]) => `<path d="M${x - 3} ${y}h6M${x} ${y - 3}v6" fill="none" stroke="#000000" stroke-width=".2"/>`)
                  .join('')
            : '';
    const flush = () => {
        if (!front) return;
        pages.push(svgDocument({ ...paperSize, body: front + calibration() }));
        if (duplex) pages.push(svgDocument({ ...paperSize, body: back + calibration() }));
        front = '';
        back = '';
        x = margin;
        y = margin;
        rowH = 0;
    };
    for (let copy = 0; copy < s.copies; copy++)
        for (const { d, piece } of items) {
            const { width, height } = piece.footprint;
            if (width + 2 * margin > paperSize.width + 0.001 || height + 2 * margin > paperSize.height + 0.001)
                throw new Error(`${definition(d).name}（含出血及标记）超过纸张，请减少折页或选择自定义尺寸 PDF`);
            if (x + width > paperSize.width - margin + 0.001) {
                x = margin;
                y += rowH + gap;
                rowH = 0;
            }
            if (y + height > paperSize.height - margin + 0.001) flush();
            const r = renderExportPiece(project, d, 'front', fonts, piece);
            warnings.push(...r.warnings);
            front += `<g transform="translate(${n(x)} ${n(y)})">${r.body}</g>`;
            if (isDuplex(d)) {
                const bx = s.flip === 'long' ? paperSize.width - x - width : x;
                const by = s.flip === 'short' ? paperSize.height - y - height : y;
                const rb = renderExportPiece(project, d, 'back', fonts, piece, true);
                warnings.push(...rb.warnings);
                back += `<g transform="translate(${n(bx)} ${n(by)})">${rb.body}</g>`;
            }
            x += width + gap;
            rowH = Math.max(rowH, height);
        }
    flush();
    return { pages, paperSize, warnings: [...new Set(warnings)] };
}
