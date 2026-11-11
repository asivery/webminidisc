import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { belowDesktop, useShallowEqualSelector, forAnyDesktop, forWideDesktop } from '../frontend-utils';

import { actions as songRecognitionDialogActions, ImportMethod } from '../redux/song-recognition-dialog-feature';
import { recognizeTracks, renameTrack } from '../redux/actions';
import { actions as renameDialogActions, RenameType } from '../redux/rename-dialog-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import { makeStyles } from 'tss-react/mui';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Capability } from '../services/interfaces/netmd';
import serviceRegistry from '../services/registry';
import { LineInDeviceSelect } from './line-in-helpers';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles()((theme) => ({
    dialog: {
        margin: 'auto',
        [forAnyDesktop(theme)]: {
            width: 600,
            maxWidth: 600,
        },
        [forWideDesktop(theme)]: {
            width: 700,
            maxWidth: 700,
        },
    },
    container: {
        display: 'flex',
        flexDirection: 'row',
    },
    formControl: {
        minWidth: 60,
    },
    toggleButton: {
        minWidth: 40,
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
    },
    formatAndTitle: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    rightBlock: {
        display: 'flex',
        flexDirection: 'column',
    },
    titleFormControl: {
        minWidth: 170,
        marginTop: 4,
        [belowDesktop(theme)]: {
            width: 114,
            minWidth: 0,
        },
    },
    indexCell: {
        whiteSpace: 'nowrap',
        paddingRight: 0,
        width: theme.spacing(4),
    },
    checkmarkCell: {
        whiteSpace: 'nowrap',
        paddingRight: 0,
        width: theme.spacing(4),
    },
    trackIndex: {
        display: 'inline-block',
    },
    mainTable: {
        '& td': {
            paddingTop: 0,
            paddingBottom: 0,
        },
        '& th': {
            paddingTop: 0,
            paddingBottom: 0,
            borderBottomWidth: 3,
        },
    },
    greyedOut: {
        color: theme.palette.grey[700],
    },
    recognizeFail: {
        color: theme.palette.error.main,
    },
    // Deck Mode: status text is a one-line mono caption (declared after the two classes above).
    deckStatus: {
        whiteSpace: 'nowrap',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: 0.66,
    },
    lineInModule: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    noFetch: {
        color: theme.palette.error.main,
    },
    originalUnsanitizedName: {
        marginLeft: theme.spacing(3),
        fontStyle: 'italic',
    },
}));

export const SongRecognitionDialog = (props: {}) => {
    const dispatch = useDispatch();
    const { classes, cx } = useStyles();

    const { visible, titles, titleFormat, importMethod } = useShallowEqualSelector((state) => state.songRecognitionDialog);
    const { fullWidthSupport, deckMode } = useShallowEqualSelector((state) => state.appState);
    const { deviceCapabilities, disc } = useShallowEqualSelector((state) => state.main);

    // Line in section
    const [inputDeviceId, setInputDeviceId] = useState<string>('');
    const handleInputDeviceChange = useCallback(
        (ev: React.ChangeEvent<{ value: unknown }>) => {
            const deviceId = ev.target.value as string;
            setInputDeviceId(deviceId);
            serviceRegistry.mediaRecorderService?.stopTestInput();
            serviceRegistry.mediaRecorderService?.playTestInput(deviceId);
        },
        [setInputDeviceId]
    );

    const canApplyTitles = useMemo(() => {
        const allSelected = titles.filter((e) => e.selectedToRecognize);
        return allSelected.every((e) => e.alreadyRecognized) && allSelected.length > 0;
    }, [titles]);

    const stopAudioInput = useCallback(() => {
        setInputDeviceId('');
        serviceRegistry.mediaRecorderService?.stopTestInput();
    }, []);

    const handleChangeImportMethod = useCallback(
        (e: React.SyntheticEvent, newFormat: ImportMethod) => {
            newFormat && dispatch(songRecognitionDialogActions.setImportMethod(newFormat));
            if (newFormat !== 'line-in') {
                stopAudioInput();
            }
        },
        [dispatch, stopAudioInput]
    );

    const handleChangeTitleFormat = useCallback(
        (e: any) => {
            dispatch(songRecognitionDialogActions.setTitleFormat(e.target.value));
        },
        [dispatch]
    );

    const handleClose = useCallback(() => {
        stopAudioInput();
        dispatch(songRecognitionDialogActions.setVisible(false));
    }, [dispatch, stopAudioInput]);

    const handleApplyTitles = useCallback(() => {
        handleClose();
        dispatch(
            renameTrack(
                ...titles
                    .filter((e) => e.alreadyRecognized && e.selectedToRecognize && !e.recognizeFail)
                    .map((e) => ({ index: e.index, newName: e.newTitle, newFullWidthName: e.newFullWidthTitle }))
            )
        );
    }, [dispatch, handleClose, titles]);

    const handleRecognize = useCallback(() => {
        dispatch(
            recognizeTracks(titles, importMethod, {
                deviceId: inputDeviceId,
            })
        );
    }, [dispatch, titles, importMethod, inputDeviceId]);

    const handleToggleRecognize = useCallback(
        (i: number) => {
            dispatch(
                songRecognitionDialogActions.setTitles(
                    titles.map((e) => {
                        return {
                            ...e,
                            selectedToRecognize: e.index === i ? !e.selectedToRecognize : e.selectedToRecognize,
                        };
                    })
                )
            );
        },
        [dispatch, titles]
    );

    const handleToggleSelectAll = useCallback(() => {
        const selectedTitles = titles.filter((e) => e.selectedToRecognize);
        dispatch(
            songRecognitionDialogActions.setTitles(
                titles.map((e) => {
                    return {
                        ...e,
                        selectedToRecognize: selectedTitles.length <= titles.length / 2,
                    };
                })
            )
        );
    }, [titles, dispatch]);

    const handleOpenRenameDialog = useCallback(
        (index: number) => {
            const track = titles[index];
            dispatch(
                batchActions([
                    renameDialogActions.setVisible(true),
                    renameDialogActions.setCurrentName(track.newTitle),
                    renameDialogActions.setCurrentFullWidthName(track.newFullWidthTitle),
                    renameDialogActions.setIndex(index),
                    renameDialogActions.setRenameType(RenameType.SONG_RECOGNITION_TITLE),
                ])
            );
        },
        [titles, dispatch]
    );

    useEffect(() => {
        let changed = false;
        const newArray = [...titles];
        for (let i = 0; i < newArray.length; i++) {
            const title = newArray[i];
            const minidiscSpec = serviceRegistry.netmdSpec!;

            let halfWidth, fullWidth;
            let newRawTitle;
            if (title.manualOverrideNewTitle || title.manualOverrideNewFullWidthTitle) {
                newRawTitle = title.manualOverrideNewTitle;
                halfWidth = minidiscSpec.sanitizeHalfWidthTitle(title.manualOverrideNewTitle);
                fullWidth = minidiscSpec.sanitizeFullWidthTitle(title.manualOverrideNewFullWidthTitle);
            } else {
                switch (titleFormat) {
                    case 'title': {
                        newRawTitle = title.songTitle;
                        break;
                    }
                    case 'artist-title': {
                        newRawTitle = `${title.songArtist} - ${title.songTitle}`;
                        break;
                    }
                    case 'title-artist': {
                        newRawTitle = `${title.songTitle} - ${title.songArtist}`;
                        break;
                    }
                    case 'album-title': {
                        newRawTitle = `${title.songAlbum} - ${title.songTitle}`;
                        break;
                    }
                    case 'artist-album-title': {
                        newRawTitle = `${title.songArtist} - ${title.songAlbum} - ${title.songTitle}`;
                        break;
                    }
                }

                halfWidth = minidiscSpec.sanitizeHalfWidthTitle(newRawTitle);
                fullWidth = minidiscSpec.sanitizeFullWidthTitle(newRawTitle);
            }

            if (minidiscSpec.sanitizeHalfWidthTitle(fullWidth) === halfWidth) fullWidth = ''; // Save space - if the titles are the same, don't write full width

            changed = changed || title.newFullWidthTitle !== fullWidth || title.newTitle !== halfWidth;
            newArray[i] = {
                ...newArray[i],
                newFullWidthTitle: fullWidth,
                newTitle: halfWidth,
                unsanitizedTitle: halfWidth === newRawTitle ? null : newRawTitle,
            };
        }

        if (changed) dispatch(songRecognitionDialogActions.setTitles(newArray));
    }, [dispatch, titleFormat, titles]);

    useEffect(() => {
        if (!disc) handleClose();
    }, [handleClose, disc]);

    return (
        <Dialog
            open={visible}
            maxWidth={'xs'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="song-recognition-dialog-slide-title"
            aria-describedby="song-recognition-dialog-slide-description"
            classes={{ paperScrollPaper: classes.dialog }}
        >
            <DialogTitle id="convert-dialog-slide-title">Song Recognition Settings</DialogTitle>
            <DialogContent className={classes.dialogContent}>
                <div className={classes.formatAndTitle}>
                    <Typography
                        component="h3"
                        className={classes.noFetch}
                        hidden={window.native?.unrestrictedFetchJSON !== undefined}
                        style={{ marginTop: '1em' }}
                        align="center"
                    >
                        To use this functionality you either need to import a{' '}
                        <Link href="https://raw.githubusercontent.com/asivery/webminidisc/master/webminidisc-song-recognition.user.js">
                            userscript
                        </Link>{' '}
                        or use <Link href="https://github.com/asivery/ElectronWMD">ElectronWMD</Link> instead.
                    </Typography>

                    <FormControl>
                        <Typography component="label" variant="caption" color="textSecondary">
                            Import Method
                        </Typography>
                        <ToggleButtonGroup value={importMethod} exclusive onChange={handleChangeImportMethod} size="small">
                            <ToggleButton className={classes.toggleButton} value="line-in">
                                Line-In
                            </ToggleButton>
                            <ToggleButton
                                className={classes.toggleButton}
                                value="exploits"
                                disabled={!deviceCapabilities.includes(Capability.factoryMode)}
                            >
                                Exploits
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </FormControl>
                    <div className={classes.rightBlock}>
                        <FormControl className={classes.formControl}>
                            <Typography component="label" variant="caption" color="textSecondary">
                                Track title format
                            </Typography>
                            <FormControl className={classes.titleFormControl}>
                                <Select value={titleFormat} color="secondary" input={<Input />} onChange={handleChangeTitleFormat}>
                                    <MenuItem value={`title`}>Title</MenuItem>
                                    <MenuItem value={`album-title`}>Album - Title</MenuItem>
                                    <MenuItem value={`artist-title`}>Artist - Title</MenuItem>
                                    <MenuItem value={`title-artist`}>Title - Artist</MenuItem>
                                    <MenuItem value={`artist-album-title`}>Artist - Album - Title</MenuItem>
                                </Select>
                            </FormControl>
                        </FormControl>
                    </div>
                </div>
                {importMethod === 'line-in' && (
                    <div className={classes.lineInModule}>
                        <LineInDeviceSelect handleChange={handleInputDeviceChange} inputDeviceId={inputDeviceId} />
                    </div>
                )}
                <Table className={classes.mainTable}>
                    <TableHead>
                        <TableRow>
                            <TableCell className={classes.checkmarkCell}>
                                <Checkbox checked={titles.every((e) => e.selectedToRecognize)} onClick={handleToggleSelectAll} />
                            </TableCell>
                            <TableCell className={classes.indexCell}>#</TableCell>
                            <TableCell>Original Title</TableCell>
                            <TableCell>New Title</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {titles.map((title) => (
                            <TableRow hover key={`title-${title.index}`} onClick={(e) => handleToggleRecognize(title.index)}>
                                <TableCell>
                                    <Checkbox checked={title.selectedToRecognize} />
                                </TableCell>
                                <TableCell>
                                    <span className={classes.trackIndex}>{title.index + 1}</span>
                                </TableCell>
                                <TableCell>
                                    {(title.originalTitle || 'No Title') +
                                        (title.originalFullWidthTitle ? ` / ${title.originalFullWidthTitle}` : '')}
                                </TableCell>
                                <TableCell
                                    onDoubleClick={() => handleOpenRenameDialog(title.index)}
                                    className={cx(
                                        title.recognizeFail ? classes.recognizeFail : !title.alreadyRecognized ? classes.greyedOut : ``,
                                        deckMode && (title.recognizeFail || !title.alreadyRecognized) && classes.deckStatus
                                    )}
                                >
                                    {title.recognizeFail
                                        ? 'Could not recognize'
                                        : !title.alreadyRecognized
                                          ? 'Not recognized'
                                          : (title.newTitle || 'No Title') +
                                            (title.newFullWidthTitle && fullWidthSupport ? ` / ${title.newFullWidthTitle}` : '')}
                                    {title.unsanitizedTitle && (
                                        <span className={classes.originalUnsanitizedName}>[{title.unsanitizedTitle}]</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button
                    onClick={handleRecognize}
                    disabled={
                        canApplyTitles ||
                        !titles.some((e) => e.selectedToRecognize) ||
                        (importMethod === 'line-in' && inputDeviceId === '') ||
                        window.native?.unrestrictedFetchJSON === undefined
                    }
                >
                    Recognize
                </Button>
                <Button onClick={handleApplyTitles} disabled={!canApplyTitles || !deviceCapabilities.includes(Capability.metadataEdit)}>
                    Apply New Titles
                </Button>
            </DialogActions>
        </Dialog>
    );
};
