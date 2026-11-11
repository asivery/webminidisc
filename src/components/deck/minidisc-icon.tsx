import React, { useId } from 'react';

// A MiniDisc shell in Lucide's stroke style, proportioned like the cartridge: the disc is centred and
// nearly fills the square case, and the shutter runs from just right of the hub to the case edge,
// hiding the disc's outline where it covers it.
export const MiniDiscIcon = ({ size = 20, strokeWidth = 2, className }: { size?: number; strokeWidth?: number; className?: string }) => {
    const maskId = useId();
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <defs>
                <mask id={maskId}>
                    <rect width="24" height="24" fill="#fff" />
                    <rect x="14" y="8.25" width="9" height="7.5" fill="#000" />
                </mask>
            </defs>
            <rect x="3" y="3" width="18" height="18" rx="1.5" />
            <circle cx="12" cy="12" r="7" mask={`url(#${maskId})`} />
            <circle cx="12" cy="12" r="1.5" />
            <rect x="15" y="9" width="6" height="6" />
        </svg>
    );
};
