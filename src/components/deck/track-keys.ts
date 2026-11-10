import React, { useCallback, useEffect, useRef } from 'react';
import type { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import type { Group } from '../../services/interfaces/netmd';

// Keyboard access for Deck's track list, without editing upstream's TrackRow / GroupRow.
// The list is one Tab stop (a roving tabindex over the rows); inside it:
//   Up / Down            move between rows (Home / End: first / last)
//   Space, or Enter on an unselected row   select or deselect it (Shift with arrows extends, as Shift-click)
//   Enter on a selected track   play it (the row's double-click); on a group row, rename it
//   Menu key or Shift+F10       the row's right-click menu
//   Alt+Up / Alt+Down           move the track one place, crossing into the next group at the ends
// Rows act through the same mouse events the stock rows already handle, so selection, play and menus
// behave exactly as with the mouse. Drag handles leave the Tab order; Alt+arrows replace them.

const ROW = 'tr[class*="rowClass"]';

function rowsIn(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(ROW));
}

function fire(row: HTMLElement, type: 'click' | 'dblclick' | 'contextmenu', shiftKey = false) {
    const box = row.getBoundingClientRect();
    row.dispatchEvent(
        new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            shiftKey,
            clientX: box.left + Math.min(160, box.width / 2),
            clientY: box.top + box.height / 2,
            button: type === 'contextmenu' ? 2 : 0,
        })
    );
}

// "groupIndex-trackIndex", as track-table.tsx builds each Draggable's id.
function trackIdOf(row: HTMLElement): string | null {
    return row.getAttribute('data-rfd-draggable-id');
}

export function useTrackListKeyboard(
    groupedTracks: Group[],
    handleDrop: (result: DropResult, provided: ResponderProvided) => void,
    canMove: boolean
) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Where a moved track will land, resolved once the disc listing has updated (moving renumbers tracks).
    const focusAfterMove = useRef<{ list: number; index: number; before: Group[] } | null>(null);

    // Keep exactly one row in the Tab order (the focused one, else the first), and take drag handles out of it.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const rows = rowsIn(container);
        const active = rows.find((r) => r === document.activeElement) ?? rows.find((r) => r.tabIndex === 0) ?? rows[0];
        rows.forEach((r) => (r.tabIndex = r === active ? 0 : -1));
        container.querySelectorAll<HTMLElement>('[data-rfd-drag-handle-draggable-id]').forEach((h) => (h.tabIndex = -1));
        const pending = focusAfterMove.current;
        if (pending && pending.before !== groupedTracks) {
            focusAfterMove.current = null;
            const group = groupedTracks[pending.list];
            const track = group?.tracks[Math.min(pending.index, group.tracks.length - 1)];
            const moved = track ? rows.find((r) => trackIdOf(r) === `${group.index}-${track.index}`) : undefined;
            if (moved) {
                rows.forEach((r) => (r.tabIndex = r === moved ? 0 : -1));
                moved.focus();
            }
        }
    });

    const moveTrack = useCallback(
        (row: HTMLElement, delta: -1 | 1) => {
            const id = trackIdOf(row);
            if (!id) return;
            const trackIndex = parseInt(id.split(/-(?=\d+$)/)[1], 10);
            // Find the list by the track, not the group number: loose tracks before and after a group are separate
            // lists that share group number -1.
            const list = groupedTracks.findIndex((g) => g.tracks.some((t) => t.index === trackIndex));
            if (list === -1) return;
            const position = groupedTracks[list].tracks.findIndex((t) => t.index === trackIndex);
            let targetList = list;
            let targetIndex = position + delta;
            if (targetIndex < 0 || targetIndex >= groupedTracks[list].tracks.length) {
                targetList = list + delta;
                if (targetList < 0 || targetList >= groupedTracks.length) return;
                targetIndex = delta < 0 ? groupedTracks[targetList].tracks.length : 0;
            }
            // As with a drag, the destination index is where the track ends up, so refocus it there.
            focusAfterMove.current = { list: targetList, index: targetIndex, before: groupedTracks };
            handleDrop(
                {
                    draggableId: id,
                    type: 'DEFAULT',
                    mode: 'SNAP',
                    reason: 'DROP',
                    combine: null,
                    source: { droppableId: `${list}`, index: position },
                    destination: { droppableId: `${targetList}`, index: targetIndex },
                } as DropResult,
                {} as ResponderProvided
            );
        },
        [groupedTracks, handleDrop]
    );

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent) => {
            const container = containerRef.current;
            const row = (event.target as HTMLElement).closest<HTMLElement>(ROW);
            if (!container || !row || !container.contains(row)) return;
            const rows = rowsIn(container);
            const at = rows.indexOf(row);
            const focusRow = (next: HTMLElement | undefined, extend: boolean) => {
                if (!next) return;
                rows.forEach((r) => (r.tabIndex = r === next ? 0 : -1));
                next.focus();
                next.scrollIntoView({ block: 'nearest' });
                if (extend && trackIdOf(next)) fire(next, 'click', true);
            };
            const isTrack = trackIdOf(row) !== null;

            if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.altKey) {
                if (isTrack && canMove) moveTrack(row, event.key === 'ArrowUp' ? -1 : 1);
            } else if (event.key === 'ArrowDown') {
                focusRow(rows[at + 1], event.shiftKey);
            } else if (event.key === 'ArrowUp') {
                focusRow(rows[at - 1], event.shiftKey);
            } else if (event.key === 'Home') {
                focusRow(rows[0], false);
            } else if (event.key === 'End') {
                focusRow(rows[rows.length - 1], false);
            } else if (event.key === ' ' || event.key === 'Spacebar') {
                fire(row, 'click', event.shiftKey);
            } else if (event.key === 'Enter') {
                const selected = row.classList.contains('Mui-selected');
                fire(row, selected || !isTrack ? 'dblclick' : 'click');
            } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
                fire(row, 'contextmenu');
            } else {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        },
        [canMove, moveTrack]
    );

    return { containerRef, onKeyDown };
}
