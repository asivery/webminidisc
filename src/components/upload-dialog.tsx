import React, { useCallback } from 'react';
import { useDispatch } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';

import { actions as uploadDialogActions } from '../redux/upload-dialog-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { makeStyles } from 'tss-react/mui';
import { W95UploadDialog } from './win95/upload-dialog';
import { setNotifyWhenFinished } from '../redux/actions';

const useStyles = makeStyles()((theme) => ({
    progressPerc: {
        marginTop: theme.spacing(1),
    },
    progressBar: {
        marginTop: theme.spacing(3),
    },
    uploadLabel: {
        marginTop: theme.spacing(3),
    },
    spacer: {
        flex: '1 1 auto',
    },
    checkBox: {
        marginLeft: 0,
    },
}));

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const UploadDialog = (props: {}) => {
    const { classes } = useStyles();
    const dispatch = useDispatch();

    const {
        visible,
        cancelled,
        writtenProgress,
        encryptedProgress,
        totalProgress,

        trackTotal,
        trackCurrent,
        trackConverting,
        titleCurrent,
        titleConverting,

        trackEncodeProgress,
        trackEncodeProgressOutOf,
    } = useShallowEqualSelector((state) => state.uploadDialog);
    const { vintageMode, notifyWhenFinished, hasNotificationSupport } = useShallowEqualSelector((state) => state.appState);

    const handleCancelUpload = useCallback(() => {
        dispatch(uploadDialogActions.setCancelUpload(true));
    }, [dispatch]);

    const handleNotifyWhenFinishedChanged = useCallback(() => {
        dispatch(setNotifyWhenFinished(!notifyWhenFinished));
    }, [dispatch, notifyWhenFinished]);

    const progressValue = Math.floor((writtenProgress / totalProgress) * 100);
    const bufferValue = Math.floor((encryptedProgress / totalProgress) * 100);
    const convertedValue = Math.floor((trackConverting / trackTotal) * 100);
    const currentTrackConversionProgress =
        trackEncodeProgressOutOf === 0 ? undefined : Math.floor((trackEncodeProgress / trackEncodeProgressOutOf) * 100);

    if (vintageMode) {
        const p = {
            visible,
            cancelled,
            writtenProgress,
            encryptedProgress,
            totalProgress,

            trackTotal,
            trackCurrent,
            trackConverting,
            titleCurrent,
            titleConverting,

            handleCancelUpload,
            progressValue,
            bufferValue,
            convertedValue,
            notifyWhenFinished,
            hasNotificationSupport,
            handleNotifyWhenFinishedChanged,
        };
        return <W95UploadDialog {...p} />;
    }
    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="alert-dialog-slide-title"
            aria-describedby="alert-dialog-slide-description"
        >
            <DialogTitle id="alert-dialog-slide-title">Recording...</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-slide-description">
                    {convertedValue === 100 && trackConverting === trackTotal
                        ? `Conversion completed`
                        : `Converting ${trackConverting + 1} of ${trackTotal}: ${titleConverting}`}
                </DialogContentText>
                <LinearProgress
                    className={classes.progressBar}
                    variant={(currentTrackConversionProgress ?? convertedValue) === 0 ? 'indeterminate' : 'determinate'}
                    color="primary"
                    value={currentTrackConversionProgress ?? convertedValue}
                />
                <Box className={classes.progressPerc}>{currentTrackConversionProgress ?? convertedValue}%</Box>

                <DialogContentText id="alert-dialog-slide-description" className={classes.uploadLabel}>
                    Uploading {trackCurrent} of {trackTotal}: {titleCurrent}
                </DialogContentText>
                <LinearProgress
                    className={classes.progressBar}
                    variant="buffer"
                    color="secondary"
                    value={progressValue}
                    valueBuffer={bufferValue}
                />
                <Box className={classes.progressPerc}>{progressValue}%</Box>
            </DialogContent>
            <DialogActions>
                {hasNotificationSupport ? (
                    <FormControlLabel
                        className={classes.checkBox}
                        disabled={!hasNotificationSupport}
                        control={<Checkbox checked={notifyWhenFinished} onChange={handleNotifyWhenFinishedChanged} name="notifyOnEnd" />}
                        label="Notify when completed"
                    />
                ) : null}
                <div className={classes.spacer}></div>
                <Button disabled={cancelled} onClick={handleCancelUpload}>
                    {cancelled ? `Stopping after current track...` : `Cancel Recording`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
