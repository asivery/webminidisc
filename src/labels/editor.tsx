import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Dialog, Drawer, useMediaQuery } from '@mui/material';
import { fitEditorScale } from './preview-scale';
import { useInspectorHeight } from './use-inspector-height';
import { useShallowEqualSelector } from '../frontend-utils';
import { downloadBlob } from '../utils';
import {
    AlbumData,
    Binding,
    Design,
    Face,
    LabelProject,
    Layer,
    TemplateId,
    boundText,
    clone,
    dataFromCSV,
    dataFromDisc,
    movePanelLayer,
    definition,
    formatDuration,
    layer,
    newDesign,
    newProject,
    parsePlaylist,
    templateIds,
    templateNames,
    textEffects,
    uid,
} from './model';
import { Fonts, loadFonts, printPages, renderDesign, renderExport, svgDocument } from './render';
import { exampleProject, importAsset, openProject, persistDraft, restoreDraft, saveProject } from './storage';
import {
    canvasPoint,
    handlePoint,
    panelDelta,
    resizeHandles,
    resizeLayer,
    ResizeHandle,
    rotationCorners,
    rotationZone,
    normalizeRotation,
    rotationDelta,
    rotateLayer,
} from './interaction';
import { AssetLibrary } from './asset-library';
import { DiscIcon, StudioIcon, IconName } from './icons';
import { TemplatePicker } from './template-picker';
import { DesignPreview } from './print-preview';
import { FoldGuides } from './fold-guides';
import { FontPicker } from './font-picker';
import { loadLocalFont } from './local-fonts';
import { ChineseConversion } from '../title-conversion';
import './labels.css';

type Tab = 'text' | 'art' | 'logo' | 'decal' | 'background' | 'code' | 'layout';
function pointerOnCanvas(svg: SVGSVGElement, x: number, y: number) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(x, y).matrixTransform(matrix.inverse());
}
const tabs: [Tab, string, IconName][] = [
    ['text', '文字与曲目', 'text'],
    ['art', '封面艺术', 'image'],
    ['logo', '徽标', 'badge'],
    ['decal', '贴花', 'sticker'],
    ['background', '自定义背景', 'background'],
    ['code', '二维码与条码', 'code'],
    ['layout', '尺寸与折页', 'ruler'],
];
function NumberField({
    label,
    value,
    onChange,
    min = -1000,
    max = 1000,
    step = 0.1,
}: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
}) {
    return (
        <label className="md-field">
            <span>{label}</span>
            <input
                type="number"
                value={Number(value.toFixed(3))}
                min={min}
                max={max}
                step={step}
                onChange={(e) => {
                    if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))
                        onChange(Math.max(min, Math.min(max, e.target.valueAsNumber)));
                }}
            />
        </label>
    );
}
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="md-check">
            <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
            {label}
        </label>
    );
}
function Select({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: [string, string][];
}) {
    return (
        <label className="md-field">
            <span>{label}</span>
            <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map(([id, name]) => (
                    <option key={id} value={id}>
                        {name}
                    </option>
                ))}
            </select>
        </label>
    );
}

export default function LabelEditor({ open, onClose, selectedTracks }: { open: boolean; onClose: () => void; selectedTracks?: number[] }) {
    const disc = useShallowEqualSelector((s) => s.main.disc);
    const [project, setProject] = useState<LabelProject>(newProject);
    const projectRef = useRef(project);
    projectRef.current = project;
    const past = useRef<LabelProject[]>([]),
        future = useRef<LabelProject[]>([]);
    const [fonts, setFonts] = useState<Fonts | null>(null),
        [ready, setReady] = useState(false),
        [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(''),
        [error, setError] = useState(''),
        [saveState, setSaveState] = useState('正在读取草稿');
    const [tab, setTab] = useState<Tab>('text'),
        [face, setFace] = useState<Face>('front'),
        [panel, setPanel] = useState('main'),
        [selected, setSelected] = useState('');
    const narrow = useMediaQuery('(max-width:1119px)');
    const compact = useMediaQuery('(max-width:759px)');
    const [drawer, setDrawer] = useState<'tools' | 'inspector' | null>(null);
    const inspectorHeight = useInspectorHeight();
    const [canvasViewport, setCanvasViewport] = useState<HTMLDivElement | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 640, height: 500 });
    useEffect(() => {
        if (!canvasViewport || !open) return;
        const resize = () => setCanvasSize({ width: canvasViewport.clientWidth, height: canvasViewport.clientHeight });
        const observer = new ResizeObserver(resize);
        observer.observe(canvasViewport);
        resize();
        return () => observer.disconnect();
    }, [canvasViewport, open]);
    useEffect(() => {
        if (!narrow) setDrawer(null);
    }, [narrow]);
    const [zoom, setZoom] = useState(1),
        [grid, setGrid] = useState(false),
        [snap, setSnap] = useState(true),
        [guides, setGuides] = useState(true),
        [separated, setSeparated] = useState(false);
    const [showFolds, setShowFolds] = useState(() => {
        try {
            return localStorage.getItem('md-show-folds') !== 'false';
        } catch {
            return true;
        }
    });
    const [playlist, setPlaylist] = useState(''),
        [mode, setMode] = useState<'replace' | 'append'>('replace');
    const [exportWarnings, setExportWarnings] = useState<string[]>([]);
    const [printPreview, setPrintPreview] = useState(false);
    const [printOpen, setPrintOpen] = useState(false),
        [svgTarget, setSvgTarget] = useState('all');
    const [conversion, setConversion] = useState<ChineseConversion>(() => {
        try {
            const saved = localStorage.getItem('md-import-chinese');
            return saved === 'simplified' || saved === 'traditional' ? saved : 'none';
        } catch {
            return 'none';
        }
    });
    const [layerDrop, setLayerDrop] = useState<{ id: string; after: boolean } | null>(null);
    const draggedLayer = useRef<{ id: string; x: number; y: number; started?: boolean } | null>(null);
    const layerAtPointer = (x: number, y: number) => {
        const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-layer-id]');
        if (!row) return null;
        const rect = row.getBoundingClientRect();
        return { id: row.dataset.layerId!, after: y > rect.top + rect.height / 2 };
    };
    const fontRefs = JSON.stringify(
        Array.from(
            new Map(
                Object.values(project.designs)
                    .flatMap((d) => d?.layers || [])
                    .filter((l) => l.localFont)
                    .map((l) => [l.localFont!.postscriptName, l.localFont!])
            ).values()
        )
    );
    useEffect(() => {
        if (!fonts) return;
        let active = true;
        const refs: import('./model').LocalFontRef[] = JSON.parse(fontRefs);
        Promise.all(
            refs.map(async (ref) => {
                try {
                    return [ref.postscriptName, await loadLocalFont(ref)] as const;
                } catch {
                    return null;
                }
            })
        ).then((results) => {
            if (active && results.some(Boolean))
                setFonts(
                    (current) =>
                        current && {
                            ...current,
                            local: {
                                ...current.local,
                                ...Object.fromEntries(results.filter(Boolean) as [string, import('./render').GlyphFont][]),
                            },
                        }
                );
        });
        return () => {
            active = false;
        };
    }, [fontRefs, fonts?.sans]);
    const [dragTrack, setDragTrack] = useState<number | null>(null);
    const fileProject = useRef<HTMLInputElement>(null),
        fileMusic = useRef<HTMLInputElement>(null),
        fileImage = useRef<HTMLInputElement>(null);
    const drag = useRef<{
        pointerId: number;
        id: string;
        x: number;
        y: number;
        startX: number;
        startY: number;
        scale: number;
        started: boolean;
        orientation: string;
        panel: string;
        original?: Layer;
        handle?: ResizeHandle;
        rotation?: { center: { x: number; y: number }; previous: number; delta: number; applied: number };
    } | null>(null);
    const queue = useRef(Promise.resolve()),
        dirty = useRef(false);
    const design = project.designs[project.active]!;
    const def = definition(design);
    const actualFace: Face = design.duplex ? face : 'front';
    const actualPanel = def.panels.some((p) => p.id === panel) ? panel : 'main';
    const activeLayer = design.layers.find((l) => l.id === selected && l.face === actualFace && l.panel === actualPanel);
    const deferred = useDeferredValue(project);
    const rendered = useMemo(
        () => (fonts ? renderDesign(deferred, deferred.designs[deferred.active]!, actualFace, fonts, { guides, separated }) : null),
        [deferred, fonts, actualFace, guides, separated]
    );
    const run = async (fn: () => Promise<void>) => {
        setError('');
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };
    const commit = (fn: (p: LabelProject) => void, remember = true) =>
        setProject((current) => {
            if (remember) {
                past.current.push(current);
                if (past.current.length > 40) past.current.shift();
                future.current = [];
            }
            // Assets are immutable: retain their large data URLs across undo snapshots.
            const next: LabelProject = {
                ...current,
                data: { ...current.data, tracks: current.data.tracks.map((t) => ({ ...t })) },
                assets: { ...current.assets },
                designs: Object.fromEntries(
                    Object.entries(current.designs).map(([id, d]) => [id, { ...d, layers: d!.layers.map((l) => ({ ...l })) }])
                ),
                print: { ...current.print, templates: [...current.print.templates] },
            };
            fn(next);
            dirty.current = true;
            return next;
        });
    const editDesign = (patch: Partial<Design>) => commit((p) => Object.assign(p.designs[p.active]!, patch));
    const editLayer = (patch: Partial<Layer>) =>
        commit((p) => {
            const l = p.designs[p.active]!.layers.find((l) => l.id === selected);
            if (l) Object.assign(l, patch);
        });
    const undo = () => {
        const prev = past.current.pop();
        if (prev) {
            future.current.push(projectRef.current);
            setProject(prev);
            dirty.current = true;
        }
    };
    const redo = () => {
        const next = future.current.pop();
        if (next) {
            past.current.push(projectRef.current);
            setProject(next);
            dirty.current = true;
        }
    };
    const saveDraftNow = async () => {
        const p = projectRef.current;
        queue.current = queue.current.catch(() => {}).then(() => persistDraft(p));
        await queue.current;
        if (projectRef.current === p) {
            dirty.current = false;
            setSaveState('已保存到本机');
        }
    };
    useEffect(() => {
        let alive = true;
        Promise.all([
            loadFonts(),
            restoreDraft((message) => {
                if (alive) setNotice(message);
            }),
        ])
            .then(([f, p]) => {
                if (!alive) return;
                setFonts(f);
                if (p) setProject(p);
                setReady(true);
                setSaveState('已保存到本机');
            })
            .catch(async (e) => {
                if (!alive) return;
                setError(`草稿恢复失败：${e.message}`);
                try {
                    setFonts(await loadFonts());
                    setReady(true);
                } catch (err) {
                    setError(String(err));
                }
            });
        return () => {
            alive = false;
        };
    }, []);
    useEffect(() => {
        if (!ready) return;
        setSaveState('保存中…');
        const timer = setTimeout(() => {
            saveDraftNow().catch((e) => {
                setSaveState('自动保存失败');
                setError(e.message);
            });
        }, 600);
        return () => clearTimeout(timer);
    }, [project, ready]);
    useEffect(() => {
        const before = (e: BeforeUnloadEvent) => {
            if (dirty.current) {
                e.preventDefault();
                e.returnValue = '标签草稿正在保存，请稍后关闭。';
            }
        };
        window.addEventListener('beforeunload', before);
        return () => window.removeEventListener('beforeunload', before);
    }, []);
    useEffect(() => {
        if (!open || printPreview || printOpen) return;
        const key = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable],[role="listbox"]')) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                removeLayer();
            }
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [open, selected, printPreview, printOpen]);
    const switchTemplate = (id: TemplateId) => {
        commit((p) => {
            p.active = id;
            p.designs[id] ||= newDesign(id);
        });
        setSelected('');
        setPanel('main');
        setSeparated(false);
        setSvgTarget('all');
    };
    const addLayer = (kind: Layer['kind'], patch: Partial<Layer> = {}) => {
        const p = def.panels.find((p) => p.id === actualPanel)!;
        const next = layer(kind, actualPanel, actualFace, {
            width: Math.max(1, (p.artworkWidth ?? p.width) - 4),
            height: kind === 'text' ? 12 : Math.max(1, Math.min((p.artworkWidth ?? p.width) - 4, (p.artworkHeight ?? p.height) - 4)),
            ...patch,
        });
        commit((p) => p.designs[p.active]!.layers.push(next));
        setSelected(next.id);
    };
    const removeLayer = () =>
        commit((p) => {
            const d = p.designs[p.active]!;
            d.layers = d.layers.filter((l) => l.id !== selected || l.locked);
        });
    const duplicate = () => {
        if (!activeLayer) return;
        const l = {
            ...clone(activeLayer),
            id: uid(),
            name: activeLayer.name + ' 副本',
            x: activeLayer.x + 1,
            y: activeLayer.y + 1,
            locked: false,
        };
        commit((p) => p.designs[p.active]!.layers.push(l));
        setSelected(l.id);
    };
    const moveLayer = (source: string, target: string, after = false, remember = true) => {
        const current = projectRef.current;
        const currentLayers = current.designs[current.active]!.layers;
        if (movePanelLayer(currentLayers, source, target, after) === currentLayers) return false;
        commit((p) => {
            p.designs[p.active]!.layers = movePanelLayer(p.designs[p.active]!.layers, source, target, after);
        }, remember);
        return true;
    };
    const reorder = (delta: number) => {
        if (!activeLayer || activeLayer.locked) return;
        const ordered = design.layers.filter((l) => l.panel === actualPanel && l.face === actualFace).reverse();
        const target = ordered[ordered.findIndex((l) => l.id === selected) - delta];
        if (target) moveLayer(selected, target.id, delta < 0);
    };
    const mergeData = (data: AlbumData) => {
        commit((p) => {
            if (mode === 'replace') p.data = { ...data, credits: p.data.credits, lyrics: p.data.lyrics };
            else p.data.tracks.push(...data.tracks);
        });
        setNotice(`已${mode === 'replace' ? '导入' : '追加'} ${data.tracks.length} 首曲目，设备内容未修改`);
    };
    const importCurrent = (selectedOnly = false) => {
        if (!disc) return;
        mergeData(dataFromDisc(disc, selectedOnly ? selectedTracks : undefined, conversion));
    };
    const exportSVG = () =>
        run(async () => {
            if (!fonts) return;
            const opts = svgTarget.startsWith('piece')
                ? { panel: 'main', piece: Number(svgTarget.slice(5)) }
                : svgTarget === 'all'
                  ? {}
                  : { panel: svgTarget };
            const r = renderExport(project, design, actualFace, fonts, opts);
            setExportWarnings(r.warnings);
            downloadBlob(
                new Blob([svgDocument(r)], { type: 'image/svg+xml' }),
                `${project.name}-${templateNames[project.active]}-${actualFace}.svg`
            );
            setNotice(`已生成实际尺寸 SVG，出血 ${project.print.bleed} mm${project.print.crop ? '，含裁切标记' : ''}，文字已转为路径`);
        });
    const showPrintPreview = () => setPrintPreview(true);
    const exportPDF = () =>
        run(async () => {
            if (!fonts) return;
            if (!window.native?.labels) throw new Error('PDF 导出需要在 ElectronWMD 桌面应用中运行');
            const output = printPages(project, fonts);
            setExportWarnings(output.warnings);
            const bytes = await window.native.labels.renderPdf({ pages: output.pages, paperSize: output.paperSize });
            downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `${project.name}.pdf`);
            setNotice(`已生成 ${output.pages.length} 页 PDF，请按 100% 实际尺寸打印${output.warnings.length ? '；请检查排版提示' : ''}`);
        });
    const examples = () =>
        run(async () => {
            const zip = new JSZip();
            for (const id of templateIds) {
                const p = await exampleProject(id);
                zip.file(`${templateNames[id]}.mdlabel`, await saveProject(p));
            }
            downloadBlob(await zip.generateAsync({ type: 'blob' }), 'MD-五类示例工程.zip');
        });
    const viewW = rendered?.width || def.width,
        viewH = rendered?.height || def.height;
    const displayScale = fitEditorScale(viewW, viewH, canvasSize.width, canvasSize.height) * zoom;
    const layers = design.layers.filter((l) => l.panel === actualPanel && l.face === actualFace);

    const toolsPanel = fonts && (
        <div className="md-tool-panel">
            <div className="md-panel-heading">
                <h2>模板与内容</h2>
                {narrow && (
                    <button aria-label="关闭内容工具" title="关闭内容工具" onClick={() => setDrawer(null)}>
                        <StudioIcon name="close" />
                    </button>
                )}
            </div>
            <div className="md-template-slot">
                <TemplatePicker value={project.active} onChange={switchTemplate} disabled={!ready || busy} />
            </div>
            <nav className="md-tabs" aria-label="内容工具">
                {tabs.map(([id, name, icon]) => (
                    <button key={id} aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                        <StudioIcon name={icon} size={16} />
                        <span>{name}</span>
                    </button>
                ))}
            </nav>
            <div className="md-tab-content">
                {tab === 'text' && (
                    <>
                        <h3>专辑与歌曲</h3>
                        <div className="md-field-row">
                            <label className="md-field">
                                <span>专辑 / 盘名</span>
                                <input
                                    value={project.data.album}
                                    onChange={(e) =>
                                        commit((p) => {
                                            p.data.album = e.target.value;
                                        })
                                    }
                                />
                            </label>
                            <label className="md-field">
                                <span>艺术家</span>
                                <input
                                    value={project.data.artist}
                                    onChange={(e) =>
                                        commit((p) => {
                                            p.data.artist = e.target.value;
                                        })
                                    }
                                />
                            </label>
                            <label className="md-field">
                                <span>插入方向提示</span>
                                <input
                                    value={project.data.direction}
                                    onChange={(e) =>
                                        commit((p) => {
                                            p.data.direction = e.target.value;
                                        })
                                    }
                                />
                            </label>
                        </div>
                        <details className="md-import-details">
                            <summary>从 MD 或文件导入曲目</summary>
                            <div className="md-data-import">
                                <Select
                                    label="导入方式"
                                    value={mode}
                                    onChange={(v) => setMode(v as typeof mode)}
                                    options={[
                                        ['replace', '替换曲目'],
                                        ['append', '追加曲目'],
                                    ]}
                                />
                                <Select
                                    label="汉字转换"
                                    value={conversion}
                                    options={[
                                        ['none', '保持原格式'],
                                        ['simplified', '日文汉字 → 简体中文'],
                                        ['traditional', '日文汉字 → 繁体中文'],
                                    ]}
                                    onChange={(value) => {
                                        setConversion(value as ChineseConversion);
                                        try {
                                            localStorage.setItem('md-import-chinese', value);
                                        } catch {}
                                    }}
                                />
                                <small>汉字字形转换，不是日文翻译；仅影响 MD 新导入数据。</small>
                                <button disabled={!disc} onClick={() => importCurrent()}>
                                    从当前 MD 导入
                                </button>
                                <button disabled={!disc || !selectedTracks?.length} onClick={() => importCurrent(true)}>
                                    导入选中曲目
                                </button>
                                <button onClick={() => fileMusic.current?.click()}>CSV / M3U</button>
                            </div>
                        </details>
                        <div className="md-binding-buttons">
                            {(
                                [
                                    ['album', '专辑'],
                                    ['artist', '艺术家'],
                                    ['tracks', '曲目'],
                                    ['credits', '制作信息'],
                                    ['lyrics', '歌词'],
                                    ['direction', '方向提示'],
                                ] as [Binding, string][]
                            ).map(([binding, name]) => (
                                <button key={binding} aria-label={`添加${name}`} onClick={() => addLayer('text', { binding, name })}>
                                    <StudioIcon name="plus" size={16} /> {name}
                                </button>
                            ))}
                        </div>
                        <details>
                            <summary>
                                曲目列表 · {project.data.tracks.length} 首 ·{' '}
                                {formatDuration(project.data.tracks.reduce((s, t) => s + (t.duration || 0), 0))}
                            </summary>
                            <div className="md-tracks">
                                {project.data.tracks.map((t, i) => (
                                    <div
                                        className="md-track"
                                        key={t.id}
                                        draggable
                                        onDragStart={() => setDragTrack(i)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (dragTrack === null) return;
                                            commit((p) => {
                                                const [track] = p.data.tracks.splice(dragTrack, 1);
                                                p.data.tracks.splice(i, 0, track);
                                            });
                                            setDragTrack(null);
                                        }}
                                    >
                                        <span>⠿ {i + 1}</span>
                                        <input
                                            aria-label={`曲目 ${i + 1} 标题`}
                                            value={t.title}
                                            onChange={(e) =>
                                                commit((p) => {
                                                    p.data.tracks[i].title = e.target.value;
                                                })
                                            }
                                        />
                                        <input
                                            aria-label={`曲目 ${i + 1} 艺术家`}
                                            placeholder="艺术家"
                                            value={t.artist}
                                            onChange={(e) =>
                                                commit((p) => {
                                                    p.data.tracks[i].artist = e.target.value;
                                                })
                                            }
                                        />
                                        <input
                                            aria-label={`曲目 ${i + 1} 时长（秒）`}
                                            type="number"
                                            min="0"
                                            placeholder="秒"
                                            value={t.duration ?? ''}
                                            onChange={(e) =>
                                                commit((p) => {
                                                    p.data.tracks[i].duration =
                                                        e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                                                })
                                            }
                                        />
                                        <button
                                            aria-label={`删除曲目 ${i + 1}`}
                                            title={`删除曲目 ${i + 1}`}
                                            onClick={() =>
                                                commit((p) => {
                                                    p.data.tracks.splice(i, 1);
                                                })
                                            }
                                        >
                                            <StudioIcon name="close" size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <textarea
                                aria-label="粘贴曲目列表"
                                placeholder={'每行一首歌曲，可附时长\n夜行列車 (3:42)'}
                                value={playlist}
                                onChange={(e) => setPlaylist(e.target.value)}
                            />
                            <button
                                onClick={() => {
                                    commit((p) => {
                                        p.data.tracks.push(...parsePlaylist(playlist));
                                    });
                                    setPlaylist('');
                                }}
                                disabled={!playlist.trim()}
                            >
                                添加曲目
                            </button>
                        </details>
                        <details>
                            <summary>歌词与制作信息（支持标题、粗体、斜体和列表）</summary>
                            <label className="md-field">
                                <span>歌词</span>
                                <textarea
                                    value={project.data.lyrics}
                                    onChange={(e) =>
                                        commit((p) => {
                                            p.data.lyrics = e.target.value;
                                        })
                                    }
                                />
                            </label>
                            <label className="md-field">
                                <span>制作信息</span>
                                <textarea
                                    value={project.data.credits}
                                    onChange={(e) =>
                                        commit((p) => {
                                            p.data.credits = e.target.value;
                                        })
                                    }
                                />
                            </label>
                        </details>
                    </>
                )}
                {['art', 'logo', 'decal', 'background'].includes(tab) && (
                    <>
                        <div className="md-data-import">
                            <strong>{tabs.find(([id]) => id === tab)?.[1]}</strong>
                            <button onClick={() => fileImage.current?.click()}>
                                <StudioIcon name="plus" size={16} /> 导入图片 / SVG
                            </button>
                        </div>
                        <AssetLibrary
                            project={project}
                            tab={tab}
                            busy={busy}
                            onAdd={(asset) => {
                                const target = def.panels.find((p) => p.id === actualPanel)!;
                                const pw = target.artworkWidth ?? target.width,
                                    ph = target.artworkHeight ?? target.height;
                                const width = Math.max(1, Math.min(30, pw - 4, ((ph - 4) * asset.width) / asset.height));
                                const next = layer('image', actualPanel, actualFace, {
                                    name: asset.name,
                                    assetId: asset.id,
                                    fit: 'contain',
                                    width,
                                    height: (width * asset.height) / asset.width,
                                    ...(tab === 'background' ? { x: 0, y: 0, width: pw, height: ph, fit: 'cover' as const } : {}),
                                });
                                commit((p) => {
                                    p.assets[asset.id] = asset;
                                    const layers = p.designs[p.active]!.layers;
                                    tab === 'background' ? layers.unshift(next) : layers.push(next);
                                });
                                setSelected(next.id);
                            }}
                            onRename={(id, name) =>
                                commit((p) => {
                                    p.assets[id] = { ...p.assets[id], name };
                                })
                            }
                            onDelete={(id) =>
                                commit((p) => {
                                    delete p.assets[id];
                                })
                            }
                            onError={setError}
                        />
                        {tab === 'logo' && (
                            <div className="md-preset-row">
                                {['MD', 'STEREO', 'Hi-Fi', 'LP2', 'LP4', 'DIGITAL AUDIO', 'LIVE RECORDING'].map((text) => (
                                    <button
                                        key={text}
                                        onClick={() =>
                                            addLayer('text', {
                                                name: text,
                                                text,
                                                fontSize: 4,
                                                weight: 700,
                                                width: 25,
                                                height: 8,
                                            })
                                        }
                                    >
                                        {text}
                                    </button>
                                ))}
                            </div>
                        )}
                        {(tab === 'decal' || tab === 'background') && (
                            <div className="md-preset-row">
                                {(
                                    [
                                        ['rect', '色块'],
                                        ['ellipse', '圆形'],
                                        ['stripe', '条纹'],
                                        ['dots', '圆点'],
                                    ] as [Layer['shape'], string][]
                                ).map(([shape, name]) => (
                                    <button
                                        key={shape}
                                        onClick={() => addLayer('shape', { shape, name, opacity: tab === 'background' ? 0.25 : 1 })}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {tab === 'background' && (
                            <label className="md-field">
                                <span>模板底色</span>
                                <input
                                    type="color"
                                    value={actualFace === 'back' ? design.backBackground ?? design.background : design.background}
                                    onChange={(e) =>
                                        editDesign(
                                            actualFace === 'back' ? { backBackground: e.target.value } : { background: e.target.value }
                                        )
                                    }
                                />
                            </label>
                        )}
                    </>
                )}
                {tab === 'code' && (
                    <>
                        <h3>本地生成代码</h3>
                        <p className="md-muted">二维码不需要联网；可放入网址或自定义文字。</p>
                        <div className="md-preset-row">
                            {(['qrcode', 'ean13', 'code128'] as const).map((code) => (
                                <button
                                    key={code}
                                    onClick={() =>
                                        addLayer('code', {
                                            name: code === 'qrcode' ? '二维码' : code.toUpperCase(),
                                            code,
                                            text:
                                                code === 'ean13'
                                                    ? '123456789012'
                                                    : code === 'qrcode'
                                                      ? 'https://minidisc.wiki'
                                                      : 'MINIDISC',
                                            width: code === 'qrcode' ? 18 : 35,
                                            height: code === 'qrcode' ? 18 : 12,
                                        })
                                    }
                                >
                                    <StudioIcon name="plus" size={16} /> {code === 'qrcode' ? '二维码' : code.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {tab === 'layout' && (
                    <>
                        <h3>{templateNames[project.active]} · 毫米尺寸</h3>
                        <div className="md-field-row">
                            <NumberField
                                label="主面板宽度"
                                value={design.frontWidth}
                                min={1}
                                max={500}
                                onChange={(v) => editDesign({ frontWidth: v })}
                            />
                            <NumberField label="高度" value={design.height} min={1} max={500} onChange={(v) => editDesign({ height: v })} />
                            {['jcard', 'cover'].includes(project.active) && (
                                <>
                                    <NumberField
                                        label="面板数量"
                                        value={design.panels}
                                        min={project.active === 'jcard' ? 3 : 1}
                                        max={project.active === 'jcard' ? 5 : 6}
                                        step={1}
                                        onChange={(v) => editDesign({ panels: Math.round(v) })}
                                    />
                                    <NumberField
                                        label="扩展折页宽度"
                                        value={design.foldWidth}
                                        min={1}
                                        max={500}
                                        onChange={(v) => editDesign({ foldWidth: v })}
                                    />
                                </>
                            )}
                            {['jcard', 'tray'].includes(project.active) && (
                                <NumberField
                                    label="书脊宽度"
                                    value={design.spineWidth}
                                    min={1}
                                    max={100}
                                    onChange={(v) => editDesign({ spineWidth: v })}
                                />
                            )}
                            {project.active === 'jcard' && (
                                <>
                                    <NumberField
                                        label="折翼宽度"
                                        value={design.flapWidth}
                                        min={1}
                                        max={100}
                                        onChange={(v) => editDesign({ flapWidth: v })}
                                    />
                                    <Select
                                        label="书脊方向"
                                        value={design.orientation}
                                        onChange={(v) => editDesign({ orientation: v as Design['orientation'] })}
                                        options={[
                                            ['left', '左侧'],
                                            ['bottom', '底部'],
                                        ]}
                                    />
                                </>
                            )}
                            {['label', 'full'].includes(project.active) && (
                                <>
                                    <NumberField
                                        label="侧标宽度"
                                        value={design.sideWidth}
                                        min={1}
                                        max={100}
                                        onChange={(v) => editDesign({ sideWidth: v })}
                                    />
                                    <NumberField
                                        label="侧标高度"
                                        value={design.sideHeight}
                                        min={1}
                                        max={500}
                                        onChange={(v) => editDesign({ sideHeight: v })}
                                    />
                                </>
                            )}
                        </div>
                        {['jcard', 'cover', 'tray'].includes(project.active) && (
                            <Check label="启用双面编辑与打印" value={design.duplex} onChange={(v) => editDesign({ duplex: v })} />
                        )}
                        <p className="md-muted">折页减少时内容仍保存在工程中。修改尺寸后请检查文字位置与裁切安全线。</p>
                        <div className="md-preset-row">
                            <button
                                onClick={() =>
                                    run(async () => {
                                        const p = await exampleProject(project.active);
                                        commit((current) => {
                                            Object.assign(current, p);
                                        });
                                        setSelected('');
                                        setNotice('已载入当前模板示例，可撤销');
                                    })
                                }
                            >
                                载入本模板示例
                            </button>
                            <button onClick={examples}>下载五类示例工程</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
    const inspectorPanel = fonts && (
        <div className="md-inspector-panel" ref={inspectorHeight.setContainer}>
            <div className="md-panel-heading">
                <h2>图层与属性</h2>
                {compact && (
                    <button aria-label="关闭图层属性" title="关闭图层属性" onClick={() => setDrawer(null)}>
                        <StudioIcon name="close" />
                    </button>
                )}
            </div>
            <aside
                id="md-layer-list"
                className="md-layer-list"
                style={{ flexBasis: inspectorHeight.height }}
                onPointerMove={(e) => {
                    const start = draggedLayer.current;
                    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
                    const target = layerAtPointer(e.clientX, e.clientY);
                    setLayerDrop(target);
                    if (target && moveLayer(start.id, target.id, target.after, !start.started)) start.started = true;
                }}
                onPointerUp={(e) => {
                    draggedLayer.current = null;
                    setLayerDrop(null);
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                    draggedLayer.current = null;
                    setLayerDrop(null);
                }}
                onLostPointerCapture={() => {
                    draggedLayer.current = null;
                    setLayerDrop(null);
                }}
            >
                <div className="md-section-heading">{def.panels.find((p) => p.id === actualPanel)?.name} · 图层</div>
                {[...layers].reverse().map((l) => (
                    <div
                        key={l.id}
                        className={`md-layer-row ${selected === l.id ? 'active' : ''}`}
                        data-drop={layerDrop?.id === l.id ? (layerDrop.after ? 'after' : 'before') : undefined}
                        data-layer-id={l.id}
                    >
                        <button
                            className="md-layer-grip"
                            aria-label={`拖动图层 ${l.name}`}
                            title={`拖动图层 ${l.name}`}
                            disabled={l.locked}
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                                if (e.button !== 0 || l.locked) return;
                                e.preventDefault();
                                draggedLayer.current = { id: l.id, x: e.clientX, y: e.clientY };
                                e.currentTarget.closest<HTMLElement>('.md-layer-list')!.setPointerCapture(e.pointerId);
                            }}
                        >
                            <StudioIcon name="grip" size={16} />
                        </button>
                        <button
                            className="md-layer-visibility"
                            aria-label={`${l.visible ? '隐藏' : '显示'}图层 ${l.name}`}
                            title={`${l.visible ? '隐藏' : '显示'}图层 ${l.name}`}
                            aria-pressed={l.visible}
                            onClick={(e) => {
                                e.stopPropagation();
                                commit((p) => {
                                    const item = p.designs[p.active]!.layers.find((item) => item.id === l.id)!;
                                    item.visible = !item.visible;
                                });
                            }}
                        >
                            <StudioIcon name={l.visible ? 'visible' : 'hidden'} size={16} />
                        </button>
                        <button className="md-layer-name" aria-pressed={selected === l.id} onClick={() => setSelected(l.id)}>
                            <span>{l.name}</span>
                            <small>
                                {l.locked
                                    ? '锁定'
                                    : l.binding
                                      ? '关联数据'
                                      : { text: '文字', image: '图片', shape: '形状', code: '条码' }[l.kind]}
                                {l.localFont && !fonts?.local?.[l.localFont.postscriptName] ? ' · 缺少字体' : ''}
                            </small>
                        </button>
                    </div>
                ))}
                {!layers.length && <p>此面板还没有内容</p>}
            </aside>
            <div className="md-mini-buttons">
                <button onClick={() => addLayer('text')}>
                    <StudioIcon name="plus" size={16} /> 文字
                </button>
                <button onClick={duplicate} disabled={!activeLayer}>
                    复制
                </button>
                <button onClick={removeLayer} disabled={!activeLayer || activeLayer.locked}>
                    删除
                </button>
                <button onClick={() => reorder(1)} disabled={!activeLayer || activeLayer.locked}>
                    上移
                </button>
                <button onClick={() => reorder(-1)} disabled={!activeLayer || activeLayer.locked}>
                    下移
                </button>
            </div>

            <div
                className="md-inspector-resizer"
                role="separator"
                aria-label="调整图层与属性高度"
                aria-controls="md-layer-list"
                aria-orientation="horizontal"
                aria-valuenow={inspectorHeight.height}
                aria-valuemin={inspectorHeight.minHeight}
                aria-valuemax={inspectorHeight.maxHeight}
                aria-valuetext={`图层高度 ${inspectorHeight.height} 像素`}
                tabIndex={0}
                title="上下拖动调整图层与属性高度 · 双击复位"
                onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.currentTarget.focus();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    inspectorHeight.drag.current = { y: e.clientY, height: inspectorHeight.height };
                }}
                onPointerMove={(e) => {
                    const start = inspectorHeight.drag.current;
                    if (start) inspectorHeight.adjust(start.height + e.clientY - start.y);
                }}
                onPointerUp={(e) => {
                    inspectorHeight.drag.current = null;
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                    inspectorHeight.drag.current = null;
                }}
                onLostPointerCapture={() => {
                    inspectorHeight.drag.current = null;
                }}
                onDoubleClick={inspectorHeight.reset}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        inspectorHeight.adjust(inspectorHeight.height + (e.key === 'ArrowUp' ? -20 : 20));
                    } else if (e.key === 'Home' || e.key === 'End') {
                        e.preventDefault();
                        inspectorHeight.adjust(e.key === 'Home' ? inspectorHeight.minHeight : inspectorHeight.maxHeight);
                    }
                }}
            >
                <span className="md-resize-grip" aria-hidden="true" />
                <span>拖动调整图层 / 属性</span>
            </div>
            <div className="md-inspector-scroll" key={activeLayer?.id || 'empty'}>
                {!activeLayer && (
                    <div className="md-empty-selection">
                        <StudioIcon name="layers" />
                        <h3>选择一个图层</h3>
                        <p>点选预览中的内容或上方图层，调整文字、样式与毫米尺寸。</p>
                    </div>
                )}
                {activeLayer && (
                    <fieldset className="md-inspector" disabled={activeLayer.locked}>
                        <legend>所选图层 · {activeLayer.name}</legend>
                        <div className="md-property-group">
                            <h3>内容与样式</h3>
                            {activeLayer.kind === 'text' && (
                                <>
                                    <Select
                                        label="内容来源"
                                        value={activeLayer.binding || 'custom'}
                                        onChange={(v) =>
                                            editLayer({
                                                binding: v === 'custom' ? undefined : (v as Binding),
                                                text: boundText(activeLayer, project.data),
                                            })
                                        }
                                        options={[
                                            ['custom', '独立文字'],
                                            ['album', '共享专辑'],
                                            ['artist', '共享艺术家'],
                                            ['tracks', '共享曲目'],
                                            ['lyrics', '共享歌词'],
                                            ['credits', '共享制作信息'],
                                            ['direction', '方向提示'],
                                        ]}
                                    />
                                    {!activeLayer.binding && (
                                        <textarea
                                            aria-label="图层文字"
                                            value={activeLayer.text}
                                            onChange={(e) => editLayer({ text: e.target.value })}
                                        />
                                    )}
                                    <div className="md-field-row">
                                        <FontPicker
                                            key={activeLayer.id}
                                            layer={activeLayer}
                                            fonts={fonts}
                                            onChange={editLayer}
                                            onLoad={(ref, font) =>
                                                setFonts(
                                                    (current) =>
                                                        current && {
                                                            ...current,
                                                            local: { ...current.local, [ref.postscriptName]: font },
                                                        }
                                                )
                                            }
                                        />
                                        <NumberField
                                            label="字号（mm）"
                                            value={activeLayer.fontSize}
                                            min={0.3}
                                            max={100}
                                            onChange={(v) => editLayer({ fontSize: v })}
                                        />
                                        <Select
                                            label="字重"
                                            value={String(activeLayer.weight)}
                                            onChange={(v) => editLayer({ weight: Number(v) })}
                                            options={[
                                                ['400', '常规'],
                                                ['700', '粗体'],
                                            ]}
                                        />
                                        <NumberField
                                            label="行距"
                                            value={activeLayer.lineHeight}
                                            min={0.8}
                                            max={4}
                                            onChange={(v) => editLayer({ lineHeight: v })}
                                        />
                                        <Select
                                            label="对齐"
                                            value={activeLayer.align}
                                            onChange={(v) => editLayer({ align: v as Layer['align'] })}
                                            options={[
                                                ['left', '左对齐'],
                                                ['center', '居中'],
                                                ['right', '右对齐'],
                                            ]}
                                        />
                                        <Check label="斜体" value={activeLayer.italic} onChange={(v) => editLayer({ italic: v })} />
                                        <Check label="阴影" value={activeLayer.shadow} onChange={(v) => editLayer({ shadow: v })} />
                                        <Check label="描边" value={activeLayer.outline} onChange={(v) => editLayer({ outline: v })} />
                                    </div>
                                    {activeLayer.outline && (
                                        <div className="md-field-row">
                                            <label className="md-field">
                                                <span>描边颜色</span>
                                                <input
                                                    type="color"
                                                    value={textEffects(activeLayer).outlineColor}
                                                    onChange={(e) => editLayer({ outlineColor: e.target.value })}
                                                />
                                            </label>
                                            <NumberField
                                                label="描边宽度（mm）"
                                                value={textEffects(activeLayer).outlineWidth}
                                                min={0}
                                                max={5}
                                                step={0.05}
                                                onChange={(v) => editLayer({ outlineWidth: v })}
                                            />
                                            <Check
                                                label="柔化扩散"
                                                value={textEffects(activeLayer).outlineDiffuse}
                                                onChange={(v) => editLayer({ outlineDiffuse: v })}
                                            />
                                            <Check
                                                label="空心"
                                                value={textEffects(activeLayer).outlineHollow}
                                                onChange={(v) => editLayer({ outlineHollow: v })}
                                            />
                                        </div>
                                    )}
                                    {activeLayer.shadow && (
                                        <div className="md-field-row">
                                            <label className="md-field">
                                                <span>阴影颜色</span>
                                                <input
                                                    type="color"
                                                    value={textEffects(activeLayer).shadowColor}
                                                    onChange={(e) => editLayer({ shadowColor: e.target.value })}
                                                />
                                            </label>
                                            <NumberField
                                                label="阴影距离（mm）"
                                                value={textEffects(activeLayer).shadowDistance}
                                                min={0}
                                                max={20}
                                                step={0.1}
                                                onChange={(v) => editLayer({ shadowDistance: v })}
                                            />
                                        </div>
                                    )}
                                    {activeLayer.binding === 'tracks' && (
                                        <div className="md-field-row">
                                            <Select
                                                label="曲目列数"
                                                value={String(activeLayer.columns)}
                                                onChange={(v) => editLayer({ columns: Number(v) })}
                                                options={[
                                                    ['1', '单列'],
                                                    ['2', '双列'],
                                                ]}
                                            />
                                            {(
                                                [
                                                    ['numbers', '编号'],
                                                    ['artists', '艺术家'],
                                                    ['durations', '时长'],
                                                    ['bullets', '项目符号'],
                                                ] as const
                                            ).map(([key, label]) => (
                                                <Check
                                                    key={key}
                                                    label={label}
                                                    value={activeLayer[key]}
                                                    onChange={(v) => editLayer({ [key]: v })}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {activeLayer.kind === 'image' && (
                                <div className="md-field-row">
                                    <Select
                                        label="图片适配"
                                        value={activeLayer.fit}
                                        onChange={(v) => editLayer({ fit: v as Layer['fit'] })}
                                        options={[
                                            ['cover', '填充 / 裁切'],
                                            ['contain', '适应'],
                                            ['stretch', '拉伸'],
                                        ]}
                                    />
                                    <NumberField
                                        label="图片缩放"
                                        value={activeLayer.zoom}
                                        min={0.1}
                                        max={10}
                                        onChange={(v) => editLayer({ zoom: v })}
                                    />
                                    <NumberField
                                        label="裁切水平偏移"
                                        value={activeLayer.offsetX}
                                        onChange={(v) => editLayer({ offsetX: v })}
                                    />
                                    <NumberField
                                        label="裁切垂直偏移"
                                        value={activeLayer.offsetY}
                                        onChange={(v) => editLayer({ offsetY: v })}
                                    />
                                </div>
                            )}
                            {activeLayer.kind === 'code' && (
                                <label className="md-field">
                                    <span>代码内容</span>
                                    <input value={activeLayer.text} onChange={(e) => editLayer({ text: e.target.value })} />
                                </label>
                            )}
                            <div className="md-field-row">
                                <NumberField
                                    label="不透明度"
                                    value={activeLayer.opacity}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    onChange={(v) => editLayer({ opacity: v })}
                                />
                                <label className="md-field">
                                    <span>颜色</span>
                                    <input type="color" value={activeLayer.color} onChange={(e) => editLayer({ color: e.target.value })} />
                                </label>
                                <Check label="显示" value={activeLayer.visible} onChange={(v) => editLayer({ visible: v })} />
                            </div>
                        </div>
                        <div className="md-property-group">
                            <h3>位置与尺寸</h3>
                            <div className="md-field-row">
                                <label className="md-field md-wide">
                                    <span>图层名称</span>
                                    <input value={activeLayer.name} onChange={(e) => editLayer({ name: e.target.value })} />
                                </label>
                                <NumberField label="X（mm）" value={activeLayer.x} onChange={(v) => editLayer({ x: v })} />
                                <NumberField label="Y（mm）" value={activeLayer.y} onChange={(v) => editLayer({ y: v })} />
                                <NumberField
                                    label="宽（mm）"
                                    value={activeLayer.width}
                                    min={0.1}
                                    onChange={(v) => editLayer({ width: v })}
                                />
                                <NumberField
                                    label="高（mm）"
                                    value={activeLayer.height}
                                    min={0.1}
                                    onChange={(v) => editLayer({ height: v })}
                                />
                                <NumberField
                                    label="旋转（°）"
                                    value={activeLayer.rotation}
                                    min={-360}
                                    max={360}
                                    step={1}
                                    onChange={(v) => editLayer({ rotation: v })}
                                />
                            </div>
                        </div>
                    </fieldset>
                )}
                {activeLayer && <Check label="锁定所选图层" value={activeLayer.locked} onChange={(v) => editLayer({ locked: v })} />}
            </div>
        </div>
    );

    if (!open) return null;
    return (
        <Dialog fullScreen open={open} aria-label="MD 标签与包装编辑器" sx={{ zIndex: 1500 }}>
            <div className="md-editor">
                <header className="md-top">
                    <div className="md-brand">
                        <span className="md-brand-icon">
                            <DiscIcon size={30} />
                        </span>
                        <div>
                            <strong>MD Studio</strong>
                            <small>MiniDisc 标签工作台</small>
                        </div>
                    </div>
                    <input
                        className="md-project-name"
                        aria-label="工程名称"
                        value={project.name}
                        onChange={(e) =>
                            commit((p) => {
                                p.name = e.target.value;
                            })
                        }
                    />
                    <span className="md-save-state" role="status">
                        {saveState === '已保存到本机' ? '草稿已保存到本机' : saveState}
                    </span>
                    <button disabled={!ready || busy} onClick={() => fileProject.current?.click()}>
                        <StudioIcon name="open" /> 打开
                    </button>
                    <button
                        className="md-save-action"
                        title="保存包含全部模板与素材的 .mdlabel 工程文件"
                        disabled={!ready || busy}
                        onClick={() =>
                            run(async () => {
                                downloadBlob(await saveProject(project), `${project.name}.mdlabel`);
                                await saveDraftNow();
                                setNotice('工程已导出，包含全部模板与素材');
                            })
                        }
                    >
                        <StudioIcon name="save" /> 保存工程
                    </button>
                    <button className="md-primary md-output-action" onClick={() => setPrintOpen(true)} disabled={!ready || busy}>
                        <StudioIcon name="print" /> 排版 / 导出 PDF
                    </button>
                    <button
                        className="md-close"
                        aria-label="关闭编辑器"
                        title="关闭编辑器"
                        onClick={() =>
                            run(async () => {
                                await saveDraftNow();
                                onClose();
                            })
                        }
                    >
                        <StudioIcon name="close" />
                    </button>
                </header>
                {error && (
                    <div className="md-message md-error" role="alert">
                        {error}
                        <button onClick={() => setError('')}>关闭提示</button>
                    </div>
                )}
                {notice && (
                    <div className="md-message" role="status">
                        {notice}
                        <button aria-label="关闭提示" title="关闭提示" onClick={() => setNotice('')}>
                            <StudioIcon name="close" />
                        </button>
                    </div>
                )}
                {!ready || !fonts ? (
                    <div className="md-loading">正在加载离线字体和工程…</div>
                ) : (
                    <>
                        <div className="md-studio-grid">
                            {narrow ? (
                                <Drawer
                                    anchor="left"
                                    open={drawer === 'tools'}
                                    onClose={() => setDrawer(null)}
                                    sx={{ zIndex: 1550 }}
                                    PaperProps={{
                                        className: 'md-studio-surface md-drawer',
                                        role: 'dialog',
                                        'aria-label': '模板与内容',
                                        'aria-modal': true,
                                    }}
                                >
                                    {toolsPanel}
                                </Drawer>
                            ) : (
                                <aside className="md-left" aria-label="模板与内容">
                                    {toolsPanel}
                                </aside>
                            )}
                            <section className="md-workspace" aria-label="标签预览工作区">
                                <div className="md-canvas-toolbar">
                                    {narrow && (
                                        <button aria-expanded={drawer === 'tools'} onClick={() => setDrawer('tools')}>
                                            <StudioIcon name="panel" /> 模板与工具
                                        </button>
                                    )}
                                    {compact && (
                                        <button aria-expanded={drawer === 'inspector'} onClick={() => setDrawer('inspector')}>
                                            <StudioIcon name="layers" /> 图层与属性
                                        </button>
                                    )}
                                    <span className="md-current-template">{templateNames[project.active]}</span>
                                    <Select
                                        label="编辑面板"
                                        value={actualPanel}
                                        onChange={(v) => {
                                            setPanel(v);
                                            setSelected('');
                                        }}
                                        options={def.panels.map((p) => [p.id, p.name])}
                                    />
                                    {design.duplex && (
                                        <Select
                                            label="正反面"
                                            value={actualFace}
                                            onChange={(v) => {
                                                setFace(v as Face);
                                                setSelected('');
                                            }}
                                            options={[
                                                ['front', '外侧 / 正面'],
                                                ['back', '内侧 / 背面'],
                                            ]}
                                        />
                                    )}
                                </div>
                                <div className="md-view-toolbar" aria-label="画布工具">
                                    <button aria-label="撤销" disabled={!past.current.length} onClick={undo} title="撤销（⌘/Ctrl Z）">
                                        <StudioIcon name="undo" />
                                    </button>
                                    <button
                                        aria-label="重做"
                                        title="重做（⌘/Ctrl Shift Z）"
                                        disabled={!future.current.length}
                                        onClick={redo}
                                    >
                                        <StudioIcon name="redo" />
                                    </button>
                                    <Check label="网格" value={grid} onChange={setGrid} />
                                    <Check label="安全线" value={guides} onChange={setGuides} />
                                    <Check label="吸附" value={snap} onChange={setSnap} />
                                    <label className="md-check" title={def.folds.length ? '仅显示或隐藏设计画布折线' : '此模板无折线'}>
                                        <input
                                            type="checkbox"
                                            checked={showFolds && def.folds.length > 0}
                                            disabled={!def.folds.length}
                                            onChange={(e) => {
                                                setShowFolds(e.target.checked);
                                                try {
                                                    localStorage.setItem('md-show-folds', String(e.target.checked));
                                                } catch {
                                                    /* Optional UI preference. */
                                                }
                                            }}
                                        />
                                        折线
                                    </label>
                                    <label className="md-zoom">
                                        <span title="相对于适合窗口；不改变打印尺寸">{zoom.toFixed(1)}×</span>{' '}
                                        <input
                                            aria-label="预览缩放"
                                            type="range"
                                            min=".5"
                                            max="3"
                                            step=".1"
                                            value={zoom}
                                            onChange={(e) => setZoom(Number(e.target.value))}
                                        />
                                    </label>
                                    <button onClick={() => setZoom(1)} title="按窗口宽高适配，不改变打印尺寸">
                                        适合窗口
                                    </button>
                                </div>
                                <div
                                    className="md-canvas-scroll"
                                    ref={setCanvasViewport}
                                    onPointerDown={(e) => {
                                        // Layer hit areas and resize handles stop propagation before this point.
                                        if (e.isPrimary && e.button === 0 && !drag.current && project === deferred) setSelected('');
                                    }}
                                >
                                    <div className="md-artboard-wrap" style={{ width: viewW * displayScale + 28 }}>
                                        <div className="md-ruler" style={{ width: viewW * displayScale }}>
                                            {Array.from({ length: Math.floor(viewW / 10) + 1 }, (_, i) => (
                                                <span key={i} style={{ left: i * 10 * displayScale }}>
                                                    {i * 10}
                                                </span>
                                            ))}
                                            <i>mm</i>
                                        </div>
                                        <div className="md-artboard" style={{ width: viewW * displayScale, height: viewH * displayScale }}>
                                            {rendered && (
                                                <div className="md-artwork" dangerouslySetInnerHTML={{ __html: svgDocument(rendered) }} />
                                            )}
                                            <svg
                                                className="md-handles"
                                                style={{ pointerEvents: project !== deferred && !drag.current ? 'none' : 'auto' }}
                                                viewBox={`0 0 ${viewW} ${viewH}`}
                                                onPointerMove={(e) => {
                                                    const q = drag.current;
                                                    if (!q || q.pointerId !== e.pointerId) return;
                                                    // A pending capture can be released before got/lostpointercapture fires.
                                                    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !(e.buttons & 1)) {
                                                        drag.current = null;
                                                        return;
                                                    }
                                                    if (q.rotation && q.original) {
                                                        const point = pointerOnCanvas(e.currentTarget, e.clientX, e.clientY);
                                                        if (
                                                            !point ||
                                                            Math.hypot(point.x - q.rotation.center.x, point.y - q.rotation.center.y) *
                                                                q.scale <
                                                                2
                                                        )
                                                            return;
                                                        if (!q.started && Math.hypot(e.clientX - q.startX, e.clientY - q.startY) < 2)
                                                            return;
                                                        const angle =
                                                            (Math.atan2(point.y - q.rotation.center.y, point.x - q.rotation.center.x) *
                                                                180) /
                                                            Math.PI;
                                                        q.rotation.delta += rotationDelta(q.rotation.previous, angle);
                                                        q.rotation.previous = angle;
                                                        const next = rotateLayer(
                                                            q.original,
                                                            q.original.rotation + q.rotation.delta,
                                                            e.shiftKey
                                                        );
                                                        if (next.rotation === q.rotation.applied) return;
                                                        q.rotation.applied = next.rotation;
                                                        const remember = !q.started;
                                                        q.started = true;
                                                        commit((p) => {
                                                            const l = p.designs[p.active]!.layers.find((l) => l.id === q.id);
                                                            if (l && !l.locked) Object.assign(l, next);
                                                        }, remember);
                                                        return;
                                                    }
                                                    const { x: dx, y: dy } = panelDelta(
                                                        (e.clientX - q.startX) / q.scale,
                                                        (e.clientY - q.startY) / q.scale,
                                                        q.orientation === 'bottom'
                                                    );
                                                    if (!q.started && Math.abs(dx) + Math.abs(dy) < 0.05) return;
                                                    const remember = !q.started;
                                                    q.started = true;
                                                    const round = (v: number) => (snap ? Math.round(v * 2) / 2 : v);
                                                    commit((p) => {
                                                        const l = p.designs[p.active]!.layers.find((l) => l.id === q.id);
                                                        if (l) {
                                                            if (q.handle && q.original)
                                                                Object.assign(
                                                                    l,
                                                                    resizeLayer(q.original, q.handle, dx, dy, snap, e.shiftKey)
                                                                );
                                                            else {
                                                                l.x = round(q.x + dx);
                                                                l.y = round(q.y + dy);
                                                            }
                                                        }
                                                    }, remember);
                                                }}
                                                onPointerUp={(e) => {
                                                    if (drag.current?.pointerId === e.pointerId) drag.current = null;
                                                    if (e.currentTarget.hasPointerCapture(e.pointerId))
                                                        e.currentTarget.releasePointerCapture(e.pointerId);
                                                }}
                                                onPointerCancel={(e) => {
                                                    if (drag.current?.pointerId === e.pointerId) drag.current = null;
                                                }}
                                                onLostPointerCapture={(e) => {
                                                    if (drag.current?.pointerId === e.pointerId) drag.current = null;
                                                }}
                                            >
                                                {grid && (
                                                    <g pointerEvents="none">
                                                        <defs>
                                                            <pattern
                                                                id="md-preview-grid"
                                                                width="5"
                                                                height="5"
                                                                patternUnits="userSpaceOnUse"
                                                            >
                                                                <path
                                                                    d="M5 0H0V5"
                                                                    fill="none"
                                                                    stroke="#527975"
                                                                    strokeWidth=".1"
                                                                    opacity=".45"
                                                                />
                                                            </pattern>
                                                        </defs>
                                                        <rect width={viewW} height={viewH} fill="url(#md-preview-grid)" />
                                                    </g>
                                                )}
                                                {showFolds && <FoldGuides definition={def} />}
                                                {rendered?.hits.map((hit) => {
                                                    const l = design.layers.find((l) => l.id === hit.id);
                                                    if (!l) return null;
                                                    return (
                                                        <rect
                                                            key={hit.id}
                                                            data-layer-id={hit.id}
                                                            x={hit.x}
                                                            y={hit.y}
                                                            width={hit.width}
                                                            height={hit.height}
                                                            fill="transparent"
                                                            stroke={hit.id === selected ? 'var(--md-accent)' : 'none'}
                                                            strokeWidth=".3"
                                                            strokeDasharray="1 .6"
                                                            style={{ cursor: l.locked ? 'not-allowed' : 'move' }}
                                                            onPointerDown={(e) => {
                                                                e.stopPropagation();
                                                                if (!e.isPrimary || e.button !== 0) return;
                                                                setPanel(l.panel);
                                                                setSelected(l.id);
                                                                if (l.locked) return;
                                                                const svg = e.currentTarget.ownerSVGElement!;
                                                                svg.setPointerCapture(e.pointerId);
                                                                drag.current = {
                                                                    pointerId: e.pointerId,
                                                                    id: l.id,
                                                                    x: l.x,
                                                                    y: l.y,
                                                                    startX: e.clientX,
                                                                    startY: e.clientY,
                                                                    scale: svg.getBoundingClientRect().width / viewW,
                                                                    started: false,
                                                                    orientation: design.template === 'jcard' ? design.orientation : 'left',
                                                                    panel: l.panel,
                                                                };
                                                            }}
                                                        />
                                                    );
                                                })}
                                                {activeLayer?.visible &&
                                                    !activeLayer.locked &&
                                                    !(separated && design.template === 'full') &&
                                                    (() => {
                                                        const p = def.panels.find((p) => p.id === activeLayer.panel)!;
                                                        const points = ['nw', 'ne', 'se', 'sw'].map((h) => {
                                                            const pt = handlePoint(
                                                                h as ResizeHandle,
                                                                activeLayer.width,
                                                                activeLayer.height
                                                            );
                                                            return canvasPoint(activeLayer, p, pt.x, pt.y);
                                                        });
                                                        const size = 9 / displayScale;
                                                        return (
                                                            <g>
                                                                <polygon
                                                                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                                                                    fill="none"
                                                                    stroke="var(--md-accent)"
                                                                    strokeWidth={1 / displayScale}
                                                                    pointerEvents="none"
                                                                />
                                                                {rotationCorners.map((corner) => (
                                                                    <polygon
                                                                        key={corner}
                                                                        data-rotate-corner={corner}
                                                                        aria-label={`旋转图层 ${corner}`}
                                                                        className="md-rotation-zone"
                                                                        points={rotationZone(activeLayer, p, corner, displayScale)
                                                                            .map((pt) => `${pt.x},${pt.y}`)
                                                                            .join(' ')}
                                                                        fill="transparent"
                                                                        onPointerDown={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!e.isPrimary || e.button !== 0) return;
                                                                            e.preventDefault();
                                                                            const svg = e.currentTarget.ownerSVGElement!;
                                                                            const point = pointerOnCanvas(svg, e.clientX, e.clientY);
                                                                            if (!point) return;
                                                                            const center = canvasPoint(
                                                                                activeLayer,
                                                                                p,
                                                                                activeLayer.width / 2,
                                                                                activeLayer.height / 2
                                                                            );
                                                                            svg.setPointerCapture(e.pointerId);
                                                                            drag.current = {
                                                                                pointerId: e.pointerId,
                                                                                id: activeLayer.id,
                                                                                x: activeLayer.x,
                                                                                y: activeLayer.y,
                                                                                startX: e.clientX,
                                                                                startY: e.clientY,
                                                                                scale: svg.getBoundingClientRect().width / viewW,
                                                                                started: false,
                                                                                orientation: p.rotation === -90 ? 'bottom' : 'left',
                                                                                panel: p.id,
                                                                                original: { ...activeLayer },
                                                                                rotation: {
                                                                                    center,
                                                                                    previous:
                                                                                        (Math.atan2(
                                                                                            point.y - center.y,
                                                                                            point.x - center.x
                                                                                        ) *
                                                                                            180) /
                                                                                        Math.PI,
                                                                                    delta: 0,
                                                                                    applied: normalizeRotation(activeLayer.rotation),
                                                                                },
                                                                            };
                                                                        }}
                                                                    >
                                                                        <title>拖动旋转；按住 Shift 每 15° 吸附</title>
                                                                    </polygon>
                                                                ))}
                                                                {resizeHandles.map((h) => {
                                                                    const local = handlePoint(h, activeLayer.width, activeLayer.height);
                                                                    const pt = canvasPoint(activeLayer, p, local.x, local.y);
                                                                    return (
                                                                        <rect
                                                                            key={h}
                                                                            data-resize-handle={h}
                                                                            aria-label={`调整大小 ${h}`}
                                                                            x={pt.x - size / 2}
                                                                            y={pt.y - size / 2}
                                                                            width={size}
                                                                            height={size}
                                                                            fill="white"
                                                                            stroke="var(--md-accent)"
                                                                            strokeWidth={1.5 / displayScale}
                                                                            style={{ cursor: 'crosshair' }}
                                                                            onPointerDown={(e) => {
                                                                                e.stopPropagation();
                                                                                if (!e.isPrimary || e.button !== 0) return;
                                                                                const svg = e.currentTarget.ownerSVGElement!;
                                                                                svg.setPointerCapture(e.pointerId);
                                                                                drag.current = {
                                                                                    pointerId: e.pointerId,
                                                                                    id: activeLayer.id,
                                                                                    x: activeLayer.x,
                                                                                    y: activeLayer.y,
                                                                                    startX: e.clientX,
                                                                                    startY: e.clientY,
                                                                                    scale: svg.getBoundingClientRect().width / viewW,
                                                                                    started: false,
                                                                                    orientation: p.rotation === -90 ? 'bottom' : 'left',
                                                                                    panel: p.id,
                                                                                    original: { ...activeLayer },
                                                                                    handle: h,
                                                                                };
                                                                            }}
                                                                        />
                                                                    );
                                                                })}
                                                            </g>
                                                        );
                                                    })()}
                                            </svg>
                                        </div>
                                        <p className="md-dimensions">
                                            {templateNames[project.active]} · {def.width.toFixed(1)} × {def.height.toFixed(1)} mm{' '}
                                            {design.duplex ? '· 双面' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="md-export-bar">
                                    {project.active === 'full' && <Check label="分片预览" value={separated} onChange={setSeparated} />}
                                    <span>
                                        实际尺寸 · 出血 {project.print.bleed} mm · {project.print.crop ? '含裁切标记' : '无裁切标记'}
                                        {['label', 'full'].includes(project.active) ? ' · 分片排列' : ''}
                                    </span>
                                    <Select
                                        label="SVG 范围"
                                        value={svgTarget}
                                        onChange={setSvgTarget}
                                        options={[
                                            ['all', '完整模板'],
                                            ...def.panels.map((p) => [p.id, p.name] as [string, string]),
                                            ...(project.active === 'full'
                                                ? ([
                                                      ['piece0', '全面标签：主体'],
                                                      ['piece1', '全面标签：滑盖'],
                                                      ['piece2', '全面标签：下片'],
                                                  ] as [string, string][])
                                                : []),
                                        ]}
                                    />
                                    <button onClick={showPrintPreview} disabled={busy}>
                                        <StudioIcon name="preview" /> 设计预览
                                    </button>
                                    <button onClick={exportSVG} disabled={busy}>
                                        <StudioIcon name="download" /> 导出 SVG
                                    </button>
                                </div>
                                {rendered && rendered.warnings.length > 0 && (
                                    <details className="md-warnings">
                                        <summary>排版提示 · {rendered.warnings.length}</summary>
                                        {rendered.warnings.map((w) => (
                                            <p key={w}>{w}</p>
                                        ))}
                                    </details>
                                )}
                            </section>
                            {compact ? (
                                <Drawer
                                    anchor="right"
                                    open={drawer === 'inspector'}
                                    onClose={() => setDrawer(null)}
                                    sx={{ zIndex: 1550 }}
                                    PaperProps={{
                                        className: 'md-studio-surface md-drawer md-inspector-drawer',
                                        role: 'dialog',
                                        'aria-label': '图层与属性',
                                        'aria-modal': true,
                                    }}
                                >
                                    {inspectorPanel}
                                </Drawer>
                            ) : (
                                <aside className="md-right" aria-label="图层与属性">
                                    {inspectorPanel}
                                </aside>
                            )}
                        </div>
                    </>
                )}
                {printOpen && (
                    <Dialog
                        open
                        onClose={() => {
                            if (!busy) setPrintOpen(false);
                        }}
                        maxWidth={false}
                        aria-labelledby="md-print-title"
                        sx={{ zIndex: 1650 }}
                        PaperProps={{ className: 'md-studio-surface md-print-dialog' }}
                    >
                        <section>
                            <div className="md-data-import">
                                <h2 id="md-print-title">打印排版</h2>
                                <button aria-label="关闭打印排版" title="关闭打印排版" onClick={() => setPrintOpen(false)}>
                                    <StudioIcon name="close" />
                                </button>
                            </div>
                            <p>100% 实际尺寸。实线裁切、虚线折叠；双面打印请先使用普通纸校准。</p>
                            <div className="md-preset-row">
                                {templateIds.map((id) => (
                                    <Check
                                        key={id}
                                        label={templateNames[id]}
                                        value={project.print.templates.includes(id)}
                                        onChange={(v) =>
                                            commit((p) => {
                                                p.designs[id] ||= newDesign(id);
                                                p.print.templates = v
                                                    ? [...p.print.templates.filter((t) => t !== id), id]
                                                    : p.print.templates.filter((t) => t !== id);
                                            })
                                        }
                                    />
                                ))}
                            </div>
                            <div className="md-field-row">
                                <Select
                                    label="纸张"
                                    value={project.print.paper}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.paper = v as LabelProject['print']['paper'];
                                        })
                                    }
                                    options={[
                                        ['A4', 'A4'],
                                        ['Letter', 'Letter'],
                                        ['Custom', '自定义尺寸（容纳展开稿）'],
                                    ]}
                                />
                                <NumberField
                                    label="份数"
                                    value={project.print.copies}
                                    min={1}
                                    max={100}
                                    step={1}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.copies = Math.round(v);
                                        })
                                    }
                                />
                                <NumberField
                                    label="页边距（mm）"
                                    value={project.print.margin}
                                    min={0}
                                    max={50}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.margin = v;
                                        })
                                    }
                                />
                                <NumberField
                                    label="间距（mm）"
                                    value={project.print.gap}
                                    min={0}
                                    max={50}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.gap = v;
                                        })
                                    }
                                />
                                <NumberField
                                    label="出血（mm）"
                                    value={project.print.bleed}
                                    min={0}
                                    max={5}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.bleed = v;
                                            p.print.bleedSettingsVersion = 1;
                                        })
                                    }
                                />
                                <Select
                                    label="双面翻转"
                                    value={project.print.flip}
                                    onChange={(v) =>
                                        commit((p) => {
                                            p.print.flip = v as 'long' | 'short';
                                        })
                                    }
                                    options={[
                                        ['long', '长边翻转'],
                                        ['short', '短边翻转'],
                                    ]}
                                />
                            </div>
                            <div className="md-preset-row">
                                {(
                                    [
                                        ['crop', '裁切线'],
                                        ['folds', '折线'],
                                        ['calibration', '校准标记'],
                                    ] as const
                                ).map(([key, label]) => (
                                    <Check
                                        key={key}
                                        label={label}
                                        value={project.print[key]}
                                        onChange={(v) =>
                                            commit((p) => {
                                                p.print[key] = v;
                                            })
                                        }
                                    />
                                ))}
                            </div>
                            <p className="md-muted">
                                标准／全面标签会分片排列，每片独立出血，出血区之间至少间隔 8
                                mm；包装仅在展开稿外缘出血。成品尺寸不变，超过纸张时不会自动缩小。
                            </p>
                            {!!exportWarnings.length && (
                                <details open>
                                    <summary>本次导出排版提示 · {exportWarnings.length}</summary>
                                    <ul>
                                        {exportWarnings.map((w) => (
                                            <li key={w}>{w}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                            <button disabled={busy || !project.print.templates.length} onClick={showPrintPreview}>
                                <StudioIcon name="preview" /> 设计预览
                            </button>
                            <button className="md-primary" disabled={busy || !project.print.templates.length} onClick={exportPDF}>
                                {busy ? '正在生成…' : '导出 PDF'}
                            </button>
                            <button
                                onClick={() =>
                                    run(async () => {
                                        if (!fonts) return;
                                        const output = printPages(project, fonts);
                                        setExportWarnings(output.warnings);
                                        const zip = new JSZip();
                                        output.pages.forEach((p, i) => zip.file(`page-${i + 1}.svg`, p));
                                        downloadBlob(await zip.generateAsync({ type: 'blob' }), `${project.name}-打印页.zip`);
                                        setNotice(`已导出 ${output.pages.length} 页 SVG`);
                                    })
                                }
                            >
                                导出整页 SVG
                            </button>
                            {error && (
                                <p role="alert" className="md-error">
                                    {error}
                                </p>
                            )}
                        </section>
                    </Dialog>
                )}
                {printPreview && fonts && (
                    <DesignPreview project={project} fonts={fonts} initialFace={actualFace} onClose={() => setPrintPreview(false)} />
                )}
                <input
                    ref={fileProject}
                    hidden
                    type="file"
                    accept=".mdlabel"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f)
                            run(async () => {
                                let upgrade = '';
                                const p = await openProject(f, (message) => {
                                    upgrade = message;
                                });
                                commit((current) => {
                                    Object.assign(current, p);
                                });
                                setSelected('');
                                setPanel('main');
                                setNotice(upgrade ? `工程已打开。${upgrade}` : '工程已打开');
                            });
                    }}
                />
                <input
                    ref={fileMusic}
                    hidden
                    type="file"
                    accept=".csv,.m3u,.m3u8,.txt"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f)
                            run(async () => {
                                const text = await f.text();
                                mergeData(
                                    f.name.toLowerCase().endsWith('.csv')
                                        ? dataFromCSV(text)
                                        : { ...project.data, tracks: parsePlaylist(text, /\.m3u8?$/i.test(f.name)) }
                                );
                            });
                    }}
                />
                <input
                    ref={fileImage}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f)
                            run(async () => {
                                const a = await importAsset(f);
                                commit((p) => {
                                    p.assets[a.id] = a;
                                    const panelDef = definition(p.designs[p.active]!).panels.find((p) => p.id === actualPanel)!;
                                    const l = layer('image', actualPanel, actualFace, {
                                        name: a.name,
                                        assetId: a.id,
                                        x: 0,
                                        y: 0,
                                        width: panelDef.artworkWidth ?? panelDef.width,
                                        height: panelDef.artworkHeight ?? panelDef.height,
                                    });
                                    p.designs[p.active]!.layers.unshift(l);
                                    setSelected(l.id);
                                });
                                setNotice('图片已添加，可在图层中调整裁切和位置');
                            });
                    }}
                />
            </div>
        </Dialog>
    );
}
