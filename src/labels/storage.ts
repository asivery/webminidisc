import JSZip from 'jszip';
import { Asset, LabelProject, templateIds, newDesign, Layer, clone, newProject, uid } from './model';

const MAX = 80 * 1024 * 1024;
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const object = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function validateProject(input: unknown): LabelProject {
    const p = input as LabelProject;
    const fail = (what: string): never => {
        throw new Error(`无效的工程文件：${what}`);
    };
    if (!object(p) || p.version !== 1) fail('不支持的版本');
    if (!templateIds.includes(p.active) || !object(p.designs) || !object(p.assets) || !object(p.data)) fail('缺少工程结构');
    if (typeof p.name !== 'string' || p.name.length > 500) fail('工程名称');
    for (const field of ['album', 'artist', 'lyrics', 'credits', 'direction'] as const)
        if (typeof p.data[field] !== 'string' || p.data[field].length > 200000) fail(field);
    if (!Array.isArray(p.data.tracks) || p.data.tracks.length > 2000) fail('曲目列表');
    for (const t of p.data.tracks) {
        if (
            !object(t) ||
            !['id', 'title', 'artist', 'album', 'group'].every((k) => typeof t[k as keyof typeof t] === 'string') ||
            (t.duration !== null && !bounded(t.duration, 0, 864000))
        )
            fail('曲目内容');
    }
    if (Object.keys(p.assets).length > 200) fail('素材数量过多');
    for (const [id, a] of Object.entries(p.assets)) {
        if (
            !object(a) ||
            a.id !== id ||
            !/^[\w-]+$/.test(id) ||
            !['image/png', 'image/jpeg', 'image/webp'].includes(a.mime) ||
            !bounded(a.width, 1, 50000) ||
            !bounded(a.height, 1, 50000) ||
            typeof a.name !== 'string'
        )
            fail('素材格式');
        if (typeof a.data !== 'string' || a.data.length > MAX || !new RegExp(`^data:${a.mime};base64,[A-Za-z0-9+/=]+$`).test(a.data))
            fail('素材数据');
    }
    for (const [id, d] of Object.entries(p.designs)) {
        if (
            !templateIds.includes(id as any) ||
            !object(d) ||
            d.template !== id ||
            !color(d.background) ||
            (d.backBackground !== undefined && !color(d.backBackground)) ||
            typeof d.duplex !== 'boolean' ||
            !['left', 'bottom'].includes(d.orientation)
        )
            fail('模板');
        for (const key of ['frontWidth', 'foldWidth', 'spineWidth', 'flapWidth', 'height', 'sideWidth', 'sideHeight'] as const)
            if (!bounded(d[key], 1, 500)) fail('模板尺寸');
        if (!Number.isInteger(d.panels) || !bounded(d.panels, id === 'jcard' ? 3 : 1, id === 'jcard' ? 5 : id === 'cover' ? 6 : 1))
            fail('面板数量');
        if (!Array.isArray(d.layers) || d.layers.length > 300) fail('图层数量');
        const ids = new Set<string>();
        for (const l of d.layers) {
            if (!object(l) || typeof l.id !== 'string' || !/^[\w-]+$/.test(l.id) || ids.has(l.id)) fail('图层 ID');
            ids.add(l.id);
            if (
                !['main', 'side', 'left', 'right', 'flap', 'spine', 'fold0', 'fold1', 'fold2', 'fold3', 'fold4'].includes(l.panel) ||
                !['front', 'back'].includes(l.face)
            )
                fail('图层面板');
            if (
                !['text', 'image', 'shape', 'code'].includes(l.kind) ||
                !['sans', 'serif', 'mono'].includes(l.font) ||
                !['left', 'center', 'right'].includes(l.align) ||
                !['contain', 'cover', 'stretch'].includes(l.fit) ||
                !['rect', 'ellipse', 'stripe', 'dots'].includes(l.shape) ||
                !['qrcode', 'ean13', 'code128'].includes(l.code)
            )
                fail('图层类型');
            if (l.binding && !['album', 'artist', 'tracks', 'credits', 'lyrics', 'direction'].includes(l.binding)) fail('文字绑定');
            if (!color(l.color) || typeof l.text !== 'string' || l.text.length > 200000 || typeof l.name !== 'string') fail('图层内容');
            for (const key of ['outlineColor', 'shadowColor'] as const) if (l[key] !== undefined && !color(l[key])) fail('文字效果颜色');
            for (const key of ['outlineDiffuse', 'outlineHollow'] as const)
                if (l[key] !== undefined && typeof l[key] !== 'boolean') fail('文字效果开关');
            if (l.outlineWidth !== undefined && !bounded(l.outlineWidth, 0, 5)) fail('描边宽度');
            if (l.shadowDistance !== undefined && !bounded(l.shadowDistance, 0, 20)) fail('阴影距离');
            for (const key of ['x', 'y', 'offsetX', 'offsetY'] as const) if (!bounded(l[key], -2000, 2000)) fail('图层坐标');
            for (const key of ['width', 'height'] as const) if (!bounded(l[key], 0.1, 3000)) fail('图层大小');
            if (
                !bounded(l.rotation, -360, 360) ||
                !bounded(l.opacity, 0, 1) ||
                !bounded(l.fontSize, 0.3, 100) ||
                !bounded(l.lineHeight, 0.8, 4) ||
                !bounded(l.zoom, 0.1, 10) ||
                !bounded(l.weight, 100, 900) ||
                ![1, 2].includes(l.columns)
            )
                fail('图层参数');
            for (const key of ['visible', 'locked', 'italic', 'shadow', 'outline', 'numbers', 'artists', 'durations', 'bullets'] as const)
                if (typeof l[key] !== 'boolean') fail('图层开关');
            if (
                l.localFont !== undefined &&
                (!object(l.localFont) ||
                    !['postscriptName', 'family', 'style'].every(
                        (key) =>
                            typeof l.localFont![key as keyof typeof l.localFont] === 'string' &&
                            l.localFont![key as keyof typeof l.localFont].length <= 500
                    ) ||
                    !l.localFont.postscriptName)
            )
                fail('本机字体引用');
            if (l.assetId && !p.assets[l.assetId]) fail('素材缺失');
        }
    }
    if (!p.designs[p.active]) fail('当前模板缺失');
    const s = p.print;
    if (
        !object(s) ||
        !['A4', 'Letter', 'Custom'].includes(s.paper) ||
        !Number.isInteger(s.copies) ||
        !bounded(s.copies, 1, 100) ||
        !bounded(s.margin, 0, 50) ||
        !bounded(s.gap, 0, 50) ||
        !bounded(s.bleed, 0, 5) ||
        !['long', 'short'].includes(s.flip) ||
        !Array.isArray(s.templates) ||
        !s.templates.every((id) => templateIds.includes(id))
    )
        fail('打印设置');
    for (const key of ['crop', 'folds', 'calibration'] as const) if (typeof s[key] !== 'boolean') fail('打印开关');
    if (s.bleedSettingsVersion !== undefined && s.bleedSettingsVersion !== 1) fail('出血设置版本');
    return clone(p);
}
export async function saveProject(project: LabelProject): Promise<Blob> {
    validateProject(project);
    const zip = new JSZip();
    const manifest = clone(project);
    for (const [id, asset] of Object.entries(manifest.assets)) {
        zip.file(`assets/${id}`, asset.data.split(',')[1], { base64: true });
        asset.data = `assets/${id}`;
    }
    zip.file('project.json', JSON.stringify(manifest, null, 2));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
export const BLEED_UPGRADE_NOTICE = '旧工程已启用 2 mm 出血及裁切标记；可在导出设置中调整或关闭。';
export function upgradeBleedSettings(p: LabelProject, notify?: (message: string) => void): LabelProject {
    if (p.print.bleedSettingsVersion === 1) return p;
    if (p.print.bleed === 0) {
        p.print.bleed = 2;
        p.print.crop = true;
        notify?.(BLEED_UPGRADE_NOTICE);
    }
    p.print.bleedSettingsVersion = 1;
    return p;
}
export async function openProject(file: Blob, notify?: (message: string) => void): Promise<LabelProject> {
    if (file.size > MAX) throw new Error('工程文件超过 80 MB');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files);
    if (entries.length > 210 || entries.reduce((sum, f) => sum + ((f as any)._data?.uncompressedSize || 0), 0) > MAX)
        throw new Error('工程解压大小超过限制');
    const manifest = zip.file('project.json');
    if (!manifest) throw new Error('缺少 project.json');
    const text = await manifest.async('string');
    if (text.length > 5 * 1024 * 1024) throw new Error('工程结构过大');
    const p = JSON.parse(text);
    if (!object(p.assets)) throw new Error('缺少素材表');
    for (const [id, a] of Object.entries(p.assets) as [string, Asset][]) {
        if (!/^[\w-]+$/.test(id) || !object(a) || a.data !== `assets/${id}`) throw new Error('无效的素材路径');
        const item = zip.file(a.data);
        if (!item) throw new Error('素材文件缺失');
        a.data = `data:${a.mime};base64,${await item.async('base64')}`;
    }
    return upgradeBleedSettings(validateProject(p), notify);
}
const allowedTags = new Set([
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'defs',
    'clippath',
    'lineargradient',
    'radialgradient',
    'stop',
    'pattern',
    'text',
    'tspan',
]);
const allowedAttrs = new Set([
    'xmlns',
    'viewBox',
    'width',
    'height',
    'x',
    'y',
    'x1',
    'x2',
    'y1',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'd',
    'points',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'transform',
    'id',
    'clip-path',
    'clip-rule',
    'fill-rule',
    'offset',
    'stop-color',
    'stop-opacity',
    'gradientUnits',
    'gradientTransform',
    'patternUnits',
    'patternTransform',
    'font-size',
    'font-family',
    'font-weight',
    'text-anchor',
    'dx',
    'dy',
]);
export function cleanSVG(source: string): string {
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG 不能包含外部实体');
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('无法解析 SVG');
    const walk = (el: Element) => {
        for (const child of Array.from(el.children)) {
            if (!allowedTags.has(child.localName.toLowerCase())) child.remove();
            else walk(child);
        }
        for (const attr of Array.from(el.attributes)) {
            if (
                !allowedAttrs.has(attr.name) ||
                /(?:javascript:|data:|https?:|file:|@import)/i.test(attr.value) ||
                (/url\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))
            )
                el.removeAttribute(attr.name);
        }
    };
    walk(doc.documentElement);
    return new XMLSerializer().serializeToString(doc);
}
export async function importAsset(file: File): Promise<Asset> {
    if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20 MB');
    let blob: Blob = file;
    const svg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (svg) blob = new Blob([cleanSVG(await file.text())], { type: 'image/svg+xml' });
    else if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('支持 PNG、JPEG、WebP、SVG');
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效');
        // Normalize every imported image, including SVG, into inert raster data.
        const target = svg ? 2400 : 4096;
        const factor = Math.min(svg ? 20 : 1, target / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
        return {
            id: uid(),
            name: file.name,
            mime: 'image/png',
            data: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
        };
    } finally {
        URL.revokeObjectURL(url);
    }
}
function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open('ewmd-labels', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('projects');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}
export async function persistDraft(p: LabelProject): Promise<void> {
    const db = await database();
    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            tx.objectStore('projects').put(p, 'draft');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}
export async function restoreDraft(notify?: (message: string) => void): Promise<LabelProject | null> {
    const db = await database();
    try {
        const value = await new Promise<unknown>((resolve, reject) => {
            const r = db.transaction('projects').objectStore('projects').get('draft');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        return value ? upgradeBleedSettings(validateProject(value), notify) : null;
    } finally {
        db.close();
    }
}
export async function exampleProject(id: LabelProject['active']): Promise<LabelProject> {
    const p = newProject();
    p.name = `示例 · ${id}`;
    p.active = id;
    p.designs = { [id]: newDesign(id) };
    p.print.templates = [id];
    p.data.album = '城市漫游 / CITY WALKS';
    p.data.artist = '我的 MD 收藏';
    p.data.credits = '## 录音笔记\n2026 · 私人精选\n**Recorded with care**';
    p.data.tracks = ['晨间电车', '雨中的街角', '夜行列車', 'After the Rain', '帰り道', '最后一班车'].map((title, i) => ({
        id: uid(),
        title,
        artist: 'Studio MD',
        album: p.data.album,
        group: '',
        duration: 180 + i * 21,
    }));
    return p;
}
