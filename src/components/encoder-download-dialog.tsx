import React from 'react';
import { useShallowEqualSelector } from '../frontend-utils';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
    progressPerc: {
        marginTop: theme.spacing(1),
    },
    progressBar: {
        marginTop: theme.spacing(3),
    },
}));

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const EncoderDownloadDialog = (props: {}) => {
    const { classes } = useStyles();

    const { visible, currentEncoderIndex, currentEncoderName, totalEncoders } = useShallowEqualSelector((state) => state.encoderDownloadDialog);

    const progressValue = (100 * currentEncoderIndex) / totalEncoders;

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="encoder-download-dialog-slide-title"
            aria-describedby="encoder-download-dialog-slide-description"
        >
            <DialogTitle id="encoder-download-dialog-slide-title">Installing encoders...</DialogTitle>
            <DialogContent>
                <DialogContentText id="encoder-download-dialog-slide-description">
                    {`Installing encoder ${currentEncoderIndex + 1} of ${totalEncoders}: ${currentEncoderName}`}
                </DialogContentText>
                <LinearProgress
                    className={classes.progressBar}
                    variant="determinate"
                    color="primary"
                    value={progressValue}
                />
                <Box className={classes.progressPerc}>{progressValue >= 0 ? `${progressValue}%` : ``}</Box>
            </DialogContent>
            <DialogActions></DialogActions>
        </Dialog>
    );
};
