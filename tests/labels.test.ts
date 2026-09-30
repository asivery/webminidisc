import { DOMParser } from '@xmldom/xmldom';
import { exportPieces, pieceGap, fullContour } from '../src/labels/export-pieces';
import { renderExport, renderExportPiece } from '../src/labels/render';
import { upgradeBleedSettings } from '../src/labels/storage';
import { movePanelLayer } from '../src/labels/model';
import { toChinese } from '../src/title-conversion';
import { create as createFontkit } from 'fontkit';
import { adaptLocalFont } from '../src/labels/local-fonts';
import { fitEditorScale, fitPreviewZoom, mmToPixels } from '../src/labels/preview-scale';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { validateLabelPdfRequest } from '../../src/label-pdf-validation';
import path from 'node:path';
import * as opentype from 'opentype.js';
import {
    newProject,
    newDesign,
    definition,
    templateIds,
    layer,
    dataFromDisc,
    dataFromCSV,
    parsePlaylist,
    boundText,
} from '../src/labels/model';
import { renderDesign, printPages, svgDocument, layerBounds, textArtwork, textEffectPadding } from '../src/labels/render';
import { textEffects, hasTextEffectSettings, Layer } from '../src/labels/model';
import { rotateLayer, rotationDelta, rotationZone, rotationCorners, layerPoint, canvasPoint } from '../src/labels/interaction';
import { validateProject, saveProject, openProject } from '../src/labels/storage';
import { createTitleCSV } from '../src/csv-titles';
const readFont = (file: string) => {
    const b = fs.readFileSync(path.join(process.cwd(), 'public/label-fonts', file));
    return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const fonts = { sans: readFont('NotoSansCJKsc-Regular.otf'), serif: readFont('NotoSerifCJKsc-Regular.otf') };
test('mouse rotation preserves the rendered center through quarter turns on every panel orientation', () => {
    for (const orientation of ['left', 'bottom'] as const) {
        const d = newDesign('jcard');
        d.orientation = orientation;
        for (const p of definition(d).panels)
            for (const originalAngle of [-360, -180, -90, 0, 37, 90, 180, 360]) {
                const original = layer('text', p.id, 'front', { x: 8, y: 11, width: 30, height: 7, rotation: originalAngle });
                const center = canvasPoint(original, p, original.width / 2, original.height / 2);
                for (const angle of [-450, -180.1, -180, -90.1, -90, -89.9, 0, 89.9, 90, 90.1, 179.9, 180, 450, 1080]) {
                    const rotated = { ...original, ...rotateLayer(original, angle) };
                    const actual = canvasPoint(rotated, p, rotated.width / 2, rotated.height / 2);
                    assert.ok(Math.hypot(center.x - actual.x, center.y - actual.y) < 1e-9);
                    const bounds = layerBounds(rotated);
                    const local = layerPoint(rotated, rotated.width / 2, rotated.height / 2);
                    assert.ok(Math.hypot(bounds.x + bounds.width / 2 - local.x, bounds.y + bounds.height / 2 - local.y) < 1e-9);
                    assert.equal(rotated.width, original.width);
                    assert.equal(rotated.height, original.height);
                }
            }
    }
});
test('rotation unwraps angle crossings and supports repeated circles and Shift snapping', () => {
    assert.equal(rotationDelta(179, -179), 2);
    assert.equal(rotationDelta(-179, 179), -2);
    let previous = 170,
        total = 0;
    for (let angle = 180; angle <= 1250; angle += 10) {
        const current = ((angle + 180) % 360) - 180;
        total += rotationDelta(previous, current);
        previous = current;
    }
    assert.equal(total, 1080);
    const l = layer('text', 'main', 'front');
    assert.equal(rotateLayer(l, 22.36).rotation, 22.4);
    assert.equal(rotateLayer(l, 22.36, true).rotation, 15);
    assert.equal(rotateLayer(l, 22.6, true).rotation, 30);
    assert.equal(rotateLayer(l, -88, true).rotation, -90);
});
test('rotation corner zones keep fixed pixel size and stay outside resize handles', () => {
    const d = newDesign('jcard');
    d.orientation = 'bottom';
    const p = definition(d).panels[0];
    for (const rotation of [-90, 0, 37, 90, 180])
        for (const scale of [0.5, 2, 12])
            for (const corner of rotationCorners) {
                const l = layer('shape', p.id, 'front', { rotation, width: 20, height: 8 });
                const zone = rotationZone(l, p, corner, scale);
                const anchor = canvasPoint(l, p, corner.includes('w') ? 0 : l.width, corner.includes('n') ? 0 : l.height);
                assert.ok(Math.abs(Math.hypot(zone[0].x - zone[1].x, zone[0].y - zone[1].y) * scale - 14) < 1e-9);
                assert.ok(Math.hypot(zone[0].x - anchor.x, zone[0].y - anchor.y) * scale > Math.SQRT2 * 4.5);
            }
});
test('mouse rotated layers retain geometry across project saving and SVG/PDF export', async () => {
    const p = newProject();
    const l = layer('text', 'main', 'front', { text: '旋转', width: 20, height: 8 });
    Object.assign(l, rotateLayer(l, 90));
    p.designs.label!.layers = [l];
    const reopened = await openProject(await saveProject(p));
    assert.deepEqual(reopened.designs.label!.layers, [l]);
    assert.match(renderDesign(reopened, reopened.designs.label!, 'front', fonts).body, /rotate\(90\)/);
    assert.doesNotThrow(() => validateLabelPdfRequest(printPages(reopened, fonts)));
});
const effectKeys = ['outlineColor', 'outlineWidth', 'outlineDiffuse', 'outlineHollow', 'shadowColor', 'shadowDistance'] as const;
const legacyTextLayer = () => {
    const l = layer('text', 'main', 'front', { outline: true, shadow: true, fontSize: 4, color: '#123456' });
    effectKeys.forEach((key) => delete l[key]);
    return l;
};

test('text effects preserve legacy hollow outlines, shadow geometry and clipping', () => {
    const old = legacyTextLayer();
    assert.equal(hasTextEffectSettings(old), false);
    assert.equal(textEffects(old).outlineHollow, true);
    assert.equal(textEffectPadding(old), 0);
    const svg = textArtwork('中A', old, fonts, []);
    assert.match(svg, /fill="none" stroke="#123456" stroke-width="0.14"/);
    assert.match(svg, /translate\(\.18 \.18\).*fill="#000000" opacity=".24"/);
    assert.doesNotMatch(svg, /<filter/);
    const fresh = layer('text', 'main', 'front', { color: '#abcdef' });
    assert.equal(fresh.outlineColor, '#abcdef');
    assert.equal(fresh.outlineWidth, 0.1);
    assert.equal(fresh.outlineHollow, false);
    assert.equal(fresh.outlineDiffuse, false);
    assert.ok(Math.abs(textEffects(fresh).shadowDistance / Math.SQRT2 - 0.18) < 1e-12);
});

test('independent outline, hollow, blur and shadow settings render in physical units', () => {
    const l = layer('text', 'main', 'front', {
        outline: true,
        outlineColor: '#abcdef',
        outlineWidth: 0.8,
        shadow: true,
        shadowColor: '#345678',
        shadowDistance: Math.SQRT2 * 2,
        color: '#123456',
        italic: true,
        weight: 700,
    });
    const draw = () => textArtwork('中A\n文B', l, fonts, []);
    const solid = draw();
    assert.match(solid, /stroke="#abcdef" stroke-width="0.8"/);
    assert.match(solid, /translate\(2 2\).*fill="#345678"/);
    assert.ok(solid.indexOf('fill="#345678"') < solid.indexOf('stroke="#abcdef"'));
    assert.ok(solid.lastIndexOf('stroke="#abcdef"') < solid.indexOf('fill="#123456"'));
    l.outlineHollow = true;
    assert.doesNotMatch(draw(), /fill="#123456"/);
    l.outlineDiffuse = true;
    assert.match(draw(), /<feGaussianBlur stdDeviation="0.4"/);
    assert.ok(textEffectPadding(l) > 0.4 + 3 * 0.4 + 2);
    l.outlineWidth = 0;
    assert.doesNotMatch(draw(), /<filter|stroke="#abcdef"/);
    l.outline = false;
    l.shadow = false;
    assert.equal(textEffectPadding(l), 0);
    assert.match(draw(), /fill="#123456"/);
    assert.doesNotMatch(draw(), /#abcdef|#345678|<filter/);
    assert.equal(l.shadowDistance, Math.SQRT2 * 2);
});

test('text effect settings round-trip, accept old projects and reject malformed values', async () => {
    const p = newProject();
    const old = legacyTextLayer();
    const fresh = layer('text', 'main', 'front', {
        outline: true,
        outlineColor: '#abcdef',
        outlineWidth: 5,
        outlineHollow: true,
        outlineDiffuse: true,
        shadow: true,
        shadowColor: '#123456',
        shadowDistance: 20,
    });
    p.designs.label!.layers = [old, fresh];
    const restored = await openProject(await saveProject(p));
    assert.equal(restored.version, 1);
    assert.deepEqual(restored.designs.label!.layers, p.designs.label!.layers);
    assert.equal(hasTextEffectSettings(restored.designs.label!.layers[0]), false);
    const bad: [keyof Layer, unknown][] = [
        ['outlineColor', 'red'],
        ['shadowColor', '#123'],
        ['outlineColor', 'url(https://example.com)'],
        ['outlineWidth', -1],
        ['outlineWidth', 5.1],
        ['outlineWidth', NaN],
        ['outlineWidth', Infinity],
        ['shadowDistance', -1],
        ['shadowDistance', 20.1],
        ['shadowDistance', '1'],
        ['outlineDiffuse', 1],
        ['outlineHollow', null],
    ];
    for (const [key, value] of bad) {
        const invalid = structuredClone(p);
        (invalid.designs.label!.layers[1] as any)[key] = value;
        assert.throws(() => validateProject(invalid), /无效的工程文件/);
    }
    fresh.outlineWidth = 0;
    fresh.shadowDistance = 0;
    assert.doesNotThrow(() => validateProject(p));
});

test('glow IDs, expanded clips and panel clipping survive all templates and multipage export', () => {
    const p = newProject();
    p.print.templates = templateIds;
    p.print.copies = 2;
    for (const id of templateIds) {
        const d = (p.designs[id] = newDesign(id));
        d.layers = [
            layer('text', 'main', 'front', {
                text: '中文 A\n第二行',
                outline: true,
                outlineDiffuse: true,
                outlineWidth: 1,
                shadow: true,
                shadowDistance: 3,
                x: 0,
                y: 0,
                rotation: 37,
                width: 20,
                height: 12,
            }),
        ];
        const r = renderDesign(p, d, 'front', fonts, { separated: id === 'full' });
        assert.match(r.body, /<filter/);
        assert.match(r.body, /<clipPath[^>]*><rect x="-/);
        assert.match(r.body, /clip-path="url\(#/);
        const before = layerBounds(d.layers[0]);
        d.layers[0].outline = false;
        assert.deepEqual(layerBounds(d.layers[0]), before);
        d.layers[0].outline = true;
        assert.doesNotThrow(() =>
            validateLabelPdfRequest({ pages: [svgDocument(renderExport(p, d, 'front', fonts))], paperSize: { width: 210, height: 297 } })
        );
    }
    const result = printPages(p, fonts);
    assert.ok(result.pages.length > 1);
    assert.doesNotThrow(() => validateLabelPdfRequest(result));
    const ids = result.pages.flatMap((page) => [...page.matchAll(/<filter id="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(ids.length > 1);
    assert.equal(new Set(ids).size, ids.length);
});

test('PDF accepts only bounded internal Gaussian blur filters', () => {
    const filter =
        '<defs><filter id="glow" filterUnits="userSpaceOnUse" x="-2" y="-2" width="24" height="14"><feGaussianBlur stdDeviation=".5"/></filter></defs>';
    const body = `${filter}<g filter="url(#glow)"><path d="M0 0h10v10z" fill="#123456"/></g>`;
    const validate = (body: string) =>
        validateLabelPdfRequest({ pages: [svgDocument({ width: 30, height: 20, body })], paperSize: { width: 210, height: 297 } });
    assert.doesNotThrow(() => validate(body));
    for (const invalid of [
        body.replace('url(#glow)', 'url(https://example.com/glow)'),
        body.replace('url(#glow)', 'url(#missing)'),
        body.replace('stdDeviation=".5"', 'stdDeviation="-1"'),
        body.replace('stdDeviation=".5"', 'stdDeviation="Infinity"'),
        body.replace('stdDeviation=".5"', 'stdDeviation="100"'),
        body.replace('stdDeviation=".5"', 'stdDeviation=".5" in="BackgroundImage"'),
        body.replace('width="24"', 'width="-1"'),
        body.replace('feGaussianBlur', 'feImage'),
        body.replace('filterUnits="userSpaceOnUse"', 'filterUnits="objectBoundingBox"'),
        '<feGaussianBlur stdDeviation=".5"/>',
        '<g id="glow"/><path d="M0 0h1" filter="url(#glow)"/>',
    ])
        assert.throws(() => validate(invalid));
});
test('editor fit respects both viewport axes without changing physical geometry', () => {
    for (const [vw, vh] of [
        [640, 500],
        [390, 280],
        [1280, 720],
    ]) {
        for (const id of templateIds) {
            const design = newDesign(id);
            if (id === 'jcard') design.panels = 5;
            const before = JSON.stringify(design);
            const { width, height } = definition(design);
            const scale = fitEditorScale(width, height, vw, vh);
            assert.ok(width * scale <= vw - 104 + 0.001);
            assert.ok(height * scale <= vh - 104 + 0.001);
            assert.ok(scale > 0 && scale <= 8);
            assert.equal(JSON.stringify(design), before);
        }
    }
    assert.ok(fitEditorScale(220.5, 73, 390, 500) < fitEditorScale(220.5, 73, 900, 500));
    assert.ok(Number.isFinite(fitEditorScale(80, 60, 0, 0)));
});
test('five physical templates and fold geometry', () => {
    const sizes = { label: [43.8, 59], full: [78.1, 66.8], jcard: [84.5, 73], cover: [144.8, 104.9], tray: [106.1, 101.6] };
    for (const id of templateIds) {
        const def = definition(newDesign(id));
        assert.ok(Math.abs(def.width - sizes[id][0]) < 0.001);
        assert.equal(def.height, sizes[id][1]);
    }
    const j = newDesign('jcard');
    j.panels = 5;
    assert.equal(definition(j).width, 220.5);
    assert.deepEqual(definition(j).folds, [11, 16.5, 84.5, 152.5]);
});
test('device import sorts tracks and retains raw title, CSV and selection without mutations', () => {
    const disc: any = {
        title: 'Disc',
        fullWidthTitle: '中文盤',
        used: 400,
        groups: [
            {
                title: 'B',
                fullWidthTitle: '',
                tracks: [
                    {
                        index: 1,
                        title: 'Two',
                        fullWidthTitle: '二',
                        duration: 12,
                        artist: 'Singer',
                        album: 'Album',
                        encoding: { codec: 'SP', bitrate: 292 },
                    },
                ],
            },
            {
                title: 'A',
                fullWidthTitle: '',
                tracks: [{ index: 0, title: 'One', fullWidthTitle: '', duration: 10, encoding: { codec: 'SP', bitrate: 292 } }],
            },
        ],
    };
    const before = JSON.stringify(disc);
    const d = dataFromDisc(disc);
    assert.equal(d.album, '中文盤');
    assert.deepEqual(
        d.tracks.map((t) => t.title),
        ['One', '二']
    );
    assert.equal(d.tracks[0].artist, '');
    assert.equal(d.tracks[1].original?.title, 'Two');
    d.tracks[0].title = 'local';
    assert.equal(JSON.stringify(disc), before);
    assert.deepEqual(
        dataFromDisc(disc, [1]).tracks.map((t) => t.title),
        ['二']
    );
    assert.deepEqual(
        dataFromCSV(createTitleCSV(disc).document).tracks.map((t) => t.title),
        ['One', '二']
    );
    assert.equal(dataFromDisc({ ...disc, groups: [] }).tracks.length, 0);
});
test('M3U unknown durations, literal hyphens and pasted durations', () => {
    const t = parsePlaylist('#EXTM3U\n#EXTINF:222,歌手 - 夜行列車\nfile.mp3\n#EXTINF:-1,未知\nhttp://example.test/a.mp3');
    assert.equal(t[0].title, '歌手 - 夜行列車');
    assert.equal(t[0].artist, '');
    assert.equal(t[1].duration, null);
    assert.equal(parsePlaylist('晚风 (3:42)')[0].duration, 222);
});
test('hidden folds survive changes and text can detach from shared album', () => {
    const p = newProject();
    p.designs.cover = newDesign('cover');
    const d = p.designs.cover;
    d.panels = 6;
    d.layers.push(layer('text', 'fold4', 'back', { text: 'Hidden' }));
    d.panels = 1;
    assert.equal(definition(d).panels.length, 1);
    assert.ok(d.layers.find((l) => l.text === 'Hidden'));
    d.panels = 6;
    assert.ok(definition(d).panels.some((p) => p.id === 'fold4'));
    const l = layer('text', 'main', 'front', { binding: 'album' });
    p.data.album = '中文';
    assert.equal(boundText(l, p.data), '中文');
    l.binding = undefined;
    l.text = '独立';
    p.data.album = 'changed';
    assert.equal(boundText(l, p.data), '独立');
});
test('all templates export CJK outlines and physical dimensions', () => {
    for (const id of templateIds) {
        const p = newProject();
        p.active = id;
        p.designs[id] = newDesign(id);
        p.data.album = '中文 / 夜行列車';
        p.data.artist = '音楽';
        p.data.tracks = parsePlaylist('第一首 (3:00)\n雨の音 (2:45)');
        const r = renderDesign(p, p.designs[id]!, 'front', fonts);
        const svg = svgDocument(r);
        assert.match(svg, /width="[\d.]+mm"/);
        assert.match(svg, /<path/);
        assert.doesNotMatch(svg, /<text|foreignObject|<script/);
        assert.ok(!r.warnings.some((w) => w.includes('缺少字符')), r.warnings.join('\n'));
    }
});
test('full-face pieces share coordinate space and independent clips', () => {
    const p = newProject(),
        d = newDesign('full');
    p.designs.full = d;
    const pieces = [0, 1, 2].map((piece) => renderDesign(p, d, 'front', fonts, { panel: 'main', piece }));
    assert.ok(pieces.every((r) => r.width === 70.3 && r.height === 66.8));
    assert.ok(pieces.every((r) => r.body.includes('clipPath')));
    assert.notEqual(pieces[0].body, pieces[1].body);
});
test('QR/EAN generate vectors and invalid codes warn', () => {
    const p = newProject(),
        d = p.designs.label!;
    d.layers = [layer('code', 'main', 'front', { text: 'https://minidisc.wiki', code: 'qrcode', width: 20, height: 20 })];
    let r = renderDesign(p, d, 'front', fonts);
    assert.ok(!r.warnings.some((w) => w.includes('bwipp')));
    assert.match(r.body, /viewBox=/);
    d.layers[0].code = 'ean13';
    d.layers[0].text = '123456789012';
    r = renderDesign(p, d, 'front', fonts);
    assert.ok(!r.warnings.some((w) => w.includes('bwipp')));
    d.layers[0].text = 'invalid';
    r = renderDesign(p, d, 'front', fonts);
    assert.ok(r.warnings.some((w) => w.includes('二维码')));
});
test('long text warns about overflow', () => {
    const p = newProject(),
        d = p.designs.label!;
    d.layers = [layer('text', 'main', 'front', { width: 5, height: 2, text: '很长的中文曲目名称'.repeat(10) })];
    assert.ok(renderDesign(p, d, 'front', fonts).warnings.some((w) => w.includes('超出')));
});
test('PDF sheets paginate and pair duplex, oversized artwork never shrinks', () => {
    const p = newProject();
    p.active = 'tray';
    p.designs.tray = newDesign('tray');
    p.designs.tray.duplex = true;
    p.print.templates = ['tray'];
    p.print.copies = 4;
    p.print.calibration = true;
    const out = printPages(p, fonts);
    assert.deepEqual(out.paperSize, { width: 210, height: 297 });
    assert.equal(out.pages.length, 4);
    assert.ok(out.pages.every((s) => s.includes('width="210mm"')));
    p.print.flip = 'short';
    assert.notEqual(printPages(p, fonts).pages[1], out.pages[1]);
    p.designs.cover = newDesign('cover');
    p.designs.cover.panels = 6;
    p.print.templates = ['cover'];
    assert.throws(() => printPages(p, fonts), /超过纸张/);
    p.print.paper = 'Custom';
    assert.ok(printPages(p, fonts).paperSize.width > 432);
});
test('ZIP round-trip, version rejection and invalid attributes', async () => {
    const p = newProject();
    for (const id of templateIds) p.designs[id] = newDesign(id);
    const blob = await saveProject(p);
    assert.deepEqual(await openProject(blob), p);
    assert.throws(() => validateProject({ ...p, version: 999 }), /版本/);
    const bad = structuredClone(p);
    bad.designs.label!.layers[0].color = 'red" onload="evil';
    assert.throws(() => validateProject(bad), /内容/);
    await assert.rejects(() => openProject(new Blob(['not a zip'])));
});

test('bottom J-Card is a rigid rotation, including fold axes and draggable bounds', () => {
    const p = newProject(),
        d = newDesign('jcard');
    d.panels = 5;
    d.orientation = 'bottom';
    d.layers = [layer('shape', 'main', 'front', { x: 3, y: 7, width: 12, height: 8 })];
    const def = definition(d);
    assert.equal(def.width, 73);
    assert.equal(def.height, 220.5);
    assert.equal(def.foldAxis, 'y');
    const panel = def.panels.find((p) => p.id === 'main')!;
    assert.equal(panel.width, 73);
    assert.equal(panel.height, 68);
    const r = renderDesign(p, d, 'front', fonts);
    assert.deepEqual(r.hits[0], { id: d.layers[0].id, x: 7, y: panel.y + 53, width: 8, height: 12, rotation: 0 });
    assert.match(r.body, /translate\(0 68\) rotate\(-90\)/);
    assert.doesNotMatch(r.body, /scale\(/);
    const rotated = layerBounds({ ...d.layers[0], rotation: 45 });
    assert.ok(rotated.width > 14 && rotated.height > 14);
});
test('full-face clip paths are direct shapes supported by Chromium', () => {
    const p = newProject(),
        d = newDesign('full');
    const r = renderDesign(p, d, 'front', fonts);
    assert.match(r.body, /<clipPath id="[^\"]+-main"><path transform="scale/);
    assert.doesNotMatch(r.body, /<clipPath[^>]*><g/);
    assert.equal(definition(d).panels[0].clipPaths?.length, 3);
});
test('native PDF validation accepts all templates, CJK, textures, embedded images and three code types', () => {
    const p = newProject();
    p.assets.pixel = {
        id: 'pixel',
        name: 'pixel.png',
        mime: 'image/png',
        width: 1,
        height: 1,
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSTsAAAAASUVORK5CYII=',
    };
    for (const id of templateIds) {
        const d = (p.designs[id] = newDesign(id));
        d.layers.push(layer('image', 'main', 'front', { assetId: 'pixel' }));
        d.layers.push(layer('shape', 'main', 'front', { shape: 'dots' }));
        for (const code of ['qrcode', 'ean13', 'code128'] as const)
            d.layers.push(layer('code', 'main', 'front', { code, text: code === 'ean13' ? '123456789012' : 'MINIDISC' }));
    }
    p.print.templates = templateIds;
    const pages = printPages(p, fonts);
    assert.equal(validateLabelPdfRequest(pages).pages.length, pages.pages.length);
});
test('ZIP assets survive reopening and missing assets fail with a clear error', async () => {
    const p = newProject();
    p.assets.pixel = {
        id: 'pixel',
        name: 'pixel.png',
        mime: 'image/png',
        width: 1,
        height: 1,
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSTsAAAAASUVORK5CYII=',
    };
    p.designs.label!.layers.push(layer('image', 'main', 'front', { assetId: 'pixel' }));
    const saved = await saveProject(p);
    assert.deepEqual((await openProject(saved)).assets, p.assets);
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    zip.remove('assets/pixel');
    await assert.rejects(() => zip.generateAsync({ type: 'blob' }).then(openProject), /素材文件缺失/);
});

test('mixed duplex jobs include blank rear sheets so every copy stays paired', () => {
    const p = newProject();
    p.designs.cover = newDesign('cover');
    p.designs.cover.height = 230;
    p.designs.jcard = newDesign('jcard');
    p.designs.jcard.duplex = true;
    p.print.templates = ['cover', 'jcard'];
    p.print.copies = 2;
    const result = printPages(p, fonts);
    assert.equal(result.pages.length, 8);
    assert.match(result.pages[1], /viewBox="0 0 210 297"><\/svg>/);
});

test('headerless M3U files use filenames and invalid EXTINF durations reject', () => {
    assert.deepEqual(
        parsePlaylist('music/夜行列車.flac\nC:\\music\\Rain.mp3', true).map((t) => t.title),
        ['夜行列車', 'Rain']
    );
    assert.throws(() => parsePlaylist('#EXTM3U\n#EXTINF:1.2.3,Invalid\na.flac'), /无效/);
});

test('duplex backgrounds remain independent', () => {
    const p = newProject(),
        d = newDesign('cover');
    d.layers = [];
    d.background = '#ff0000';
    d.backBackground = '#0000ff';
    assert.match(renderDesign(p, d, 'front', fonts).body, /fill="#ff0000"/);
    assert.match(renderDesign(p, d, 'back', fonts).body, /fill="#0000ff"/);
});

test('resize preserves opposite anchor under all rotations, handles and J-card orientations', async () => {
    const { resizeLayer, handlePoint, layerPoint, panelDelta, canvasPoint, resizeHandles } = await import('../src/labels/interaction');
    for (const rotation of [0, 90, -90, 37, 180])
        for (const handle of resizeHandles) {
            const before = layer('shape', 'main', 'front', { x: 7, y: 13, width: 20, height: 12, rotation });
            const after = { ...before, ...resizeLayer(before, handle, 3, 4, false) };
            const h = handlePoint(handle, 1, 1);
            const a = layerPoint(before, (1 - h.x) * before.width, (1 - h.y) * before.height);
            const b = layerPoint(after, (1 - h.x) * after.width, (1 - h.y) * after.height);
            assert.ok(Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8, `${rotation} ${handle}`);
            const shrunk = resizeLayer(before, handle, -10000, -10000, true);
            assert.ok(shrunk.width >= 1 && shrunk.height >= 1);
            const proportional = resizeLayer(before, handle, 3, 4, true, true);
            if (handle.length === 2) assert.ok(Math.abs(proportional.width / proportional.height - 20 / 12) < 1e-8);
        }
    const design = newDesign('jcard');
    design.orientation = 'bottom';
    const panel = definition(design).panels.find((p) => p.id === 'main')!;
    const before = layer('image', 'main', 'front', { width: 20, height: 10, x: 2, y: 3 });
    const delta = panelDelta(4, -6, true);
    const after = { ...before, ...resizeLayer(before, 'se', delta.x, delta.y, false) };
    const a = canvasPoint(before, panel, before.width, before.height),
        b = canvasPoint(after, panel, after.width, after.height);
    assert.ok(Math.abs(b.x - a.x - 4) < 1e-8 && Math.abs(b.y - a.y + 6) < 1e-8);
});

test('bundled asset catalog is offline, complete, unique and matches source checksums', async () => {
    const { createHash } = await import('node:crypto');
    const root = path.join(process.cwd(), 'public/label-assets');
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
    assert.equal(catalog.length, 327);
    assert.equal(new Set(catalog.map((a: any) => a.id)).size, catalog.length);
    assert.ok(catalog.some((a: any) => a.name === 'Hi-Fi Stereo'));
    assert.ok(catalog.some((a: any) => a.name === 'Lo-Fi Stereo'));
    for (const a of catalog) {
        assert.match(a.file, /^[\w-]+\.(png|webp)$/);
        const data = fs.readFileSync(path.join(root, a.file));
        assert.equal(createHash('sha256').update(data).digest('hex'), a.sha256);
        assert.match(a.source, /^https:\/\/vhs\.texs\.org\//);
    }
});

test('desktop version remains separate from upstream and injected changelogs do not duplicate', async () => {
    const { versionLabel, mergeChangelog } = await import('../src/app-version');
    assert.equal(versionLabel('0.5.2-1.5.5'), 'ElectronWMD 0.5.2-1.5.5 · Web MiniDisc Pro 1.6.0');
    assert.equal(versionLabel(), 'Web MiniDisc Pro 1.6.0');
    const base = [
        { name: 'Version 1.6.0', contents: ['upstream'] },
        { name: 'Version 1.5.4', contents: ['older'] },
    ];
    const injection = { before: 'Version 1.5.4', entry: { name: 'Version 1.5.5', contents: ['desktop'] } };
    const merged = mergeChangelog(base, [injection, injection]);
    assert.deepEqual(
        merged.map((v) => v.name),
        ['Version 1.6.0', 'Version 1.5.5', 'Version 1.5.4']
    );
    assert.equal(base.length, 2);
    assert.deepEqual(mergeChangelog(merged, [injection]), merged);
});

test('MD Chinese import converts metadata, keeps raw backup, order and source unchanged', () => {
    const disc: any = {
        title: 'Legacy',
        fullWidthTitle: '音楽広場',
        groups: [
            {
                title: '国際',
                tracks: [
                    { index: 1, title: 'OLD', fullWidthTitle: '桜の国 Hello 中文', artist: '広沢', album: '音楽', duration: 18 },
                    { index: 0, title: '図書', fullWidthTitle: '', duration: 10 },
                ],
            },
        ],
    };
    const original = JSON.stringify(disc);
    for (const mode of ['none', 'simplified', 'traditional'] as const) {
        const data = dataFromDisc(disc, undefined, mode);
        assert.equal(data.album, toChinese('音楽広場', mode));
        assert.deepEqual(
            data.tracks.map((t) => t.title),
            ['図書', '桜の国 Hello 中文'].map((t) => toChinese(t, mode))
        );
        assert.equal(data.tracks[1].artist, toChinese('広沢', mode));
        assert.equal(data.tracks[1].album, toChinese('音楽', mode));
        assert.equal(data.tracks[1].group, toChinese('国際', mode));
        assert.equal(data.tracks[0].artist, '');
        assert.deepEqual(
            data.tracks.map((t) => t.duration),
            [10, 18]
        );
        assert.deepEqual(data.tracks[1].original, { title: 'OLD', fullWidthTitle: '桜の国 Hello 中文', index: 1 });
        assert.equal(dataFromDisc(disc, [1], mode).tracks[0].title, data.tracks[1].title);
        assert.equal(dataFromDisc(disc, [1], mode).artist, toChinese('広沢', mode));
        assert.equal(JSON.stringify(disc), original);
    }
});

test('layer reorder isolates panel and face, respects lock and visual front-to-back order', () => {
    const a = layer('text', 'main', 'front'),
        b = layer('text', 'main', 'front'),
        c = layer('text', 'main', 'front');
    const spine = layer('text', 'spine', 'front'),
        back = layer('text', 'main', 'back');
    const all = [a, spine, b, back, c];
    const moved = movePanelLayer(all, a.id, c.id);
    assert.deepEqual(moved, [b, spine, c, back, a]);
    assert.deepEqual(movePanelLayer(moved, a.id, b.id, true), all);
    assert.equal(movePanelLayer(all, a.id, spine.id), all);
    a.locked = true;
    assert.equal(movePanelLayer(all, a.id, c.id), all);
    a.visible = false;
    assert.equal(movePanelLayer(all, a.id, c.id), all);
});

test('font references round-trip without font files, missing font blocks only affected exports', async () => {
    const p = newProject();
    const d = p.designs.label!;
    const l = d.layers.find((l) => l.kind === 'text' && l.panel === 'main')!;
    l.localFont = { postscriptName: 'MissingFont-Regular', family: 'Missing Font', style: 'Regular' };
    const restored = await openProject(await saveProject(p));
    assert.deepEqual(restored.designs.label!.layers.find((x) => x.id === l.id)!.localFont, l.localFont);
    assert.ok(renderDesign(p, d, 'front', fonts).warnings.some((w) => w.includes('Missing Font')));
    assert.throws(() => renderDesign(p, d, 'front', fonts, { strictFonts: true }), /缺少字体/);
    assert.throws(() => printPages(p, fonts), /缺少字体/);
    assert.doesNotThrow(() => renderDesign(p, d, 'front', fonts, { strictFonts: true, panel: 'side' }));
    l.visible = false;
    assert.doesNotThrow(() => printPages(p, fonts));
    l.localFont = { ...l.localFont, postscriptName: '' };
    assert.throws(() => validateProject(p), /本机字体引用/);
});

test('fontkit paths preserve CJK and Latin metrics and do not mutate cached outlines', () => {
    const parsed = createFontkit(fs.readFileSync(path.join(process.cwd(), 'public/label-fonts/NotoSansCJKsc-Regular.otf')));
    const font = adaptLocalFont(parsed as any);
    for (const char of ['中', '日', 'A']) {
        assert.ok(font.hasChar(char));
        assert.ok(Math.abs(font.getAdvanceWidth(char, 5) - fonts.sans.getAdvanceWidth(char, 5, { kerning: false })) < 0.001);
        const original = font.getPath(char, 0, 0, 5).toPathData();
        assert.ok(original.includes('M'));
        font.getPath(char, 20, 40, 30);
        assert.equal(font.getPath(char, 0, 0, 5).toPathData(), original);
    }
});

test('artwork preview uses complete geometry without print marks and fit uses 10 percent steps', () => {
    const p = newProject();
    for (const id of templateIds) {
        const d = newDesign(id);
        p.designs[id] = d;
        for (const face of ['front', 'back'] as const) {
            const r = renderDesign(p, d, face, fonts);
            const def = definition(d);
            assert.equal(r.width, def.width);
            assert.equal(r.height, def.height);
            assert.ok(!r.body.includes('stroke-dasharray="1 1"'));
        }
    }
    assert.ok(Math.abs(mmToPixels(25.4) - 96) < 0.000001);
    assert.equal(fitPreviewZoom(25.4, 25.4, 100, 100), 100);
    assert.equal(fitPreviewZoom(25.4, 25.4, 200, 150), 150);
    assert.equal(fitPreviewZoom(25.4, 25.4, 9999, 9999), 500);
    assert.equal(fitPreviewZoom(25.4, 25.4, 1, 1), 10);
});

test('local font restoration matches PostScript name, reads selected bytes once and retries failures', async () => {
    const { loadLocalFont, listLocalFonts } = await import('../src/labels/local-fonts');
    const ref = { postscriptName: 'Test-Noto-Regular', family: 'Test Noto', style: 'Regular' };
    const bytes = fs.readFileSync(path.join(process.cwd(), 'public/label-fonts/NotoSansCJKsc-Regular.otf'));
    let reads = 0;
    let queries: string[][] = [];
    const previous = (globalThis as any).window;
    (globalThis as any).window = {
        queryLocalFonts: async (options?: { postscriptNames: string[] }) => {
            queries.push(options?.postscriptNames || []);
            return [
                {
                    ...ref,
                    fullName: 'Test Noto Regular',
                    blob: async () => {
                        reads++;
                        return new Blob([bytes]);
                    },
                },
            ].filter((f) => !options || options.postscriptNames.includes(f.postscriptName));
        },
    };
    try {
        await listLocalFonts();
        assert.equal(reads, 0);
        assert.equal(await loadLocalFont(ref), await loadLocalFont({ ...ref, family: 'Renamed family' }));
        assert.equal(reads, 1);
        const missing = { ...ref, postscriptName: 'Not-Installed' };
        await assert.rejects(loadLocalFont(missing), /缺少字体/);
        await assert.rejects(loadLocalFont(missing), /缺少字体/);
        assert.deepEqual(queries.slice(-2), [['Not-Installed'], ['Not-Installed']]);
        assert.throws(
            () =>
                adaptLocalFont({
                    unitsPerEm: 1000,
                    characterSet: [65],
                    hasGlyphForCodePoint: () => true,
                    glyphForCodePoint: () => ({ path: { commands: [] } }),
                } as any),
            /矢量轮廓/
        );
    } finally {
        (globalThis as any).window = previous;
    }
});

test('both theme launchers share a copied, resettable disc selection', async () => {
    const { setLabelDiscSelection, getLabelDiscSelection } = await import('../src/labels/disc-selection');
    const selected = [4, 1];
    setLabelDiscSelection(selected);
    selected.push(3);
    assert.deepEqual(getLabelDiscSelection(), [4, 1]);
    getLabelDiscSelection().push(8);
    assert.deepEqual(getLabelDiscSelection(), [4, 1]);
    setLabelDiscSelection([]);
    assert.deepEqual(getLabelDiscSelection(), []);
});

test('bleed exports preserve five trim geometries and preview at 0/2/5 mm, with separated footprints', () => {
    const p = newProject();
    for (const bleed of [0, 2, 5])
        for (const crop of [false, true])
            for (const id of templateIds) {
                p.print.bleed = bleed;
                p.print.crop = crop;
                p.print.gap = 0;
                const d = newDesign(id),
                    def = definition(d);
                d.layers = [];
                p.designs[id] = d;
                const before = JSON.stringify(d),
                    pieces = exportPieces(d, p.print);
                assert.equal(pieces.length, id === 'label' ? 2 : id === 'full' ? 4 : 1);
                for (const piece of pieces) {
                    assert.ok(Math.abs(piece.bleedBounds.width - piece.source.width - 2 * bleed) < 1e-8);
                    assert.ok(Math.abs(piece.bleedBounds.height - piece.source.height - 2 * bleed) < 1e-8);
                    assert.ok(piece.footprint.width >= piece.bleedBounds.width);
                    assert.ok(pieceGap(piece, piece, 0) + piece.markSpace * 2 >= 8);
                    const r = renderExportPiece(p, d, 'front', fonts, piece);
                    assert.equal(r.width, piece.footprint.width);
                    assert.equal(r.height, piece.footprint.height);
                    if (bleed) {
                        assert.match(r.body, /maskUnits="userSpaceOnUse"/);
                        const mask = r.body.match(/<mask[\s\S]*?<\/mask>/)?.[0];
                        assert.ok(mask);
                        assert.doesNotMatch(mask, /fill="#000000"/); // no complementary trim masks / white seam
                    } else assert.doesNotMatch(r.body, /<mask/);
                    if (crop && !piece.trimPath) assert.ok(r.body.includes(`M${-(bleed + 1)} 0h-2M0 ${-(bleed + 1)}v-2`));
                }
                const preview = renderDesign(p, d, 'front', fonts);
                assert.equal(preview.width, def.width);
                assert.equal(preview.height, def.height);
                assert.doesNotMatch(preview.body, /<mask|stroke="#555555"/);
                assert.equal(JSON.stringify(d), before);
                p.print.templates = [id];
                const out = printPages(p, fonts);
                assert.equal(validateLabelPdfRequest(out).pages.length, out.pages.length);
            }
});

test('full-face pieces sample unchanged master coordinates with uniform physical bleed after resizing', () => {
    const p = newProject(),
        d = newDesign('full');
    d.frontWidth = 100;
    d.height = 80;
    d.layers = [layer('shape', 'main', 'front', { x: 0, y: 0, width: 100, height: 80, shape: 'stripe' })];
    const pieces = exportPieces(d, p.print);
    for (let i = 0; i < 3; i++) {
        const piece = pieces[i],
            contour = fullContour(i, 100, 80);
        assert.equal(piece.trimPath, contour.path);
        assert.deepEqual(piece.source, contour.bounds);
        assert.ok(piece.source.x >= 0 && piece.source.y >= 0);
        assert.ok(piece.source.x + piece.source.width <= 100);
        const svg = renderExportPiece(p, d, 'front', fonts, piece).body;
        assert.match(svg, /stroke-width="4" stroke-linejoin="round"/);
        assert.ok(svg.includes(`translate(${-piece.source.x} ${-piece.source.y})`));
        assert.ok(svg.includes('patternTransform="rotate(30)"'));
    }
    assert.ok(pieces[1].source.x > 50 && pieces[2].source.y > 45);
    assert.ok(pieces[0].source.width > 99);
});

test('image bleed uses original crop then pixel edge padding and excludes text and QR', () => {
    const p = newProject(),
        d = p.designs.label!;
    p.assets.pixel = { id: 'pixel', name: 'test.png', mime: 'image/png', width: 100, height: 100, data: 'data:image/png;base64,AAAA' };
    const image = layer('image', 'main', 'front', { x: 0, y: 0, width: 36, height: 53, fit: 'stretch', assetId: 'pixel' });
    d.layers = [image, layer('text', 'main', 'front', { text: 'ABC' }), layer('code', 'main', 'front', { text: 'test' })];
    const normal = renderDesign(p, d, 'front', fonts, { panel: 'main' });
    const extension = renderDesign(p, d, 'front', fonts, { panel: 'main', sourceBleed: 2 });
    assert.match(normal.body, /x="0" y="0" width="36" height="53" preserveAspectRatio="none"/);
    assert.match(extension.body, /x="0" y="0" width="36" height="53" preserveAspectRatio="none"/);
    assert.match(extension.body, /viewBox="99 0 1 100"/);
    assert.match(extension.body, /viewBox="99 99 1 1"/);
    assert.doesNotMatch(extension.body, /<path/);
    assert.equal((extension.body.match(/data:image\/png;base64/g) || []).length, 1);
    assert.match(extension.body, /<use href="#/);
    image.fit = 'cover';
    const cover = renderDesign(p, d, 'front', fonts, { panel: 'main', sourceBleed: 2 });
    assert.match(cover.body, /x="-8.5" y="0" width="53" height="53"/);
    assert.doesNotMatch(cover.body, /viewBox="99 0 1 100"/);
});

test('packaging extends only outer edges and SVG/PDF rear panels agree for both flips', () => {
    const p = newProject();
    for (const id of ['jcard', 'cover', 'tray'] as const)
        for (const orientation of ['left', 'bottom'] as const) {
            const d = newDesign(id);
            d.orientation = orientation;
            d.duplex = true;
            d.layers = [];
            p.designs[id] = d;
            p.print.templates = [id];
            const def = definition(d);
            for (const flip of ['long', 'short'] as const) {
                p.print.flip = flip;
                const piece = exportPieces(d, p.print)[0];
                const rear = renderExportPiece(p, d, 'back', fonts, piece, true);
                const doc = new DOMParser().parseFromString(svgDocument(rear), 'image/svg+xml');
                const clips = Array.from(doc.getElementsByTagName('clipPath')).filter((el: any) =>
                    el.getAttribute('id').endsWith('-exterior')
                );
                assert.equal(clips.length, def.panels.length);
                def.panels.forEach((panel, i) => {
                    const x = flip === 'long' ? def.width - panel.x - panel.width : panel.x;
                    const y = flip === 'short' ? def.height - panel.y - panel.height : panel.y;
                    const rect = clips[i].firstChild as any;
                    const left = x <= 0.001 ? 2 : 0,
                        right = x + panel.width >= def.width - 0.001 ? 2 : 0;
                    const top = y <= 0.001 ? 2 : 0,
                        bottom = y + panel.height >= def.height - 0.001 ? 2 : 0;
                    assert.equal(Number(rect.getAttribute('x')), -left || 0);
                    assert.equal(Number(rect.getAttribute('y')), -top || 0);
                    assert.equal(Number(rect.getAttribute('width')), panel.width + left + right);
                    assert.equal(Number(rect.getAttribute('height')), panel.height + top + bottom);
                });
                const out = printPages(p, fonts);
                const back = new DOMParser().parseFromString(out.pages[1], 'image/svg+xml').documentElement.firstChild as any;
                const bx = flip === 'long' ? 210 - 10 - piece.footprint.width : 10;
                const by = flip === 'short' ? 297 - 10 - piece.footprint.height : 10;
                assert.equal(back.getAttribute('transform'), `translate(${Number(bx.toFixed(4))} ${Number(by.toFixed(4))})`);
                const normalize = (text: string) =>
                    text.replace(/(?:md|export)\d+/g, 'id').replace(/ xmlns="http:\/\/www.w3.org\/2000\/svg"/g, '');
                assert.equal(normalize(back.firstChild.toString()), normalize(rear.body));
                assert.ok(normalize(renderExport(p, d, 'back', fonts).body).includes(normalize(rear.body)));
            }
        }
});

test('packing includes bleed and marks, paginates pieces and never shrinks', () => {
    const p = newProject(),
        d = newDesign('cover');
    p.designs.cover = d;
    p.print.templates = ['cover'];
    d.panels = 1;
    d.frontWidth = 185;
    d.height = 50;
    p.print.bleed = 0;
    p.print.crop = false;
    assert.doesNotThrow(() => printPages(p, fonts));
    p.print.bleed = 2;
    p.print.crop = true;
    assert.throws(() => printPages(p, fonts), /含出血及标记.*超过纸张/);
    p.print.paper = 'Custom';
    assert.ok(Math.abs(printPages(p, fonts).paperSize.width - 215.2) < 0.001);
    p.print.paper = 'A4';
    p.print.templates = ['label'];
    p.print.copies = 25;
    const pages = printPages(p, fonts).pages;
    assert.ok(pages.length > 1);
    assert.doesNotMatch(pages.join(''), /scale\(/);
});

test('legacy bleed migrates once in ZIP and draft; existing nonzero and deliberate zero survive', async () => {
    const p = newProject();
    assert.equal(p.print.bleed, 2);
    assert.equal(p.print.crop, true);
    delete p.print.bleedSettingsVersion;
    p.print.bleed = 0;
    p.print.crop = false;
    const notices: string[] = [];
    const restored = await openProject(await saveProject(p), (message) => notices.push(message));
    assert.equal(restored.print.bleed, 2);
    assert.equal(restored.print.crop, true);
    assert.equal(notices.length, 1);
    assert.equal(restored.version, 1);
    restored.print.bleed = 0;
    restored.print.crop = false;
    const zero = await openProject(await saveProject(restored), (message) => notices.push(message));
    assert.equal(zero.print.bleed, 0);
    assert.equal(zero.print.crop, false);
    assert.equal(notices.length, 1);
    p.print.bleed = 3;
    const nonzero = upgradeBleedSettings(structuredClone(p), (message) => notices.push(message));
    assert.equal(nonzero.print.bleed, 3);
    assert.equal(nonzero.print.crop, false);
    assert.equal(notices.length, 1);
    p.print.bleed = 0;
    const previous = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = {
        open: () => {
            const request: any = {};
            queueMicrotask(() => {
                request.result = {
                    close() {},
                    transaction: () => ({
                        objectStore: () => ({
                            get: () => {
                                const read: any = {};
                                queueMicrotask(() => {
                                    read.result = p;
                                    read.onsuccess();
                                });
                                return read;
                            },
                        }),
                    }),
                };
                request.onsuccess();
            });
            return request;
        },
    };
    try {
        const { restoreDraft } = await import('../src/labels/storage');
        assert.equal((await restoreDraft((message) => notices.push(message)))?.print.bleed, 2);
        assert.equal(notices.length, 2);
    } finally {
        (globalThis as any).indexedDB = previous;
    }
});
