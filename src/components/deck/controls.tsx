import React, { useState } from 'react';
import { makeStyles } from 'tss-react/mui';

import { useDeviceCapabilities, useDispatch, useShallowEqualSelector } from '../../frontend-utils';
import { control } from '../../redux/actions';
import serviceRegistry from '../../services/registry';
import { formatTimeFromSeconds, getTracks } from '../../utils';
import { recordingModeName } from '../device-info-rows';
import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { DeckPanel, DeckKey, LcdWindow, DeckPill, MONO, AMBER, MUTED, DECK_COMPACT } from './common';

const useStyles = makeStyles()((theme) => ({
    // app.tsx's controlsContainer reserves paddingRight spacing(8) for the default look's FAB; Deck has none, so cancel it.
    centre: {
        marginRight: theme.spacing(-8),
    },
    panel: {
        padding: 13,
        [DECK_COMPACT]: { padding: '8px 12px', gap: 12 },
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        boxShadow: '0 12px 20px rgba(0,0,0,0.85)',
    },
    keys: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    key: {
        minWidth: 0,
        width: 36,
        height: 36,
        [DECK_COMPACT]: { width: 30, height: 30 },
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .MuiButton-startIcon': { margin: 0 },
    },
    lcd: {
        flex: 1,
        minWidth: 0,
        maxWidth: 448,
        cursor: 'pointer',
        userSelect: 'none',
    },
    // Thin position strip under the readout; a click seeks within the current track.
    progress: {
        position: 'relative',
        height: 3,
        marginTop: 6,
        background: 'rgba(255,170,51,0.12)',
        borderRadius: 1,
        cursor: 'pointer',
        '&::before': { content: '""', position: 'absolute', left: 0, right: 0, top: -6, bottom: -6 },
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        background: AMBER,
        borderRadius: 1,
        boxShadow: `0 0 4px ${AMBER}`,
    },
    line1: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 16,
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: '16px',
        color: AMBER,
        whiteSpace: 'nowrap',
    },
    trackNumber: {
        flexShrink: 0,
        width: 22,
        fontWeight: 700,
        letterSpacing: 0.6,
    },
    scroller: {
        position: 'relative',
        overflow: 'hidden',
        flex: 1,
        minWidth: 0,
        height: 16,
        fontWeight: 600,
        letterSpacing: 1.68,
    },
    line2: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 20,
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '20px',
        letterSpacing: 1.68,
        whiteSpace: 'nowrap',
    },
    elapsed: {
        color: AMBER,
    },
    total: {
        color: MUTED,
        fontWeight: 700,
    },
}));

export type DeckControlsProps = {
    handlePrev: () => void;
    handlePlay: () => void;
    handleStop: () => void;
    handlePause: () => void;
    handleNext: () => void;
    message: string;
    loading: boolean;
    discPresent: boolean;
    classes: any;
    lcdScroll: number;
    lcdRef: React.RefObject<HTMLParagraphElement>;
    lcdScrollDuration: number;
};

// controls.tsx writes the current-track message as "001 - Title"; the Deck LCD shows the number in its own cell.
const TRACK_MESSAGE = /^(\d{3}) - ?(.*)$/;

export const DeckControls = (props: DeckControlsProps) => {
    const { classes } = useStyles();
    const dispatch = useDispatch();
    // Like a Walkman's Display key: a click swaps the time readout between elapsed and remaining.
    const [showRemaining, setShowRemaining] = useState(false);
    const deviceCapabilities = useDeviceCapabilities();
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const disc = useShallowEqualSelector((state) => state.main.disc);

    if (!deviceCapabilities.playbackControl) {
        return null;
    }

    // Match by index: getTracks is in group order, while the message in controls.tsx uses the index-sorted list.
    const track =
        disc && props.discPresent && typeof deviceStatus?.track === 'number'
            ? getTracks(disc).find((t) => t.index === deviceStatus.track)
            : undefined;
    const elapsed = (deviceStatus?.time?.minute ?? 0) * 60 + (deviceStatus?.time?.second ?? 0);

    const fullMessage = props.discPresent ? props.message : props.loading ? 'LOADING...' : 'NO DISC';
    const parsed = track ? TRACK_MESSAGE.exec(props.message) : null;
    const trackNumber = parsed ? String(parseInt(parsed[1], 10)).padStart(2, '0') : null;
    const scrollingText = parsed ? parsed[2] : fullMessage;

    const keys = [
        { label: 'prev', icon: <SkipBack size={14} />, onClick: props.handlePrev },
        { label: 'play', icon: <Play size={16} />, onClick: props.handlePlay },
        { label: 'pause', icon: <Pause size={14} />, onClick: props.handlePause },
        { label: 'stop', icon: <Square size={12} />, onClick: props.handleStop },
        { label: 'next', icon: <SkipForward size={14} />, onClick: props.handleNext },
    ];

    return (
        <div className={classes.centre}>
            <DeckPanel className={classes.panel}>
                <div className={classes.keys}>
                    {keys.map((k) => (
                        <DeckKey
                            key={k.label}
                            aria-label={k.label}
                            disabled={!props.discPresent}
                            onClick={k.onClick}
                            icon={k.icon}
                            className={classes.key}
                        />
                    ))}
                </div>
                <LcdWindow
                    className={classes.lcd}
                    onClick={() => setShowRemaining((v) => !v)}
                    title={showRemaining ? 'Showing time remaining; click for elapsed' : 'Showing time elapsed; click for remaining'}
                >
                    <div className={classes.line1}>
                        {trackNumber !== null && <span className={classes.trackNumber}>{trackNumber}</span>}
                        <div className={classes.scroller}>
                            <span
                                className={props.lcdScroll ? props.classes.scrollingStatusMessage : props.classes.statusMessage}
                                ref={props.lcdRef}
                                style={
                                    props.message && props.lcdScroll > 0
                                        ? {
                                              animationDuration: `${props.lcdScrollDuration}s`,
                                              transform: `translate(-${props.lcdScroll}%)`,
                                              top: 0,
                                          }
                                        : { top: 0 }
                                }
                            >
                                {scrollingText}
                            </span>
                        </div>
                    </div>
                    <div
                        className={classes.line2}
                        // Keyboard twin of clicking the LCD (a button can't contain the seek slider, so it is this line).
                        role={track ? 'button' : undefined}
                        tabIndex={track ? 0 : undefined}
                        aria-label={
                            track
                                ? showRemaining
                                    ? 'Time remaining; press to show elapsed'
                                    : 'Time elapsed; press to show remaining'
                                : undefined
                        }
                        onKeyDown={(e) => {
                            if (track && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                setShowRemaining((v) => !v);
                            }
                        }}
                    >
                        {track && (
                            <React.Fragment>
                                <span className={classes.elapsed}>
                                    {showRemaining
                                        ? `-${formatTimeFromSeconds(Math.max(0, track.duration - elapsed), false)}`
                                        : formatTimeFromSeconds(elapsed, false)}
                                </span>
                                <span className={classes.total}>/</span>
                                <span className={classes.total}>{formatTimeFromSeconds(track.duration, false)}</span>
                                <DeckPill tone="lcd">{`${recordingModeName(track, serviceRegistry.netmdSpec)} ${track.encoding.bitrate}k`}</DeckPill>
                            </React.Fragment>
                        )}
                    </div>
                    {track && track.duration > 0 && (
                        <div
                            className={classes.progress}
                            title="Click to seek"
                            role="slider"
                            tabIndex={0}
                            aria-label="Position in track"
                            aria-valuemin={0}
                            aria-valuemax={track.duration}
                            aria-valuenow={elapsed}
                            aria-valuetext={`${formatTimeFromSeconds(elapsed, false)} of ${formatTimeFromSeconds(track.duration, false)}`}
                            onKeyDown={(e) => {
                                const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
                                const time = e.key === 'Home' ? 0 : step !== undefined ? elapsed + step : null;
                                if (time === null) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const clamped = Math.min(Math.max(time, 0), Math.max(0, track.duration - 1));
                                dispatch(control('seek', { trackNumber: track.index, time: clamped }));
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                const box = e.currentTarget.getBoundingClientRect();
                                const fraction = Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1);
                                dispatch(control('seek', { trackNumber: track.index, time: Math.floor(fraction * track.duration) }));
                            }}
                        >
                            <div
                                className={classes.progressFill}
                                style={{ width: `${Math.min(100, (elapsed * 100) / track.duration)}%` }}
                            />
                        </div>
                    )}
                </LcdWindow>
            </DeckPanel>
        </div>
    );
};
