import React from 'react';
import { Button, Panel } from 'react95';
import { belowDesktop, useDeviceCapabilities } from '../../frontend-utils';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PauseIcon from '@mui/icons-material/Pause';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        flex: '1 1 auto',
        alignItems: 'center',
        [belowDesktop(theme)]: {
            flexWrap: 'wrap',
        },
    },
    lcd: {
        backgroundColor: 'black !important',
        flex: '1 1 auto',
        margin: '0 80px 0 0px',
        minWidth: 150,
        height: 48,
        color: 'white !important',
        fontFamily: 'LCDDot',
    },
}));

export const W95Controls = (props: {
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
}) => {
    const { classes } = useStyles();
    const deviceCapabilities = useDeviceCapabilities();
    return (
        <div className={classes.container}>
            {deviceCapabilities.playbackControl && (
                <React.Fragment>
                    <Button disabled={!props.discPresent} onClick={props.handlePrev}>
                        <SkipPreviousIcon />
                    </Button>
                    <Button disabled={!props.discPresent} onClick={props.handlePlay}>
                        <PlayArrowIcon />
                    </Button>
                    <Button disabled={!props.discPresent} onClick={props.handlePause}>
                        <PauseIcon />
                    </Button>
                    <Button disabled={!props.discPresent} onClick={props.handleStop}>
                        <StopIcon />
                    </Button>
                    <Button disabled={!props.discPresent} onClick={props.handleNext} style={{ marginRight: 16 }}>
                        <SkipNextIcon />
                    </Button>
                </React.Fragment>
            )}

            <Panel variant="well" className={classes.lcd}>
                <div className={props.classes.lcdText} style={{ left: 16, width: 'calc(100% - 16px)' }}>
                    <span
                        className={props.lcdScroll ? props.classes.scrollingStatusMessage : props.classes.statusMessage}
                        ref={props.lcdRef}
                        style={
                            props.message && props.lcdScroll > 0
                                ? {
                                      animationDuration: `${props.lcdScrollDuration}s`,
                                      transform: `translate(-${props.lcdScroll}%)`,
                                      top: 12,
                                  }
                                : { top: 12 }
                        }
                    >
                        {props.discPresent ? props.message : props.loading ? 'LOADING...' : 'NO DISC'}
                    </span>
                </div>
            </Panel>
        </div>
    );
};
