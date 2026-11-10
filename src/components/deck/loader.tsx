import React from 'react';
import MuiCircularProgress, { CircularProgressProps } from '@mui/material/CircularProgress';
import { keyframes } from 'tss-react';
import { makeStyles } from 'tss-react/mui';
import { useShallowEqualSelector } from '../../frontend-utils';
import { AMBER, TEXT } from './common';

const spin = keyframes({ from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } });
const pulse = keyframes({ '0%, 100%': { opacity: 0.35 }, '50%': { opacity: 1 } });

const useStyles = makeStyles()(() => ({
    root: {
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        verticalAlign: 'middle',
    },
    // The disc: an amber arc that fades to nothing behind its bright leading edge, with the hub punched out.
    // It sits where the icon's disc is (radius 8 of 24, centred) and turns under the still case and shutter.
    disc: {
        position: 'absolute',
        left: `${(4 / 24) * 100}%`,
        top: `${(4 / 24) * 100}%`,
        width: `${(16 / 24) * 100}%`,
        height: `${(16 / 24) * 100}%`,
        borderRadius: '50%',
        background: `conic-gradient(from 0deg, rgba(255,170,51,0) 0deg, rgba(255,170,51,0.12) 140deg, ${AMBER} 352deg, rgba(255,170,51,0) 360deg)`,
        WebkitMask: 'radial-gradient(circle, transparent 0 24%, #000 25%)',
        mask: 'radial-gradient(circle, transparent 0 24%, #000 25%)',
        animation: `${spin} 0.9s linear infinite`,
        '@media (prefers-reduced-motion: reduce)': {
            animation: `${pulse} 1.8s ease-in-out infinite`,
        },
    },
    shell: {
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
    },
}));

// Deck's loading indicator: a MiniDisc whose disc spins while the case and shutter stay still.
// `shutterFill` should match what the loader sits on, so the disc passes under the shutter.
export const DeckLoader = ({ size = 24, shutterFill = '#23242b' }: { size?: number; shutterFill?: string }) => {
    const { classes } = useStyles();
    return (
        <span className={classes.root} style={{ width: size, height: size }} role="progressbar" aria-label="Loading">
            <span className={classes.disc} />
            <svg
                className={classes.shell}
                style={{ width: size, height: size }}
                viewBox="0 0 24 24"
                fill="none"
                stroke={TEXT}
                strokeWidth={size >= 40 ? 1.25 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="3" y="3" width="18" height="18" rx="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <rect x="15" y="9" width="6" height="6" fill={shutterFill} />
            </svg>
        </span>
    );
};

// MUI's CircularProgress, drawn as the MiniDisc loader in Deck Mode. Stock files import this in its place,
// so the only change in an upstream file is its import line. Size: an explicit numeric width or `size`,
// else 56 (the full-screen busy overlay).
export function CircularProgress(props: CircularProgressProps) {
    const deckMode = useShallowEqualSelector((state) => state.appState.deckMode);
    if (!deckMode) return <MuiCircularProgress {...props} />;
    const width = props.style?.width;
    const size = typeof width === 'number' ? width : typeof props.size === 'number' ? props.size : 56;
    return <DeckLoader size={size} shutterFill={size >= 40 ? '#131418' : '#23242b'} />;
}

export default CircularProgress;
