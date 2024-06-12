import React from 'react';

interface ContextMenuProps {
    position: {
        x: number;
        y: number;
    } | null;
}

export const ContextMenu = ({ position }: ContextMenuProps) => {
    if (!position) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: position.y,
                left: position.x,
                width: '200px',
                height: '100px',
            }}
        >
            <h1>ContextMenu</h1>
        </div>
    );
};
