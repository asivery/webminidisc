import { UnicodeRenameFields } from './rename-unicode-fields';
import { validateDeviceTitles } from '../title-conversion';
import React, { useCallback } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';
import { actions as renameDialogActions, RenameType } from '../redux/rename-dialog-feature';
import { actions as appActions } from '../redux/app-feature';
import {
    renameTrack,
    renameDisc,
    renameGroup,
    renameInConvertDialog,
    himdRenameTrack,
    renameInConvertDialogHiMD,
    renameInSongRecognitionDialog,
} from '../redux/actions';
import serviceRegistry from '../services/registry';

import { makeStyles } from 'tss-react/mui';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { W95RenameDialog } from './win95/rename-dialog';
import { Capability } from '../services/interfaces/netmd';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles()((theme) => ({
    marginUpDown: {
        marginTop: theme.spacing(1.5),
        marginBottom: theme.spacing(1.5),
    },
}));

const nameMap: { [key in RenameType]: string } = {
    [RenameType.DISC]: 'Disc',
    [RenameType.GROUP]: 'Group',
    [RenameType.HIMD]: 'Track',
    [RenameType.HIMD_DISC]: 'Disc',
    [RenameType.TRACK]: 'Track',
    [RenameType.TRACK_CONVERT_DIALOG]: 'Track',
    [RenameType.TRACK_CONVERT_DIALOG_HIMD]: 'Track',
    [RenameType.SONG_RECOGNITION_TITLE]: 'Track',
};

export const RenameDialog = () => {
    const dispatch = useDispatch();
    const { classes } = useStyles();

    const {
        fullWidthTitle,
        himdAlbum,
        himdArtist,
        himdTitle,
        index,
        renameType,
        title,
        visible,
        unicodeTitle,
        unicodeSource,
        sourceId,
        tagLoading,
    } = useShallowEqualSelector((state) => state.renameDialog);
    const { deviceCapabilities } = useShallowEqualSelector((state) => state.main);

    const allowFullWidth = useShallowEqualSelector((state) => state.appState.fullWidthSupport);

    const what = nameMap[renameType];
    const { vintageMode } = useShallowEqualSelector((state) => state.appState);
    const enhanced =
        !vintageMode && [RenameType.DISC, RenameType.GROUP, RenameType.TRACK, RenameType.TRACK_CONVERT_DIALOG].includes(renameType);
    const supportsFullWidth = deviceCapabilities.includes(Capability.fullWidthSupport);
    const validation = validateDeviceTitles(title, enhanced && allowFullWidth && supportsFullWidth ? fullWidthTitle : '');
    const invalid = enhanced && (!!validation.titleError || !!validation.fullWidthError || tagLoading);
    const submittedFullWidth = enhanced && allowFullWidth && supportsFullWidth ? validation.normalizedFullWidth : fullWidthTitle;

    const handleCancelRename = useCallback(() => {
        dispatch(renameDialogActions.setVisible(false));
    }, [dispatch]);

    const handleDoRename = useCallback(() => {
        if (invalid) return;
        switch (renameType) {
            case RenameType.DISC:
                dispatch(
                    renameDisc({
                        newName: title,
                        newFullWidthName: submittedFullWidth,
                    })
                );
                break;
            case RenameType.TRACK:
                dispatch(
                    renameTrack({
                        index,
                        newName: title,
                        newFullWidthName: submittedFullWidth,
                    })
                );
                break;
            case RenameType.GROUP:
                dispatch(
                    renameGroup({
                        groupIndex: index,
                        newName: title,
                        newFullWidthName: submittedFullWidth,
                    })
                );
                break;
            case RenameType.HIMD:
                dispatch(
                    himdRenameTrack({
                        index,
                        title: himdTitle,
                        artist: himdArtist,
                        album: himdAlbum,
                    })
                );
                break;
            case RenameType.HIMD_DISC:
                // Hmm...
                alert('WIP');
                break;
            case RenameType.TRACK_CONVERT_DIALOG:
                dispatch(
                    renameInConvertDialog({
                        index,
                        ...(enhanced ? { unicodeTitle, unicodeSource, sourceId } : {}),
                        newName: title,
                        newFullWidthName: submittedFullWidth,
                    })
                );
                break;
            case RenameType.TRACK_CONVERT_DIALOG_HIMD:
                dispatch(
                    renameInConvertDialogHiMD({
                        index,
                        title: himdTitle,
                        artist: himdArtist,
                        album: himdAlbum,
                    })
                );
                break;
            case RenameType.SONG_RECOGNITION_TITLE:
                dispatch(
                    renameInSongRecognitionDialog({
                        index,
                        newName: title,
                        newFullWidthName: submittedFullWidth,
                    })
                );
                break;
        }
        handleCancelRename(); // Close the dialog
    }, [
        dispatch,
        handleCancelRename,
        renameType,
        title,
        index,
        himdTitle,
        himdArtist,
        himdAlbum,
        invalid,
        submittedFullWidth,
        enhanced,
        unicodeTitle,
        unicodeSource,
        sourceId,
    ]);

    const minidiscSpec = serviceRegistry.netmdSpec!;

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            dispatch(renameDialogActions.setCurrentName(event.target.value.substring(0, 120))); // MAX title length
        },
        [dispatch]
    );

    const handleFullWidthChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            dispatch(
                renameDialogActions.setCurrentFullWidthName(minidiscSpec.sanitizeFullWidthTitle(event.target.value.substring(0, 105)))
            );
        },
        [dispatch, minidiscSpec]
    );

    const handleEnterKeyEvent = useCallback(
        (event: React.KeyboardEvent) => {
            if (event.key === `Enter` && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.stopPropagation();
                event.preventDefault();
                handleDoRename();
            }
        },
        [handleDoRename]
    );

    const handleSwitchToFullWidth = useCallback(() => {
        dispatch(
            batchActions([
                appActions.setFullWidthSupport(true),
                renameDialogActions.setCurrentFullWidthName(minidiscSpec.sanitizeFullWidthTitle(title)),
                renameDialogActions.setCurrentName(''),
            ])
        );
    }, [title, dispatch, minidiscSpec]);

    // HIMD:
    const handleHiMDTitleChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            dispatch(renameDialogActions.setHimdTitle(event.target.value));
        },
        [dispatch]
    );
    const handleHiMDAlbumChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            dispatch(renameDialogActions.setHimdAlbum(event.target.value));
        },
        [dispatch]
    );
    const handleHiMDArtistChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
            dispatch(renameDialogActions.setHimdArtist(event.target.value));
        },
        [dispatch]
    );
    // /HIMD

    if (vintageMode) {
        const p = {
            renameDialogVisible: visible,
            renameDialogTitle: title,
            renameDialogIndex: index,
            what,
            handleCancelRename,
            handleDoRename,
            handleChange,
        };
        return <W95RenameDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            onClose={handleCancelRename}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="rename-dialog-title"
        >
            <DialogTitle id="rename-dialog-title">Rename {what}</DialogTitle>
            <DialogContent>
                {!enhanced &&
                !allowFullWidth &&
                deviceCapabilities.includes(Capability.fullWidthSupport) &&
                title
                    .split('')
                    .map((n) => n.charCodeAt(0))
                    .filter(
                        (n) =>
                            (n >= 0x3040 && n <= 0x309f) || // Hiragana
                            (n >= 0x4e00 && n <= 0x9faf) || // Kanji
                            (n >= 0x3400 && n <= 0x4dbf) // Rare kanji
                    ).length ? (
                    <Typography color="error" component="p">
                        You seem to be trying to enter full-width text into the half-width slot.{' '}
                        <Link onClick={handleSwitchToFullWidth} color="error" underline="always" style={{ cursor: 'pointer' }}>
                            Enable full-width title editing
                        </Link>
                        ?
                    </Typography>
                ) : null}
                {renameType === RenameType.HIMD || renameType === RenameType.TRACK_CONVERT_DIALOG_HIMD ? (
                    <>
                        <TextField
                            autoFocus
                            id="himdName"
                            label={`Title`}
                            type="text"
                            fullWidth
                            className={classes.marginUpDown}
                            value={himdTitle}
                            onKeyDown={handleEnterKeyEvent}
                            onChange={handleHiMDTitleChange}
                        />
                        <TextField
                            autoFocus
                            id="himdAlbum"
                            label={`Album`}
                            type="text"
                            fullWidth
                            className={classes.marginUpDown}
                            value={himdAlbum}
                            onKeyDown={handleEnterKeyEvent}
                            onChange={handleHiMDAlbumChange}
                        />
                        <TextField
                            autoFocus
                            id="himdArtist"
                            label={`Artist`}
                            type="text"
                            fullWidth
                            className={classes.marginUpDown}
                            value={himdArtist}
                            onKeyDown={handleEnterKeyEvent}
                            onChange={handleHiMDArtistChange}
                        />
                    </>
                ) : enhanced ? (
                    <UnicodeRenameFields
                        what={what}
                        allowFullWidth={allowFullWidth}
                        supportsFullWidth={supportsFullWidth}
                        titleError={validation.titleError}
                        fullWidthError={validation.fullWidthError}
                        onKeyDown={handleEnterKeyEvent}
                    />
                ) : (
                    <>
                        <TextField
                            autoFocus
                            id="name"
                            label={`${what} Name`}
                            type="text"
                            fullWidth
                            className={classes.marginUpDown}
                            value={title}
                            onKeyDown={handleEnterKeyEvent}
                            onChange={handleChange}
                        />
                        {allowFullWidth && deviceCapabilities.includes(Capability.fullWidthSupport) && (
                            <TextField
                                id="fullWidthTitle"
                                label={`Full-Width ${what} Name`}
                                type="text"
                                fullWidth
                                className={classes.marginUpDown}
                                value={fullWidthTitle}
                                onKeyDown={handleEnterKeyEvent}
                                onChange={handleFullWidthChange}
                            />
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancelRename}>Cancel</Button>
                <Button color={'primary'} disabled={invalid} onClick={handleDoRename}>
                    Rename
                </Button>
            </DialogActions>
        </Dialog>
    );
};
