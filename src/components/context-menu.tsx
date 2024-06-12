import React from 'react';

interface ContextMenuProps {
    position: {
        x: number;
        y: number;
    };
}

export const ContextMenu = ({ position }: ContextMenuProps) => {
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
