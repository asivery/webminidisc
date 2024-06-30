import React, { useCallback, useRef, useEffect, useState, useMemo, SyntheticEvent } from 'react';
import clsx from 'clsx';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PauseIcon from '@mui/icons-material/Pause';

import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';

import { makeStyles } from 'tss-react/mui';
import { formatTimeFromSeconds, getSortedTracks } from '../utils';
import { belowDesktop, useDeviceCapabilities, useShallowEqualSelector } from '../frontend-utils';
import { control } from '../redux/actions';
import { useDispatch } from '../frontend-utils';

import MDIcon0 from '../images/md0.svg?react';
import MDIcon1 from '../images/md1.svg?react';
import MDIcon2 from '../images/md2.svg?react';
import MDIcon3 from '../images/md3.svg?react';
import { W95Controls } from './win95/controls';

const frames = [MDIcon0, MDIcon1, MDIcon2, MDIcon3];

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        flex: '1 1 auto',
        [belowDesktop(theme)]: {
            flexWrap: 'wrap',
        },
    },
    lcd: {
        flex: '1 1 auto',
        position: 'relative',
        cursor: 'pointer',
        marginLeft: theme.spacing(1.5),
        marginRight: theme.spacing(1.5),
        paddingLeft: theme.spacing(3),
        paddingRight: theme.spacing(3),
        borderRadius: theme.spacing(3),
        backgroundColor: theme.palette.background.default,
        minWidth: 150,
        height: 48,
        [belowDesktop(theme)]: {
            marginLeft: 0,
            marginRight: theme.spacing(2),
        },
        userSelect: 'none',
    },
    lcdText: {
        overflow: 'hidden',
        position: 'relative',
        width: 'calc(100% - 40px)',
        left: 40,
        height: '100%',
        fontFamily: 'LCDDot',
    },
    lcdDisc: {
        position: 'absolute',
        top: 0,
        left: 20,
    },
    lcdDiscIcon: {
        width: 28,
        height: 48,
        '& g': {
            fill: theme.palette.action.active,
        },
    },
    scrollingStatusMessage: {
        position: 'absolute',
        width: '100%',
        whiteSpace: 'nowrap',
        animationName: 'scrollLeft',
        animationTimingFunction: 'linear',
        animationIterationCount: '1',
        top: 15,
        left: 1,
    },
    statusMessage: {
        position: 'absolute',
        width: '100%',
        whiteSpace: 'nowrap',
        top: 15,
        left: 1,
    },
    lcdBlink: {
        animationName: 'blink',
        animationTimingFunction: 'step-end',
        animationDuration: '1s',
        animationIterationCount: 'infinite',
    },
    button: {
        width: 48,
        height: 48,
    },
    durationHolder: {
        display: 'flex',
        position: 'relative',
        top: -44,
    },
    duration: {
        // width: '100%',
        flexGrow: 0.01,
        height: 8,
        backgroundSize: '8px 4px',

        backgroundRepeat: 'repeat-x',
        backgroundImage:
            "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9Tix9UBC0i4pChOlkQFREnrUIRKpRaoVUHk0u/oElDkuLiKLgWHPxYrDq4OOvq4CoIgh8gzg5Oii5S4v+SQosYD4778e7e4+4dINRKTDXbxgBVs4xkLCqmM6ti+ysC6EU/ZtApMVOfSyTi8Bxf9/Dx9S7Cs7zP/Tm6lazJAJ9IPMt0wyLeIJ7atHTO+8QhVpAU4nPiUYMuSPzIddnlN855hwWeGTJSyXniELGYb2G5hVnBUIknicOKqlG+kHZZ4bzFWS1VWOOe/IXBrLayzHWaQ4hhEUtIQISMCooowUKEVo0UE0naj3r4Bx1/glwyuYpg5FhAGSokxw/+B7+7NXMT425SMAoEXmz7Yxho3wXqVdv+Prbt+gngfwautKa/XAOmP0mvNrXwEdCzDVxcNzV5D7jcAQaedMmQHMlPU8jlgPcz+qYM0HcLdK25vTX2cfoApKir+A1wcAiM5Cl73ePdHa29/Xum0d8PjEtysaBQHcsAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfoBRIXCBTPWcirAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAABhJREFUKM9jZCAM/uOTZGKgEIwaMBgMAAD0cwEPreO1ugAAAABJRU5ErkJggg==')",
        filter: theme.palette.mode === 'dark' ? 'invert(1) contrast(0.5)' : 'contrast(0.1)',
    },
    durationSlowDown: {
        transition: 'flex-grow linear 0.5s',
    },
}));

export const Controls = () => {
    const dispatch = useDispatch();
    // TODO: The shallow equality won't work for these 2 states
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const disc = useShallowEqualSelector((state) => state.main.disc);
    const loading = useShallowEqualSelector((state) => state.appState.loading);

    const deviceCapabilities = useDeviceCapabilities();

    const { classes, cx } = useStyles();
    const [lcdScreen, _setLCDScreen] = useState<number>(-1);
    const [trackPercentage, _setTrackPercentage] = useState<number>(0);
    const setLCDScreen = (newScreen: number) => (lcdScreen === newScreen ? void 0 : _setLCDScreen(newScreen));
    const setTrackPercentage = (newTrackPercentage: typeof _setTrackPercentage extends (a: infer R) => any ? R : never) =>
        newTrackPercentage === trackPercentage ? void 0 : _setTrackPercentage(newTrackPercentage);

    const handlePrev = useCallback(() => {
        dispatch(control('prev'));
    }, [dispatch]);
    const handlePlay = useCallback(() => {
        dispatch(control('play'));
    }, [dispatch]);
    const handleStop = useCallback(() => {
        dispatch(control('stop'));
    }, [dispatch]);
    const handleNext = useCallback(() => {
        dispatch(control('next'));
    }, [dispatch]);
    const handlePause = useCallback(() => {
        dispatch(control('pause'));
    }, [dispatch]);

    const [isSeeking, setIsSeeking] = useState(false);
    const [isSeekingProgressLocked, setIsSeekingProgressLocked] = useState(false);
    const [lcdClickPrevent, setLCDClickPrevent] = useState(false);
    const durationHolderRef = useRef<HTMLDivElement | null>(null);
    let message = ``;
    const trackIndex = deviceStatus?.track ?? null;
    const deviceState = deviceStatus?.state ?? null;
    const discPresent = deviceStatus?.discPresent ?? false;
    const paused = deviceStatus?.state === 'paused';
    const tracks = useMemo(() => getSortedTracks(disc), [disc]);
    if (!discPresent) {
        message = ``;
        setLCDScreen(-1);
        setTrackPercentage(0);
    } else if (deviceState === 'readingTOC') {
        message = 'READING TOC';
        setLCDScreen(-1);
        setTrackPercentage(0);
    } else if (tracks.length === 0) {
        message = `BLANKDISC`;
        setLCDScreen(-1);
        setTrackPercentage(0);
    } else if (deviceStatus && deviceStatus.track !== null && tracks[deviceStatus.track]) {
        const track = tracks[deviceStatus.track];
        const title = track.fullWidthTitle || track.title;
        let currentTimeSecs = (deviceStatus.time?.minute ?? 0) * 60 + (deviceStatus.time?.second ?? 0);
        message = (deviceStatus.track + 1).toString().padStart(3, '0') + (title ? ' - ' + title : '');
        const messageIsTime = () =>
            (message = `${formatTimeFromSeconds(currentTimeSecs, false)} / ${formatTimeFromSeconds(track.duration, false)}`);
        switch (lcdScreen) {
            // -1, 0 - use default
            case 1: // Elapsed Time
                messageIsTime();
                break;
            case 2:
                const timeDiff = track.duration - currentTimeSecs;
                message = `-${formatTimeFromSeconds(timeDiff, false)}`;
                break;
        }
        if (isSeekingProgressLocked) {
            currentTimeSecs = Math.floor((trackPercentage * track.duration) / 100);
        } else {
            setTrackPercentage(Math.floor((currentTimeSecs / track.duration) * 100));
        }
        if (isSeeking) {
            messageIsTime();
        }
        // Is locked on a certain message, but can allow other?
        if (lcdScreen === -1) {
            // Unlock it
            setLCDScreen(0);
        }
    }

    const [lcdScroll, setLcdScroll] = useState(0);
    const [lcdScrollDuration, setLcdScrollDuration] = useState(0);
    const [lcdIconFrame, setLcdIconFrame] = useState(0);

    const handleLCDClick = useCallback(() => {
        _setLCDScreen((old) => {
            if (old === -1) return old; //Locked
            let next = old + 1;
            if (next >= 3) next = 0;
            return next;
        });
    }, [_setLCDScreen]);

    const startSeeking = (e: SyntheticEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setLCDClickPrevent(true);
        setIsSeeking(true);
        setIsSeekingProgressLocked(true);
    };

    useEffect(() => {
        const func = (e: MouseEvent) => {
            if (!isSeeking) return;
            e.preventDefault();
            e.stopPropagation();
            const xPerc = Math.min(
                Math.max(
                    ((e.pageX - durationHolderRef.current!.getBoundingClientRect().left) * 100) / durationHolderRef.current!.clientWidth,
                    0
                ),
                100
            );
            setTrackPercentage(xPerc);
        };
        window.addEventListener('mousemove', func);
        return () => window.removeEventListener('mousemove', func);
    }, [isSeeking, durationHolderRef]);

    useEffect(() => {
        const func = () => {
            setIsSeeking((wasSeeking) => {
                if (wasSeeking) {
                    setTimeout(() => setIsSeekingProgressLocked(false), 1000);
                    if (!deviceStatus?.track) return false;
                    const track = tracks[deviceStatus.track];
                    // Hack:
                    setTrackPercentage((trackPercentage: number) => {
                        const seekTo = Math.floor((trackPercentage * track.duration) / 100);
                        dispatch(control('seek', { trackNumber: deviceStatus.track, time: seekTo }));
                        return trackPercentage;
                    });
                }
                return false;
            });
        };
        window.addEventListener('mouseup', func);
        return () => window.removeEventListener('mouseup', func);
    }, [setIsSeeking, deviceStatus, tracks, dispatch]);

    // LCD Text scrolling
    const animationDelayInMS = 2000;
    const scrollTimerRef = useRef<any>(null);
    const lcdRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        const updateLCDScroll = () => {
            const domEl = lcdRef.current;
            const textWidth = domEl?.scrollWidth ?? 0;
            const lcdWidth = domEl?.parentElement?.offsetWidth ?? 0;
            const scrollPerc = textWidth > lcdWidth ? (textWidth * 100) / lcdWidth : 0;
            const scrollDurationInSec = textWidth > lcdWidth ? textWidth / 20 : 0; // Compute duration to achieve constant speed
            setLcdScroll(scrollPerc);
            setLcdScrollDuration(scrollDurationInSec);
            if (scrollDurationInSec > 0) {
                scrollTimerRef.current = setTimeout(
                    () => {
                        setLcdScroll(0);
                    },
                    scrollDurationInSec * 1000 + 500
                ); // stop animation timer
            }
        };

        clearTimeout(scrollTimerRef.current);
        setLcdScroll(0);
        scrollTimerRef.current = setTimeout(() => {
            updateLCDScroll();
        }, animationDelayInMS); // start animation timer

        return () => {
            clearTimeout(scrollTimerRef.current); // clear all the timers on unmount
        };
    }, [trackIndex, deviceState, message]);

    // Disc animation
    const lcdIconAnimationTimer = useRef<any>(null);
    useEffect(() => {
        clearInterval(lcdIconAnimationTimer.current);
        if (deviceState === 'playing' || deviceState === 'readingTOC') {
            lcdIconAnimationTimer.current = setInterval(() => {
                setLcdIconFrame(1 + (lcdIconFrame % (frames.length - 1)));
            }, 600);
        } else {
            setLcdIconFrame(0);
        }
        return () => {
            clearInterval(lcdIconAnimationTimer.current);
        };
    }, [deviceState, lcdIconFrame]);

    const DiscFrame = frames[lcdIconFrame];

    const vintageMode = useShallowEqualSelector((state) => state.appState.vintageMode);
    if (vintageMode) {
        const p = {
            handlePrev,
            handlePlay,
            handleStop,
            handlePause,
            handleNext,

            message,
            loading,
            discPresent,
            lcdScroll,
            lcdRef,
            lcdScrollDuration,

            classes,
        };
        return <W95Controls {...p} />;
    }

    return (
        <Box className={classes.container}>
            {deviceCapabilities.playbackControl ? (
                <React.Fragment>
                    <IconButton disabled={!disc} aria-label="prev" onClick={handlePrev} className={classes.button}>
                        <SkipPreviousIcon />
                    </IconButton>
                    <IconButton disabled={!disc} aria-label="play" onClick={handlePlay} className={classes.button}>
                        <PlayArrowIcon />
                    </IconButton>
                    <IconButton disabled={!disc} aria-label="pause" onClick={handlePause} className={classes.button}>
                        <PauseIcon />
                    </IconButton>
                    <IconButton disabled={!disc} aria-label="stop" onClick={handleStop} className={classes.button}>
                        <StopIcon />
                    </IconButton>
                    <IconButton disabled={!disc} aria-label="next" onClick={handleNext} className={classes.button}>
                        <SkipNextIcon />
                    </IconButton>
                </React.Fragment>
            ) : null}
            <div className={classes.lcd} onClick={lcdClickPrevent ? () => setLCDClickPrevent(false) : handleLCDClick}>
                <div className={classes.lcdText}>
                    <span
                        className={cx(lcdScroll ? classes.scrollingStatusMessage : classes.statusMessage, {
                            [classes.lcdBlink]: disc === null,
                        })}
                        ref={lcdRef}
                        style={
                            message && lcdScroll > 0
                                ? { animationDuration: `${lcdScrollDuration}s`, transform: `translate(-${lcdScroll}%)` }
                                : {}
                        }
                    >
                        {disc === null ? (loading ? 'LOADING...' : 'NO DISC') : message}
                    </span>
                </div>
                <div className={classes.lcdDisc}>
                    {discPresent && <DiscFrame className={cx(classes.lcdDiscIcon, { [classes.lcdBlink]: paused })} />}
                </div>
                <div className={classes.durationHolder} ref={durationHolderRef} onMouseDown={startSeeking}>
                    <div
                        className={clsx(classes.duration, { [classes.durationSlowDown]: !isSeeking })}
                        style={{ flexGrow: trackPercentage }}
                    ></div>
                    <div style={{ flexGrow: 100 - trackPercentage }}></div>
                </div>
            </div>
        </Box>
    );
};

export default Controls;
