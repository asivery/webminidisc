import React from 'react';
import { useDispatch } from 'react-redux';

import { actions } from '../redux/context-menu-feature';

import { useShallowEqualSelector } from '../frontend-utils';

interface ContextMenuProps {}

export const ContextMenu = () => {
    const dispatch = useDispatch();

    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);

    console.log('position', position);

    const handleClose = () => {
        dispatch(actions.closeContextMenu(null));
    };

    if (!isVisible || !position) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                zIndex: 999,
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    zIndex: 1000,
                    boxSizing: 'border-box',
                    position: 'fixed',
                    top: position.y,
                    left: position.x,
                    width: '300px',
                    height: '100px',
                    backgroundColor: '#303030',
                    borderRadius: '5px',
                    color: 'white',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #444',
                }}
            >
                <div>Rename Track</div>
                <div>Play Track</div>
                <div>Delete Track</div>
            </div>
        </div>
    );
};
