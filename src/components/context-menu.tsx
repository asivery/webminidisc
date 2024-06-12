import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { actions } from '../redux/context-menu-feature';

import { useShallowEqualSelector } from '../frontend-utils';
import { makeStyles } from 'tss-react/mui';
import { Box, Button, ButtonProps } from '@mui/material';
import { Capability } from '../services/interfaces/netmd';

interface ContextMenuProps {}

interface ContextButtonProps extends ButtonProps {
    title: string;
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
        width: '300px',
        backgroundColor: '#303030',
        borderRadius: theme.shape.borderRadius,
        color: 'white',
        padding: '5px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        border: '1px solid #444',
    },
    button: {
        color: 'white',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '5px',
        textAlign: 'left',
        height: '30px',
        fontSize: '14px',
        width: '100%',
        justifyContent: 'flex-start',
        '&:hover': {
            backgroundColor: '#444',
        },
    },
}));

const ContextButton = ({ title, ...otherProps }: ContextButtonProps) => {
    const {
        classes: { button },
    } = useStyles();

    return (
        <Button className={button} {...otherProps}>
            {title}
        </Button>
    );
};

export const ContextMenu = () => {
    const dispatch = useDispatch();

    const { classes } = useStyles();

    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);
    const deviceCapabilities = useShallowEqualSelector((state) => state.main.deviceCapabilities);

    const isCapable = useCallback((capability: Capability) => deviceCapabilities.includes(capability), [deviceCapabilities]);

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
                    <ContextButton title="Play Track" />
                    <ContextButton title="Rename Track" disabled={!isCapable(Capability.metadataEdit)} />
                    <ContextButton title="Delete Track" disabled={!isCapable(Capability.metadataEdit)} />
                </Box>
            </Box>
        </Box>
    );
};
