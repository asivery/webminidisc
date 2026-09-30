import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, LocalFontRef } from './model';
import { Fonts, GlyphFont } from './render';
import { listLocalFonts, loadLocalFont, loadLocalFontPreview, LocalFontData } from './local-fonts';

function LocalFontList({
    items,
    selected,
    busy,
    onChoose,
}: {
    items: LocalFontData[];
    selected?: string;
    busy: boolean;
    onChoose: (name: string) => void;
}) {
    const root = useRef<HTMLDivElement>(null);
    const [previews, setPreviews] = useState<Record<string, string>>({});
    const [focused, setFocused] = useState('');
    const tabStop = [focused, selected, items[0]?.postscriptName].find((name) => items.some((f) => f.postscriptName === name));

    useEffect(() => {
        const list = root.current;
        if (!list) return;
        let active = true;
        const byName = new Map(items.map((f) => [f.postscriptName, f]));
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    observer.unobserve(entry.target);
                    const data = byName.get((entry.target as HTMLElement).dataset.fontName!);
                    if (!data) continue;
                    void loadLocalFontPreview(data).then((family) => {
                        if (active && family) setPreviews((current) => ({ ...current, [data.postscriptName]: family }));
                    });
                }
            },
            { root: list }
        );
        list.querySelectorAll('[data-font-name]').forEach((row) => observer.observe(row));
        return () => {
            active = false;
            observer.disconnect();
        };
    }, [items]);

    return (
        <div
            ref={root}
            className="md-local-font-list"
            role="listbox"
            aria-label="本机字体与样式"
            aria-busy={busy}
            aria-disabled={busy}
            onKeyDown={(e) => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
                const current = rows.indexOf(document.activeElement as HTMLButtonElement);
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : current + (e.key === 'ArrowDown' ? 1 : -1);
                const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
                row?.focus({ preventScroll: true });
                row?.scrollIntoView({ block: 'nearest' });
            }}
        >
            {items.map((f) => (
                <button
                    key={f.postscriptName}
                    type="button"
                    role="option"
                    className="md-local-font-option"
                    data-font-name={f.postscriptName}
                    aria-selected={selected === f.postscriptName}
                    aria-disabled={busy}
                    tabIndex={tabStop === f.postscriptName ? 0 : -1}
                    title={`${f.family} · ${f.style}`}
                    style={{ fontFamily: previews[f.postscriptName] }}
                    onFocus={() => setFocused(f.postscriptName)}
                    onClick={() => {
                        if (!busy) onChoose(f.postscriptName);
                    }}
                >
                    {f.family} · {f.style}
                </button>
            ))}
            {!items.length && <div className="md-local-font-empty">没有匹配的字体</div>}
        </div>
    );
}

export function FontPicker({
    layer,
    fonts,
    onChange,
    onLoad,
}: {
    layer: Layer;
    fonts: Fonts | null;
    onChange: (patch: Partial<Layer>) => void;
    onLoad: (ref: LocalFontRef, font: GlyphFont) => void;
}) {
    const [list, setList] = useState<LocalFontData[] | null>(null);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = async () => {
        setBusy(true);
        setError('');
        try {
            setList(await listLocalFonts());
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
        }
    };
    const choose = async (postscriptName: string) => {
        const data = list?.find((f) => f.postscriptName === postscriptName);
        if (!data) return;
        setBusy(true);
        setError('');
        try {
            const ref = { postscriptName: data.postscriptName, family: data.family, style: data.style };
            const font = await loadLocalFont(ref);
            onLoad(ref, font);
            onChange({ localFont: ref });
        } catch (e) {
            setError(`无法使用此字体：${String(e)}`);
        } finally {
            setBusy(false);
        }
    };
    const filtered = useMemo(
        () =>
            list?.filter((f) =>
                `${f.family} ${f.style} ${f.fullName} ${f.postscriptName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
            ) || [],
        [list, search]
    );
    return (
        <div className="md-font-picker">
            <label className="md-field">
                <span>字体</span>
                <select
                    value={layer.localFont ? 'local' : layer.font}
                    onChange={(e) => {
                        if (e.target.value !== 'local') onChange({ font: e.target.value as Layer['font'], localFont: undefined });
                    }}
                >
                    <option value="sans">思源黑体</option>
                    <option value="serif">思源宋体</option>
                    <option value="mono">等宽排版</option>
                    {layer.localFont && (
                        <option value="local">
                            {layer.localFont.family} · {layer.localFont.style}
                        </option>
                    )}
                </select>
            </label>
            <button type="button" onClick={load} disabled={busy}>
                {busy ? '正在读取字体…' : '加载本机字体'}
            </button>
            {layer.localFont && !fonts?.local?.[layer.localFont.postscriptName] && (
                <p role="alert">
                    缺少或尚未加载：{layer.localFont.family} · {layer.localFont.style}。暂用内置字体显示；请加载原字体或选择替代字体后导出。
                </p>
            )}
            {list && (
                <div className="md-font-options">
                    <input
                        type="search"
                        aria-label="搜索本机字体"
                        placeholder="搜索字体名称或样式"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <LocalFontList items={filtered} selected={layer.localFont?.postscriptName} busy={busy} onChoose={choose} />
                    <small>{filtered.length} 个样式 · 工程仅保存字体引用</small>
                    <button type="button" onClick={() => setList(null)}>
                        收起字体列表
                    </button>
                </div>
            )}
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
