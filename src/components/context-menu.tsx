import React from 'react';
import { useDispatch } from 'react-redux';
import { useShallowEqualSelector } from '../frontend-utils';

interface ContextMenuProps {}

export const ContextMenu = () => {
    const dispatch = useDispatch();

    const position = useShallowEqualSelector((state) => state.contextMenu.position);
    const isVisible = useShallowEqualSelector((state) => state.contextMenu.visible);

    console.log('position', position);

    if (!isVisible || !position) return null;

    return (
        <div
            style={{
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
            }}
        >
            <div>Rename Track</div>
            <div>Play Track</div>
            <div>Delete Track</div>
        </div>
    );
};
