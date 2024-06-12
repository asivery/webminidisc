import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { actions } from '../redux/context-menu-feature';

import { useShallowEqualSelector } from '../frontend-utils';
import { makeStyles } from 'tss-react/mui';

interface ContextMenuProps {}

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
        height: '100px',
        backgroundColor: '#303030',
        borderRadius: '5px',
        color: 'white',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #444',
    },
}));

export const ContextMenu = () => {
    const dispatch = useDispatch();

    const { classes } = useStyles();

    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);

    const handleClose = () => {
        dispatch(actions.closeContextMenu(null));
    };

    const handleReopenMenu = useCallback(
        (event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            dispatch(actions.openContextMenu({ x: event.clientX, y: event.clientY }));
        },
        [dispatch]
    );

    if (!isVisible || !position) return null;

    return (
        <div className={classes.background} onClick={handleClose} onContextMenu={handleClose}>
            <div className={classes.reopenArea} onContextMenu={handleReopenMenu}>
                <div
                    className={classes.menuContainer}
                    style={{
                        top: position.y,
                        left: position.x,
                    }}
                >
                    <div>Rename Track</div>
                    <div>Play Track</div>
                    <div>Delete Track</div>
                </div>
            </div>
        </div>
    );
};
