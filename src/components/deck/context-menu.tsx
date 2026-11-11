import React, { useCallback } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';

import { actions } from '../../redux/context-menu-feature';
import { useDeviceCapabilities, useDispatch, useShallowEqualSelector } from '../../frontend-utils';

interface DeckContextMenuProps {
    onTogglePlayPause: (event: React.MouseEvent, trackIdx: number) => void;
    onRename: (event: React.MouseEvent, trackIdx: number) => void;
    onDelete: (event: React.MouseEvent, trackIdx: number) => void;
}

// Deck's track right-click menu: the stock one's three actions on the same Redux state, drawn as a
// Deck menu (mono captions, Lucide glyphs) rather than a stack of buttons.
export const DeckContextMenu = ({ onTogglePlayPause, onRename, onDelete }: DeckContextMenuProps) => {
    const dispatch = useDispatch();
    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);
    const contextTrack = useShallowEqualSelector((state) => state.contextMenu.track);
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const { metadataEdit, playbackControl } = useDeviceCapabilities();

    const close = useCallback(() => dispatch(actions.closeContextMenu(null)), [dispatch]);
    const run = useCallback(
        (action: (event: React.MouseEvent, trackIdx: number) => void) => (event: React.MouseEvent) => {
            event.preventDefault();
            const index = contextTrack?.index;
            close();
            if (index !== undefined) action(event, index);
        },
        [contextTrack?.index, close]
    );

    const playing = contextTrack !== null && deviceStatus?.track === contextTrack.index && deviceStatus?.state === 'playing';

    return (
        <Menu
            open={isVisible && position !== null}
            onClose={close}
            anchorReference="anchorPosition"
            anchorPosition={position ? { top: position.y, left: position.x } : undefined}
            onContextMenu={(event) => {
                event.preventDefault();
                close();
            }}
        >
            <MenuItem disabled={!playbackControl} onClick={run(onTogglePlayPause)}>
                <ListItemIcon>{playing ? <Pause size={14} /> : <Play size={14} />}</ListItemIcon>
                <ListItemText>{playing ? 'Pause' : 'Play'}</ListItemText>
            </MenuItem>
            <MenuItem disabled={!metadataEdit} onClick={run(onRename)}>
                <ListItemIcon>
                    <Pencil size={14} />
                </ListItemIcon>
                <ListItemText>Rename</ListItemText>
            </MenuItem>
            <MenuItem disabled={!metadataEdit} onClick={run(onDelete)}>
                <ListItemIcon>
                    <Trash2 size={14} />
                </ListItemIcon>
                <ListItemText>Delete</ListItemText>
            </MenuItem>
        </Menu>
    );
};
