import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { control } from '../redux/actions';
import { actions } from '../redux/context-menu-feature';

import { useShallowEqualSelector } from '../frontend-utils';
import { makeStyles } from 'tss-react/mui';
import { Box, Button, ButtonProps } from '@mui/material';
import { Capability } from '../services/interfaces/netmd';
import { Delete, Edit, PlayArrow } from '@mui/icons-material';

interface ContextMenuProps {
    onTogglePlayPause: (event: React.MouseEvent, trackIdx: number) => void;
    onRename: (event: React.MouseEvent, trackIdx: number) => void;
    onDelete: (event: React.MouseEvent, trackIdx: number) => void;
}

interface ContextButtonProps extends ButtonProps {
    icon?: React.ReactNode;
}

const useStyles = makeStyles()((theme) => ({
    background: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 998,
        display: 'flex',
        justifyContent: 'center',
    },
    reopenArea: {
        width: '700px',
        height: '700px',
        zIndex: 999,
    },
    menuContainer: {
        zIndex: 1000,
        boxSizing: 'border-box',
        position: 'fixed',
        width: '160px',
        backgroundColor: '#303030',
        borderRadius: theme.shape.borderRadius,
        color: 'white',
        padding: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        border: '1px solid #444',
    },
    button: {
        gap: '5px',
        color: 'white',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        border: 'none',
        cursor: 'pointer',
        padding: '2px',
        textAlign: 'left',
        height: '24px',
        fontSize: '10px',
        width: '100%',
        justifyContent: 'flex-start',
        '&:hover': {
            backgroundColor: '#444',
        },
    },
}));

const ContextButton = ({ icon, children, ...otherProps }: ContextButtonProps) => {
    const {
        classes: { button },
    } = useStyles();

    return (
        <Button className={button} {...otherProps}>
            {icon}
            {children}
        </Button>
    );
};

export const ContextMenu = ({ onTogglePlayPause, onRename, onDelete }: ContextMenuProps) => {
    const dispatch = useDispatch();

    const { classes } = useStyles();

    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);
    const contextTrack = useShallowEqualSelector((state) => state.contextMenu.track);

    const deviceCapabilities = useShallowEqualSelector((state) => state.main.deviceCapabilities);

    const isCapable = useCallback((capability: Capability) => deviceCapabilities.includes(capability), [deviceCapabilities]);

    const handlePlayTrack = useCallback(
        (e: React.MouseEvent) => {
            e?.preventDefault();
            contextTrack?.index !== undefined && onTogglePlayPause(e, contextTrack.index);
            dispatch(actions.closeContextMenu(null));
        },
        [contextTrack?.index, dispatch, onTogglePlayPause]
    );
    const handleRenameTrack = useCallback(
        (e: React.MouseEvent) => {
            e?.preventDefault();
            contextTrack?.index !== undefined && onRename(e, contextTrack.index);
            dispatch(actions.closeContextMenu(null));
        },
        [contextTrack?.index, dispatch, onRename]
    );
    const handleDeleteTrack = useCallback(
        (e: React.MouseEvent) => {
            e?.preventDefault();
            contextTrack?.index !== undefined && onDelete(e, contextTrack.index);
            dispatch(actions.closeContextMenu(null));
        },
        [contextTrack?.index, dispatch, onDelete]
    );

    const handleClose = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e?.preventDefault();
        dispatch(actions.closeContextMenu(null));
    };

    // // Tobio: I will come back to this later if it makes sense
    // const handleReopenMenu = useCallback(
    //     (event: React.MouseEvent) => {
    //         event.preventDefault();
    //         event.stopPropagation();
    //         dispatch(actions.openContextMenu({ x: event.clientX, y: event.clientY }));
    //     },
    //     [dispatch]
    // );

    if (!isVisible || !position) return null;

    return (
        <Box className={classes.background} onClick={handleClose} onContextMenu={handleClose}>
            <Box className={classes.reopenArea} onContextMenu={handleClose}>
                <Box
                    className={classes.menuContainer}
                    style={{
                        top: position.y,
                        left: position.x,
                    }}
                >
                    <ContextButton icon={<PlayArrow sx={{ height: '16px' }} />} onClick={handlePlayTrack}>
                        Play / Pause
                    </ContextButton>
                    <ContextButton
                        icon={<Edit sx={{ height: '16px' }} />}
                        disabled={!isCapable(Capability.metadataEdit)}
                        onClick={handleRenameTrack}
                    >
                        Rename
                    </ContextButton>
                    <ContextButton
                        icon={<Delete sx={{ height: '16px' }} />}
                        disabled={!isCapable(Capability.metadataEdit)}
                        onClick={handleDeleteTrack}
                    >
                        Delete
                    </ContextButton>
                </Box>
            </Box>
        </Box>
    );
};
