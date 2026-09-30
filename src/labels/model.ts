import type { Disc } from '../services/interfaces/netmd';
import { parseTitleCSV } from '../csv-titles';
import { toChinese, ChineseConversion } from '../title-conversion';

export type TemplateId = 'label' | 'full' | 'jcard' | 'cover' | 'tray';
export type Face = 'front' | 'back';
export type Binding = 'album' | 'artist' | 'tracks' | 'credits' | 'lyrics' | 'direction';
export interface LabelTrack {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number | null;
    group: string;
    original?: { title: string; fullWidthTitle: string; index: number };
}
export interface AlbumData {
    album: string;
    artist: string;
    credits: string;
    lyrics: string;
    direction: string;
    tracks: LabelTrack[];
    originalDisc?: { title: string; fullWidthTitle: string };
}
export interface Asset {
    id: string;
    name: string;
    mime: string;
    data: string;
    width: number;
    height: number;
}
export interface LocalFontRef {
    postscriptName: string;
    family: string;
    style: string;
}
export interface Layer {
    id: string;
    name: string;
    kind: 'text' | 'image' | 'shape' | 'code';
    panel: string;
    face: Face;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
    text: string;
    binding?: Binding;
    color: string;
    font: 'sans' | 'serif' | 'mono';
    localFont?: LocalFontRef;
    fontSize: number;
    weight: number;
    italic: boolean;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
    shadow: boolean;
    outline: boolean;
    outlineColor?: string;
    outlineWidth?: number;
    outlineDiffuse?: boolean;
    outlineHollow?: boolean;
    shadowColor?: string;
    shadowDistance?: number;
    columns: number;
    numbers: boolean;
    artists: boolean;
    durations: boolean;
    bullets: boolean;
    assetId?: string;
    fit: 'cover' | 'contain' | 'stretch';
    zoom: number;
    offsetX: number;
    offsetY: number;
    shape: 'rect' | 'ellipse' | 'stripe' | 'dots';
    code: 'qrcode' | 'ean13' | 'code128';
}
export interface Design {
    template: TemplateId;
    panels: number;
    frontWidth: number;
    foldWidth: number;
    spineWidth: number;
    flapWidth: number;
    height: number;
    sideWidth: number;
    sideHeight: number;
    orientation: 'left' | 'bottom';
    duplex: boolean;
    background: string;
    backBackground?: string;
    layers: Layer[];
}
export interface PrintSettings {
    paper: 'A4' | 'Letter' | 'Custom';
    copies: number;
    margin: number;
    gap: number;
    bleed: number;
    bleedSettingsVersion?: 1;
    crop: boolean;
    folds: boolean;
    calibration: boolean;
    flip: 'long' | 'short';
    templates: TemplateId[];
}
export interface LabelProject {
    version: 1;
    name: string;
    data: AlbumData;
    assets: Record<string, Asset>;
    designs: Partial<Record<TemplateId, Design>>;
    active: TemplateId;
    print: PrintSettings;
}
export interface Panel {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    path?: string;
    artworkWidth?: number;
    artworkHeight?: number;
    rotation?: -90;
    clipPaths?: string[];
    clipViewBox?: [number, number];
}
export interface TemplateDefinition {
    id: TemplateId;
    name: string;
    width: number;
    height: number;
    panels: Panel[];
    folds: number[];
    foldAxis: 'x' | 'y';
    safe: number;
}
export const templateNames: Record<TemplateId, string> = {
    label: '标准标签',
    full: '全面标签',
    jcard: 'J-Card',
    cover: '封面',
    tray: '托盘卡',
};
export const templateIds = Object.keys(templateNames) as TemplateId[];
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const formatDuration = (s: number | null) =>
    s === null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function textEffects(l: Layer, size = l.fontSize) {
    return {
        outlineColor: l.outlineColor ?? l.color,
        outlineWidth: l.outlineWidth ?? size * 0.035,
        outlineDiffuse: l.outlineDiffuse ?? false,
        outlineHollow: l.outlineHollow ?? true,
        shadowColor: l.shadowColor ?? '#000000',
        shadowDistance: l.shadowDistance ?? 0.18 * Math.SQRT2,
    };
}
export function hasTextEffectSettings(l: Layer): boolean {
    return [l.outlineColor, l.outlineWidth, l.outlineDiffuse, l.outlineHollow, l.shadowColor, l.shadowDistance].some(
        (v) => v !== undefined
    );
}
export function layer(kind: Layer['kind'], panel: string, face: Face, patch: Partial<Layer> = {}): Layer {
    return {
        id: uid(),
        name: { text: '文字', image: '图片', shape: '形状', code: '二维码' }[kind],
        kind,
        panel,
        face,
        x: 2,
        y: 2,
        width: 25,
        height: 8,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        text: '新文字',
        color: '#173d43',
        font: 'sans',
        fontSize: 2.5,
        weight: 400,
        italic: false,
        align: 'left',
        lineHeight: 1.35,
        shadow: false,
        outline: false,
        outlineColor: patch.color ?? '#173d43',
        outlineWidth: 0.1,
        outlineDiffuse: false,
        outlineHollow: false,
        shadowColor: '#000000',
        shadowDistance: 0.18 * Math.SQRT2,
        columns: 1,
        numbers: true,
        artists: true,
        durations: true,
        bullets: false,
        fit: 'cover',
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        shape: 'rect',
        code: 'qrcode',
        ...patch,
    };
}
// Three independent mechanical regions in a shared artwork coordinate system.
// Normalized from the reference's 1995.7 × 1897.1 outline; never bridge the shutter gaps.
export const fullPaths = [
    'M1268.5 1760.8H1994.3V1872.1C1994.3 1885.2 1983.7 1895.7 1970.7 1895.7H25.8C12.3 1895.7 1.4 1884.8 1.4 1871.3V91C1.4 41.5 41.5 1.4 91 1.4H1905C1954.3 1.4 1994.3 41.4 1994.3 90.7V658.1H1269.9C1224.3 658.1 1187.3 695.1 1187.3 740.7V1679.5C1187.3 1724.4 1223.7 1760.8 1268.5 1760.8Z',
    'M1994.3 671.2V1213.1H1270.5C1231.5 1213.1 1199.8 1181.5 1199.8 1142.4V746.1C1199.8 704.7 1233.3 671.2 1274.7 671.2Z',
    'M1199.8 1678.7C1199.8 1717.8 1231.5 1749.4 1270.5 1749.4H1994.2V1228.1H1267.8C1239.6 1228.1 1213.6 1212.9 1199.9 1188.2Z',
];
export function definition(d: Design): TemplateDefinition {
    const panels: Panel[] = [];
    const folds: number[] = [];
    let width = 0;
    const add = (id: string, name: string, w: number) => {
        if (panels.length) folds.push(width);
        panels.push({ id, name, x: width, y: 0, width: w, height: d.height });
        width += w;
    };
    if (d.template === 'label' || d.template === 'full') {
        panels.push({ id: 'main', name: '主标签', x: 0, y: 0, width: d.frontWidth, height: d.height });
        panels.push({ id: 'side', name: '侧标', x: d.frontWidth + 4, y: 0, width: d.sideWidth, height: d.sideHeight });
        width = d.frontWidth + 4 + d.sideWidth;
    } else if (d.template === 'jcard') {
        add('flap', '折翼', d.flapWidth);
        add('spine', '书脊', d.spineWidth);
        add('main', '封面', d.frontWidth);
        for (let i = 0; i < d.panels - 3; i++) add(`fold${i}`, `内页 ${i + 1}`, d.foldWidth);
    } else if (d.template === 'cover') {
        for (let i = d.panels - 2; i >= 0; i--) add(`fold${i}`, `内页 ${i + 1}`, d.foldWidth);
        add('main', '封面', d.frontWidth);
    } else {
        add('left', '左书脊', d.spineWidth);
        add('main', '背面板', d.frontWidth);
        add('right', '右书脊', d.spineWidth);
    }
    if (d.template === 'full') {
        panels[0].clipPaths = fullPaths;
        panels[0].clipViewBox = [1995.7, 1897.1];
    }
    const bottom = d.template === 'jcard' && d.orientation === 'bottom';
    if (bottom) {
        for (const p of panels) {
            const oldX = p.x,
                oldWidth = p.width;
            p.artworkWidth = oldWidth;
            p.artworkHeight = p.height;
            p.x = 0;
            p.y = width - oldX - oldWidth;
            p.width = p.height;
            p.height = oldWidth;
            p.rotation = -90;
        }
    }
    return {
        id: d.template,
        name: templateNames[d.template],
        width: bottom ? d.height : width,
        height: bottom ? width : Math.max(d.height, d.template === 'label' || d.template === 'full' ? d.sideHeight : 0),
        panels,
        folds: bottom ? folds.map((f) => width - f) : folds,
        foldAxis: bottom ? 'y' : 'x',
        safe: 1.5,
    };
}
export function newDesign(id: TemplateId): Design {
    const d: Design = {
        template: id,
        panels: id === 'jcard' ? 3 : id === 'cover' ? 2 : 1,
        frontWidth: { label: 36, full: 70.3, jcard: 68, cover: 72.9, tray: 87.4 }[id],
        height: { label: 53, full: 66.8, jcard: 73, cover: 104.9, tray: 101.6 }[id],
        foldWidth: id === 'cover' ? 71.9 : 68,
        spineWidth: id === 'tray' ? 9.35 : 5.5,
        flapWidth: 11,
        sideWidth: 3.8,
        sideHeight: 59,
        orientation: 'left',
        duplex: false,
        background: '#d2e5de',
        backBackground: '#d2e5de',
        layers: [],
    };
    const w = d.frontWidth;
    const small = id === 'label';
    d.layers = [
        layer('shape', 'main', 'front', { name: '底部色块', x: 0, y: d.height * 0.6, width: w, height: d.height * 0.4, color: '#eef3e9' }),
        layer('text', 'main', 'front', {
            name: '艺术家',
            binding: 'artist',
            x: 2,
            y: 3,
            width: w - 4,
            height: 6,
            fontSize: small ? 2.2 : 3.5,
        }),
        layer('text', 'main', 'front', {
            name: '专辑标题',
            binding: 'album',
            x: 2,
            y: small ? 9 : 11,
            width: w - 4,
            height: small ? 9 : 17,
            fontSize: small ? 3.5 : 6,
            weight: 700,
        }),
        layer('text', 'main', 'front', {
            name: '曲目',
            binding: 'tracks',
            x: 2,
            y: d.height * 0.62,
            width: w - 4,
            height: d.height * 0.36 - 2,
            fontSize: small ? 1.55 : 2.4,
        }),
    ];
    for (const p of definition(d).panels.filter((p) => ['side', 'spine', 'left', 'right'].includes(p.id))) {
        d.layers.push(
            layer('text', p.id, 'front', {
                name: p.name,
                binding: 'album',
                x: 1,
                y: 1,
                width: p.height - 2,
                height: p.width - 1,
                fontSize: Math.min(3, p.width * 0.6),
                rotation: p.id === 'left' ? -90 : 90,
                weight: 700,
            })
        );
    }
    return d;
}
export function newProject(): LabelProject {
    return {
        version: 1,
        name: '未命名 MD',
        active: 'label',
        data: { album: 'MY MINIDISC', artist: '精选录音', credits: '', lyrics: '', direction: '▲ INSERT THIS END', tracks: [] },
        assets: {},
        designs: { label: newDesign('label') },
        print: {
            paper: 'A4',
            copies: 1,
            margin: 10,
            gap: 5,
            bleed: 2,
            bleedSettingsVersion: 1,
            crop: true,
            folds: true,
            calibration: false,
            flip: 'long',
            templates: ['label'],
        },
    };
}
export function dataFromDisc(disc: Disc, selected?: number[], conversion: ChineseConversion = 'none'): AlbumData {
    const convert = (text: string) => toChinese(text, conversion);
    const tracks = disc.groups
        .flatMap((g) => g.tracks.map((t) => ({ t, group: g.fullWidthTitle || g.title || '' })))
        .filter(({ t }) => !selected || selected.includes(t.index))
        .sort((a, b) => a.t.index - b.t.index);
    const unique = (values: string[]) => {
        const set = new Set(values.filter(Boolean));
        return set.size === 1 ? [...set][0] : '';
    };
    return {
        album: convert(disc.fullWidthTitle || disc.title || unique(tracks.map(({ t }) => t.album || ''))),
        artist: convert(unique(tracks.map(({ t }) => t.artist || ''))),
        credits: '',
        lyrics: '',
        direction: '▲ INSERT THIS END',
        originalDisc: { title: disc.title, fullWidthTitle: disc.fullWidthTitle },
        tracks: tracks.map(({ t, group }) => ({
            id: uid(),
            title: convert(t.fullWidthTitle || t.title || ''),
            artist: convert(t.artist || ''),
            album: convert(t.album || ''),
            duration: t.duration,
            group: convert(group),
            original: { title: t.title || '', fullWidthTitle: t.fullWidthTitle || '', index: t.index },
        })),
    };
}
export function dataFromCSV(text: string): AlbumData {
    const parsed = parseTitleCSV(text);
    const titles = new Map(parsed.titles.map((t) => [t.id, t]));
    const disc = titles.get('disc')!;
    return {
        ...newProject().data,
        album: disc.unicodeTitle,
        artist: '',
        originalDisc: { title: disc.title, fullWidthTitle: disc.fullWidthTitle },
        tracks: parsed.records
            .filter((r) => r.index > 0)
            .sort((a, b) => a.index - b.index)
            .map((r) => {
                const t = titles.get(r.titleId)!;
                return {
                    id: uid(),
                    title: t.unicodeTitle,
                    artist: r.artist,
                    album: r.album,
                    duration: r.duration,
                    group: titles.get(`group:${r.groupRange}`)?.unicodeTitle || '',
                    original: { title: t.title, fullWidthTitle: t.fullWidthTitle, index: r.index - 1 },
                };
            }),
    };
}
export function parsePlaylist(text: string, asM3U = false): LabelTrack[] {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const m3u = asM3U || lines.some((s) => s.startsWith('#EXTM3U') || s.startsWith('#EXTINF:'));
    const result: LabelTrack[] = [];
    let pending: LabelTrack | undefined;
    const entry = (title: string, duration: number | null = null): LabelTrack => ({
        id: uid(),
        title: title.trim(),
        artist: '',
        album: '',
        group: '',
        duration,
    });
    for (const raw of lines) {
        const s = raw.trim();
        if (!s) continue;
        if (s.startsWith('#EXTINF:')) {
            const m = s.match(/^#EXTINF:([\d.-]+),(.*)$/);
            if (!m || !Number.isFinite(Number(m[1])) || Number(m[1]) > 864000) throw new Error('无效的 M3U 曲目信息');
            pending = entry(m[2], Number(m[1]) < 0 ? null : Number(m[1]));
            continue;
        }
        if (s.startsWith('#')) continue;
        if (m3u) {
            result.push(
                pending ||
                    entry(
                        s
                            .split(/[\\/]/)
                            .pop()!
                            .replace(/\.[^.]+$/, '')
                    )
            );
            pending = undefined;
        } else {
            const m = s.match(/^(.*?)\s*\((\d+):(\d{2})\)\s*$/);
            result.push(m ? entry(m[1], Number(m[2]) * 60 + Number(m[3])) : entry(s));
        }
    }
    if (pending) result.push(pending);
    return result;
}
export function boundText(l: Layer, data: AlbumData): string {
    if (!l.binding) return l.text;
    if (l.binding !== 'tracks') return data[l.binding];
    return data.tracks
        .map(
            (t, i) =>
                `${l.numbers ? `${i + 1}. ` : ''}${l.bullets ? '• ' : ''}${t.title || '未命名曲目'}${
                    l.artists && t.artist ? ` — ${t.artist}` : ''
                }${l.durations && t.duration !== null ? ` (${formatDuration(t.duration)})` : ''}`
        )
        .join('\n');
}

// Reorder only the source panel/face slots; other panels retain their exact order.
export function movePanelLayer(layers: Layer[], sourceId: string, targetId: string, after = false): Layer[] {
    const source = layers.find((l) => l.id === sourceId);
    if (!source || source.locked || sourceId === targetId) return layers;
    const belongs = (l: Layer) => l.panel === source.panel && l.face === source.face;
    const visibleOrder = layers.filter(belongs).reverse();
    if (!visibleOrder.some((l) => l.id === targetId)) return layers;
    const next = visibleOrder.filter((l) => l.id !== sourceId);
    next.splice(next.findIndex((l) => l.id === targetId) + (after ? 1 : 0), 0, source);
    next.reverse();
    let slot = 0;
    const result = layers.map((l) => (belongs(l) ? next[slot++] : l));
    return result.every((l, i) => l === layers[i]) ? layers : result;
}
