import { Layer, Panel } from './model';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const rotationCorners = ['nw', 'ne', 'se', 'sw'] as const;
export function rotationZone(l: Layer, p: Panel, corner: (typeof rotationCorners)[number], scale: number) {
    const anchor = handlePoint(corner, l.width, l.height);
    const sx = corner.includes('w') ? -1 : 1;
    const sy = corner.includes('n') ? -1 : 1;
    // Fixed screen-pixel zones outside the resize handles, including at rotated corners.
    return [
        [6, 6],
        [20, 6],
        [20, 20],
        [6, 20],
    ].map(([x, y]) => canvasPoint(l, p, anchor.x + (sx * x) / scale, anchor.y + (sy * y) / scale));
}
export function normalizeRotation(angle: number): number {
    return ((((angle + 180) % 360) + 360) % 360) - 180;
}
export function rotationDelta(previous: number, current: number): number {
    return normalizeRotation(current - previous);
}
export function rotateLayer(l: Layer, angle: number, snap = false) {
    const rotation = Number(normalizeRotation(snap ? Math.round(angle / 15) * 15 : Math.round(angle * 10) / 10).toFixed(1));
    const center = layerPoint(l, l.width / 2, l.height / 2);
    const nextCenter = layerPoint({ ...l, x: 0, y: 0, rotation }, l.width / 2, l.height / 2);
    return { rotation, x: center.x - nextCenter.x, y: center.y - nextCenter.y };
}
export function handlePoint(handle: ResizeHandle, width: number, height: number) {
    return {
        x: handle.includes('w') ? 0 : handle.includes('e') ? width : width / 2,
        y: handle.includes('n') ? 0 : handle.includes('s') ? height : height / 2,
    };
}
// Match the SVG renderer, including its special, top-left anchored quarter turns.
export function layerPoint(l: Pick<Layer, 'x' | 'y' | 'width' | 'height' | 'rotation'>, x: number, y: number) {
    if (l.rotation === 90) return { x: l.x + l.height - y, y: l.y + x };
    if (l.rotation === -90) return { x: l.x + y, y: l.y + l.width - x };
    const angle = (l.rotation * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
    return {
        x: l.x + l.width / 2 + (x - l.width / 2) * cos - (y - l.height / 2) * sin,
        y: l.y + l.height / 2 + (x - l.width / 2) * sin + (y - l.height / 2) * cos,
    };
}
export function canvasPoint(l: Layer, p: Panel, x: number, y: number) {
    const pt = layerPoint(l, x, y);
    return p.rotation === -90 ? { x: p.x + pt.y, y: p.y + (p.artworkWidth ?? p.width) - pt.x } : { x: p.x + pt.x, y: p.y + pt.y };
}
export function panelDelta(dx: number, dy: number, bottom: boolean) {
    return bottom ? { x: -dy, y: dx } : { x: dx, y: dy };
}
export function resizeLayer(l: Layer, handle: ResizeHandle, dx: number, dy: number, snap: boolean, proportional = false) {
    const angle = (l.rotation * Math.PI) / 180;
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
    const horizontal = /[ew]/.test(handle),
        vertical = /[ns]/.test(handle);
    const round = (v: number) => Math.max(1, Math.min(1000, snap ? Math.round(v * 2) / 2 : v));
    let width = horizontal ? round(l.width + localX * (handle.includes('w') ? -1 : 1)) : l.width;
    let height = vertical ? round(l.height + localY * (handle.includes('n') ? -1 : 1)) : l.height;
    if (proportional && horizontal && vertical) {
        const factor = Math.abs(width / l.width - 1) > Math.abs(height / l.height - 1) ? width / l.width : height / l.height;
        const scale = Math.max(1 / l.width, 1 / l.height, Math.min(1000 / l.width, 1000 / l.height, factor));
        width = l.width * scale;
        height = l.height * scale;
    }
    const moving = handlePoint(handle, l.width, l.height);
    const anchor = { x: l.width - moving.x, y: l.height - moving.y };
    const oldPoint = layerPoint(l, anchor.x, anchor.y);
    const nextPoint = layerPoint({ ...l, x: 0, y: 0, width, height }, (anchor.x / l.width) * width, (anchor.y / l.height) * height);
    return { x: oldPoint.x - nextPoint.x, y: oldPoint.y - nextPoint.y, width, height };
}
