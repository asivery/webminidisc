import React from 'react';
import { useDispatch } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';

import { actions as appActions } from '../redux/app-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { W95AboutDialog } from './win95/about-dialog';
import { GIT_DIFF, GIT_HASH, BUILD_DATE } from '../version-info';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const AboutDialog = (props: {}) => {
    const dispatch = useDispatch();

    const visible = useShallowEqualSelector((state) => state.appState.aboutDialogVisible);
    const vintageMode = useShallowEqualSelector((state) => state.appState.vintageMode);

    const handleClose = () => {
        dispatch(appActions.showAboutDialog(false));
    };

    if (vintageMode) {
        const p = {
            visible,
            handleClose,
        };
        return <W95AboutDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="about-dialog-slide-title"
        >
            <DialogTitle id="about-dialog-slide-title">About Web MiniDisc Pro</DialogTitle>
            <DialogContent>
                <DialogContentText>Web MiniDisc Pro uses</DialogContentText>
                <ul>
                    <li>
                        <Link rel="noopener noreferrer" href="https://www.ffmpeg.org/" target="_blank">
                            FFmpeg
                        </Link>{' '}
                        and{' '}
                        <Link rel="noopener noreferrer" href="https://github.com/ffmpegjs/FFmpeg" target="_blank">
                            ffmpegjs
                        </Link>
                        , to read your audio files (wav, mp3, ogg, mp4, etc...).
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://github.com/dcherednik/atracdenc/" target="_blank">
                            Atracdenc
                        </Link>
                        , to support atrac3 encoding (lp2, lp4 audio formats).
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://emscripten.org/" target="_blank">
                            Emscripten
                        </Link>
                        , to run both FFmpeg and Atracdenc in the browser.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://github.com/cybercase/netmd-js" target="_blank">
                            netmd-js
                        </Link>
                        , to send commands to NetMD devices using Javascript.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://github.com/asivery/netmd-exploits" target="_blank">
                            netmd-exploits
                        </Link>
                        , to download ATRAC via USB and trigger low-level firmware code.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://github.com/asivery/netmd-tocmanip" target="_blank">
                            netmd-tocmanip
                        </Link>
                        , to read and manipulate the table of contents.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://github.com/glaubitz/linux-minidisc" target="_blank">
                            linux-minidisc
                        </Link>
                        , to make the netmd-js project possible.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://react95.io/" target="_blank">
                            react95
                        </Link>
                        , to build the vintage user interface.
                    </li>
                    <li>
                        <Link rel="noopener noreferrer" href="https://material-ui.com/" target="_blank">
                            material-ui
                        </Link>
                        , to build the user interface.
                    </li>
                </ul>
                <DialogContentText>Attribution</DialogContentText>
                <ul>
                    <li>
                        MiniDisc logo from{' '}
                        <Link rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/MiniDisc" target="_blank">
                            https://en.wikipedia.org/wiki/MiniDisc
                        </Link>
                    </li>
                    <li>
                        MiniDisc icon from{' '}
                        <Link
                            rel="noopener noreferrer"
                            href="https://www.deviantart.com/blinkybill/art/Sony-MiniDisc-Plastic-Icon-473812540"
                            target="_blank"
                        >
                            http://fav.me/d7u3g3g
                        </Link>
                    </li>
                </ul>
                <Link target="_blank" href="https://ko-fi.com/asivery" style={{ display: 'block', textAlign: 'center' }}>
                    <img src="kofi.png" style={{ width: '50%' }} />
                </Link>
                <DialogContentText style={{ textAlign: 'center', fontSize: 13 }}>
                    Version #{GIT_HASH} {(GIT_DIFF as any) === '0' ? '' : `(${GIT_DIFF} diff-lines ahead)`} built on {BUILD_DATE}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};
