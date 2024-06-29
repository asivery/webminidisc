import React, { SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from '../frontend-utils';
import {
    getMetadataFromFile,
    removeExtension,
    secondsToNormal,
    getATRACWAVEncoding,
    getATRACOMAEncoding,
    getChannelsFromAEA,
    acceptedTypes,
    AdaptiveFile
} from '../utils';
import {
    belowDesktop,
    useShallowEqualSelector,
    batchActions
} from "../frontend-utils";

import { actions as convertDialogActions, ForcedEncodingFormat, TitleFormatType } from '../redux/convert-dialog-feature';
import { actions as renameDialogActions, RenameType } from '../redux/rename-dialog-feature';
import { actions as appActions } from '../redux/app-feature';
import { convertAndUpload, openLocalLibrary } from '../redux/actions';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import { makeStyles } from 'tss-react/mui';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/lab/ToggleButton';
import ToggleButtonGroup from '@mui/lab/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import CloudDownload from '@mui/icons-material/CloudDownload';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import { lighten } from '@mui/material/styles';
import ListItemIcon from '@mui/material/ListItemIcon';
import Radio from '@mui/material/Radio';
import { FileRejection, useDropzone } from 'react-dropzone';
import Backdrop from '@mui/material/Backdrop';
import { W95ConvertDialog } from './win95/convert-dialog';
import { Capability, Codec, CodecFamily, Disc } from '../services/interfaces/netmd';
import serviceRegistry from '../services/registry';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { LeftInNondefaultCodecs } from './main-rows';

const Transition = React.forwardRef(function Transition(
    props: SlideProps,
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

function TooltipOrDefault(params: { children: any; title: any; arrow: boolean; tooltipEnabled: boolean }) {
    if (!params.tooltipEnabled) {
        return params.children;
    } else {
        return (
            <Tooltip title={params.title} arrow={params.arrow}>
                {params.children}
            </Tooltip>
        );
    }
}

// TODO jss-to-tss-react codemod: Unable to handle style definition reliably. Unsupported arrow function syntax.
//Unexpected value type of ConditionalExpression.
const useStyles = makeStyles()(theme => ({
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
    himdDialog: {
        maxWidth: 800,
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
    spacer: {
        display: 'flex',
        flex: '1 1 auto',
    },
    showTracksOrderBtn: {
        marginLeft: theme.spacing(1),
    },
    tracksOrderAccordion: {
        '&:before': {
            opacity: 0,
        },
    },
    tracksOrderAccordionDetail: {
        maxHeight: '40vh',
        overflow: 'auto',
    },
    toolbarHighlight:
        theme.palette.mode === 'light'
            ? {
                color: theme.palette.secondary.main,
                backgroundColor: lighten(theme.palette.secondary.light, 0.85),
            }
            : {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.secondary.dark,
            },
    trackList: {
        flex: '1 1 auto',
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    nameNotFit: {
        color: theme.palette.warning.main,
    },
    warningMediocreEncoder: {
        color: theme.palette.warning.main,
    },
    durationNotFit: {
        color: theme.palette.error.main,
    },
    timeTooltip: {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '3px',
    },
    durationsSpan: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: theme.spacing(2),
    },
    advancedOptionsAccordion: {
        boxShadow: 'none',
        marginTop: theme.spacing(2),
        '&:before': {
            opacity: 0,
        },
    },
    advancedOptionsAccordionContents: {
        flexDirection: 'column',
    },
    advancedOptionsAccordionSummary: {
        boxShadow: 'none',
        minHeight: '32px !important',
        height: '32px',
        padding: 0,
    },
    advancedOption: {
        width: '100%',
    },
    fixedTable: {
        tableLayout: 'fixed',
    },
    selectCheckboxTableCell: {
        width: 20,
    },
    toggleButtonWarning: {
        color: `${theme.palette.warning.main} !important`,
    },
    forcedEncodingLabel: {
        color: theme.palette.warning.main,
    },
    iconButton: {
        marginRight: theme.spacing(1),
    }
}));

type FileWithMetadata = {
    file: File | AdaptiveFile;
    title: string;
    album: string;
    artist: string;
    duration: number;
    forcedEncoding: ForcedEncodingFormat;
    bytesToSkip: number;
};

function createForcedEncodingText(selectedCodec: Codec, file: { forcedEncoding: ForcedEncodingFormat }) {
    const remapTable: { [name: string]: string } = {
        SPS: 'Stereo SP - Homebrew!',
        SPM: 'Mono SP - Homebrew!',
        // MP3 is not a forced encoding for minidisc specs that do not support it natively.
        'AT3@66kbps': 'LP4',
        'AT3@105kbps': 'LP2',
        'AT3@132kbps': 'LP2',
    };
    if (!file.forcedEncoding) return '';
    const fullCodecName = file.forcedEncoding.codec + (file.forcedEncoding?.bitrate ? `@${Math.round(file.forcedEncoding.bitrate!)}kbps` : '');
    if (file.forcedEncoding.codec === 'MP3' && selectedCodec.codec !== 'MP3') {
        return '';
    }
    return remapTable[fullCodecName] ?? fullCodecName;
}

// `files` always appends to the list
export const ConvertDialog = (props: { files: (File | AdaptiveFile)[]}) => {
    const dispatch = useDispatch();
    const { classes, cx } = useStyles();

    const { visible, format, titleFormat, titles } = useShallowEqualSelector(state => state.convertDialog);
    const { fullWidthSupport } = useShallowEqualSelector(state => state.appState);
    const { disc, deviceCapabilities } = useShallowEqualSelector(state => state.main);
    const minidiscSpec = serviceRegistry.netmdSpec!;

    const [files, setFiles] = useState<FileWithMetadata[]>([]);
    const [selectedTrackIndex, setSelectedTrack] = useState(-1);
    const [availableCharacters, setAvailableCharacters] = useState<{ halfWidth: number; fullWidth: number }>({
        fullWidth: 0,
        halfWidth: 0,
    });
    const [beforeConversionAvailableCharacters, setBeforeConversionAvailableCharacters] = useState<{
        halfWidth: number;
        fullWidth: number;
    }>({ fullWidth: 0, halfWidth: 0 });
    const [beforeConversionAvailableSeconds, setBeforeConversionAvailableSeconds] = useState(0);
    const [availableSeconds, setAvailableSeconds] = useState(0);
    const [availableSPSeconds, setAvailableSPSeconds] = useState(0);
    const [loadingMetadata, setLoadingMetadata] = useState(true);

    const fullWidthCharactersUsed = useMemo(() => {
        return (
            files
                .map(
                    e =>
                        (e.title + e.album + e.artist)
                            .split('')
                            .map(n => n.charCodeAt(0))
                            .filter(
                                n =>
                                    (n >= 0x3040 && n <= 0x309f) || // Hiragana
                                    (n >= 0x4e00 && n <= 0x9faf) || // Kanji
                                    (n >= 0x3400 && n <= 0x4dbf) // Rare kanji
                            ).length
                )
                .filter(e => e > 0).length > 0
        );
    }, [files]);

    const usesHimdTitles = useMemo(() => deviceCapabilities.includes(Capability.himdTitles), [deviceCapabilities]);
    const deviceSupportsFullWidth = useMemo(() => deviceCapabilities.includes(Capability.fullWidthSupport), [deviceCapabilities]);

    const thisSpecFormat = useMemo(() => format[minidiscSpec.specName] ?? minidiscSpec.defaultFormat, [minidiscSpec, format]);

    const loadMetadataFromFiles = useMemo(
        () => async (files: (File | AdaptiveFile)[]): Promise<FileWithMetadata[]> => {
            setLoadingMetadata(true);
            const titledFiles: FileWithMetadata[] = [];
            for (const _file of files) {
                // If the file is an adaptive file...:
                if((_file as any).getForEncoding){
                    const file = _file as AdaptiveFile;
                    titledFiles.push({
                        album: file.album,
                        artist: file.artist,
                        title: file.title,
                        duration: file.duration,

                        file: file,

                        // TODO: Should the local library allow upload of preencoded ATRAC files?
                        bytesToSkip: 0,
                        forcedEncoding: null,
                    });
                    continue;
                } else {
                    const file = _file as File;
                    const metadata = await getMetadataFromFile(file);
                    let forcedEncoding: null | 'ILLEGAL' | { format: ForcedEncodingFormat; headerLength: number } = await getATRACWAVEncoding(
                        file
                    );
                    if (file.name.toLowerCase().endsWith('.aea')) {
                        const channels = await getChannelsFromAEA(file);
                        if (channels === 1 || channels === 2) {
                            forcedEncoding = {
                                format: { codec: channels === 1 ? 'SPM' : 'SPS' },
                                headerLength: 2048,
                            };
                            metadata.duration = (((file.size - 2048) / 212) * 11.6) / 1000 / channels;
                        }
                    } else if (file.name.toLowerCase().endsWith('.mp3')) {
                        // FIXME: Check by file magic instead
                        forcedEncoding = {
                            format: { codec: 'MP3', bitrate: metadata.bitrate },
                            headerLength: 0,
                        };
                    }
                    if (forcedEncoding === null) {
                        forcedEncoding = await getATRACOMAEncoding(file);
                    }
    
                    if (forcedEncoding !== null && forcedEncoding !== 'ILLEGAL') {
                        // There's an encoding forced by either the SP upload functionality or OMA
                        let asCodec: CodecFamily;
                        if (['SPS', 'SPM'].includes(forcedEncoding.format!.codec)) asCodec = 'SP';
                        else asCodec = forcedEncoding.format!.codec as CodecFamily;
                        const isIllegalForThisFormat = () => !minidiscSpec.availableFormats.some(e => e.codec === asCodec);
                        if (isIllegalForThisFormat()) {
                            // HACK - replace LP2 / LP4 with AT3 with custom bitrate
                            if (asCodec === 'AT3') {
                                if (forcedEncoding.format!.bitrate === 66) asCodec = 'LP4';
                                else if (forcedEncoding.format!.bitrate === 132) asCodec = 'LP2';
                            }
                            // If it's still invalid, do not force an encoding
                            if (isIllegalForThisFormat()) forcedEncoding = null;
                        }
                    }
    
                    if (forcedEncoding === 'ILLEGAL') {
                        window.alert(`Cannot transfer file ${file.name}.`);
                    } else {
                        titledFiles.push({
                            file,
                            ...metadata,
                            forcedEncoding: forcedEncoding?.format ?? null,
                            bytesToSkip: forcedEncoding?.headerLength ?? 0,
                        });
                    }    
                }
            }
            setLoadingMetadata(false);
            return titledFiles;
        },
        [minidiscSpec.availableFormats]
    );

    const resetDialog = useCallback(() => {
        setSelectedTrack(-1);
        setTracksOrderVisible(false);
        setAvailableCharacters({ halfWidth: 1785, fullWidth: 1785 });
        setAvailableSeconds(1);
        setBeforeConversionAvailableCharacters({ halfWidth: 1, fullWidth: 1 });
        setBeforeConversionAvailableSeconds(1);
        dispatch(
            convertDialogActions.updateFormatForSpec({
                spec: minidiscSpec.specName,
                codec: minidiscSpec.defaultFormat,
                unlessUnset: true,
            })
        );
    }, [dispatch, minidiscSpec.defaultFormat, minidiscSpec.specName]);

    useEffect(() => {
        // Trigger a reset if needed
        const newFiles = Array.from(props.files);
        loadMetadataFromFiles(newFiles)
            .then(withMetadata => {
                setFiles(withMetadata);
            })
            .catch(console.error);
    }, [props.files, loadMetadataFromFiles, resetDialog]);


    const refreshTitledFiles = useCallback(
        (files: FileWithMetadata[], format: TitleFormatType) => {
            dispatch(
                convertDialogActions.setTitles(
                    files.map(file => {
                        let rawTitle = '';
                        switch (format) {
                            case 'title': {
                                rawTitle = file.title;
                                break;
                            }
                            case 'artist-title': {
                                rawTitle = `${file.artist} - ${file.title}`;
                                break;
                            }
                            case 'title-artist': {
                                rawTitle = `${file.title} - ${file.artist}`;
                                break;
                            }
                            case 'album-title': {
                                rawTitle = `${file.album} - ${file.title}`;
                                break;
                            }
                            case 'artist-album-title': {
                                rawTitle = `${file.artist} - ${file.album} - ${file.title}`;
                                break;
                            }
                            case 'filename': {
                                rawTitle = removeExtension(file.file.name);
                                break;
                            }
                        }
                        const halfWidth = minidiscSpec.sanitizeHalfWidthTitle(rawTitle);
                        const fullWidth = minidiscSpec.sanitizeFullWidthTitle(rawTitle);
                        const halfAsFull = minidiscSpec.sanitizeFullWidthTitle(halfWidth);
                        return {
                            title: halfWidth,
                            fullWidthTitle: fullWidthSupport && deviceSupportsFullWidth && fullWidth !== halfAsFull ? fullWidth : '', // If there are no differences between half and full width, skip the full width
                            duration: file.duration,
                            forcedEncoding: file.forcedEncoding,
                            bytesToSkip: file.bytesToSkip,
                            album: file.album,
                            artist: file.artist,
                        };
                    })
                )
            );
        },
        [fullWidthSupport, dispatch, minidiscSpec, deviceSupportsFullWidth]
    );

    const renameTrackManually = useCallback(
        (index: number) => {
            const track = titles[index];
            dispatch(
                batchActions([
                    renameDialogActions.setVisible(true),
                    renameDialogActions.setCurrentName(track.title),
                    renameDialogActions.setCurrentFullWidthName(track.fullWidthTitle),
                    renameDialogActions.setIndex(index),
                    renameDialogActions.setRenameType(
                        usesHimdTitles ? RenameType.TRACK_CONVERT_DIALOG_HIMD : RenameType.TRACK_CONVERT_DIALOG
                    ),

                    renameDialogActions.setHimdAlbum(track.album ?? ''),
                    renameDialogActions.setHimdArtist(track.artist ?? ''),
                    renameDialogActions.setHimdTitle(track.title ?? ''),
                ])
            );
        },
        [titles, dispatch, usesHimdTitles]
    );

    // Track reordering
    const moveFile = useCallback(
        (offset: number) => {
            const targetIndex = selectedTrackIndex + offset;
            if (targetIndex >= files.length || targetIndex < 0) {
                return; // This should not be allowed by the UI
            }

            const newFileArray = files.slice();

            // Swap trakcs
            const tmp = newFileArray[selectedTrackIndex];
            newFileArray[selectedTrackIndex] = newFileArray[targetIndex];
            newFileArray[targetIndex] = tmp;

            setFiles(newFileArray);
            setSelectedTrack(targetIndex);
        },
        [files, selectedTrackIndex]
    );

    const moveFileUp = useCallback(() => {
        moveFile(-1);
    }, [moveFile]);

    const moveFileDown = useCallback(() => {
        moveFile(1);
    }, [moveFile]);

    const handleClose = useCallback(() => {
        setFiles([]);
        resetDialog();
        dispatch(convertDialogActions.setVisible(false));
    }, [dispatch, resetDialog]);

    const handleChangeFormat = useCallback(
        (_ev: SyntheticEvent, newFormat: string | null) => {
            if (newFormat === null) {
                return;
            }
            const formatDeclaration = minidiscSpec.availableFormats.find(e => e.codec === newFormat)!;
            if (formatDeclaration.availableBitrates) {
                dispatch(
                    convertDialogActions.updateFormatForSpec({
                        codec: {
                            codec: formatDeclaration.codec,
                            bitrate: formatDeclaration.defaultBitrate ?? Math.max(...formatDeclaration.availableBitrates),
                        },
                        spec: minidiscSpec.specName,
                    })
                );
            } else {
                dispatch(
                    convertDialogActions.updateFormatForSpec({
                        codec: {
                            codec: formatDeclaration.codec,
                        },
                        spec: minidiscSpec.specName,
                    })
                );
            }
        },
        [dispatch, minidiscSpec.specName, minidiscSpec.availableFormats]
    );

    const handleChangeBitrate = useCallback(
        (ev: any) => {
            dispatch(
                convertDialogActions.updateFormatForSpec({
                    spec: minidiscSpec.specName,
                    codec: { codec: thisSpecFormat.codec, bitrate: ev.target.value },
                })
            );
        },
        [dispatch, thisSpecFormat, minidiscSpec.specName]
    );

    const handleChangeTitleFormat = useCallback(
        (event: any) => {
            dispatch(convertDialogActions.setTitleFormat(event.target.value));
        },
        [dispatch]
    );

    const [tracksOrderVisible, setTracksOrderVisible] = useState(false);
    const handleToggleTracksOrder = useCallback(() => {
        setTracksOrderVisible(tracksOrderVisible => !tracksOrderVisible);
    }, [setTracksOrderVisible]);

    const [enableReplayGain, setEnableReplayGain] = useState(false);

    const handleToggleReplayGain = useCallback(() => {
        setEnableReplayGain(enableReplayGain => !enableReplayGain);
    }, [setEnableReplayGain]);

    const handleToggleFullWidthSupport = useCallback(() => {
        dispatch(appActions.setFullWidthSupport(!fullWidthSupport));
    }, [dispatch, fullWidthSupport]);

    useEffect(() => {
        if (!disc) return;

        const testedDisc = JSON.parse(JSON.stringify(disc)) as Disc;
        let ungrouped = testedDisc.groups.find(n => n.title === null);
        if (!ungrouped) {
            ungrouped = {
                title: null,
                fullWidthTitle: null,
                index: -1,
                tracks: [],
            };
            testedDisc.groups.push(ungrouped);
        }
        for (const track of titles) {
            ungrouped.tracks.push({
                title: track.title,
                fullWidthTitle: track.fullWidthTitle,
                channel: 1,
                duration: 0,
                index: 0,
                encoding: { codec: 'SP' },
                protected: null as any,
            });
        }
        setAvailableCharacters(minidiscSpec.getRemainingCharactersForTitles(testedDisc));
        const totalTracksDurationInStandard = titles.reduce((total, b) => {
            if (!b.forcedEncoding || (b.forcedEncoding.codec === 'MP3' && thisSpecFormat.codec !== 'MP3')) {
                // MP3 forcedEncoding only suggests the target bitrate when the user selects 'MP3' as the recording format
                // MP3 can never be 'forced', like LP2 can f.ex.
                return total + minidiscSpec.translateToDefaultMeasuringModeFrom(thisSpecFormat, b.duration);
            }
            let duration = b.duration;
            let forcedEncodingCodec: Codec['codec'];
            if (b.forcedEncoding.codec === 'SPS') {
                forcedEncodingCodec = 'SP';
            } else if (b.forcedEncoding.codec === 'SPM') {
                duration /= 2;
                forcedEncodingCodec = 'SP';
            } else {
                forcedEncodingCodec = b.forcedEncoding.codec;
            }
            const codec: Codec = {
                bitrate: b.forcedEncoding.bitrate,
                codec: forcedEncodingCodec,
            };
            return total + minidiscSpec.translateToDefaultMeasuringModeFrom(codec, duration);
        }, 0);
        const secondsLeftInChosenFormat = minidiscSpec.translateDefaultMeasuringModeTo(thisSpecFormat, disc.left);
        setAvailableSeconds(
            secondsLeftInChosenFormat - minidiscSpec.translateDefaultMeasuringModeTo(thisSpecFormat, totalTracksDurationInStandard)
        );
        setAvailableSPSeconds(disc.left - totalTracksDurationInStandard);
        setBeforeConversionAvailableSeconds(secondsLeftInChosenFormat);
        setBeforeConversionAvailableCharacters(minidiscSpec.getRemainingCharactersForTitles(disc));
    }, [disc, setAvailableCharacters, titles, thisSpecFormat, minidiscSpec]);

    // Reload titles when files changed
    useEffect(() => {
        refreshTitledFiles(files, usesHimdTitles ? 'title' : titleFormat);
    }, [refreshTitledFiles, files, titleFormat, usesHimdTitles]);

    const handleRenameSelectedTrack = useCallback(() => {
        renameTrackManually(selectedTrackIndex);
    }, [selectedTrackIndex, renameTrackManually]);

    // scroll selected track into view
    const selectedTrackRef = useRef<any | null>(null);
    useEffect(() => {
        selectedTrackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedTrackRef, selectedTrackIndex]);

    const renderTracks = useCallback(() => {
        let currentSeconds = beforeConversionAvailableSeconds;
        let { halfWidth: currentHalfWidthTextLeft, fullWidth: currentFullWidthTextLeft } = beforeConversionAvailableCharacters;
        return titles.map((file, i) => {
            const isSelected = selectedTrackIndex === i;
            const ref = isSelected ? selectedTrackRef : null;
            currentSeconds -= file.duration;
            const { halfWidth, fullWidth } = minidiscSpec.getCharactersForTitle({
                ...file,
                channel: 0,
                encoding: { codec: 'SP' },
                index: 0,
                protected: null as any,
            });
            currentHalfWidthTextLeft -= halfWidth;
            currentFullWidthTextLeft -= fullWidth;
            return (
                <ListItem
                    key={`${i}`}
                    disableGutters={true}
                    onDoubleClick={() => renameTrackManually(i)}
                    onClick={() => setSelectedTrack(i)}
                    ref={ref}
                    button
                >
                    <ListItemIcon>
                        <Radio checked={isSelected} value={`track-${i}`} size="small" />
                    </ListItemIcon>
                    <ListItemText
                        className={
                            currentSeconds <= 0
                                ? classes.durationNotFit
                                : currentHalfWidthTextLeft < 0 || currentFullWidthTextLeft < 0
                                    ? classes.nameNotFit
                                    : undefined
                        }
                        primary={`${file.fullWidthTitle && file.fullWidthTitle + ' / '}${file.title}`}
                        secondary={
                            <span>
                                {secondsToNormal(file.duration)}
                                {file.forcedEncoding && (
                                    <Tooltip title="Forced format - this file will be uploaded as-is. Recording mode will be disregarded for it">
                                        <span className={classes.forcedEncodingLabel}>
                                            &nbsp;{createForcedEncodingText(thisSpecFormat, file)}
                                        </span>
                                    </Tooltip>
                                )}
                            </span>
                        }
                    />
                </ListItem>
            );
        });
    }, [
        titles,
        selectedTrackIndex,
        setSelectedTrack,
        selectedTrackRef,
        renameTrackManually,
        beforeConversionAvailableCharacters,
        beforeConversionAvailableSeconds,
        classes.durationNotFit,
        classes.nameNotFit,
        classes.forcedEncodingLabel,
        thisSpecFormat,
        minidiscSpec,
    ]);

    const renderHiMDTracks = useCallback(() => {
        let currentSeconds = beforeConversionAvailableSeconds;
        let { halfWidth: currentHalfWidthTextLeft, fullWidth: currentFullWidthTextLeft } = beforeConversionAvailableCharacters;
        return titles.map((file, i) => {
            const isSelected = selectedTrackIndex === i;
            const ref = isSelected ? selectedTrackRef : null;
            currentSeconds -= file.duration;
            const { halfWidth, fullWidth } = minidiscSpec.getCharactersForTitle(file as any);
            currentHalfWidthTextLeft -= halfWidth;
            currentFullWidthTextLeft -= fullWidth;
            return (
                <TableRow
                    key={`${i}`}
                    onDoubleClick={() => renameTrackManually(i)}
                    onClick={() => setSelectedTrack(i)}
                    ref={ref}
                    className={
                        currentSeconds <= 0
                            ? classes.durationNotFit
                            : currentHalfWidthTextLeft < 0 || currentFullWidthTextLeft < 0
                                ? classes.nameNotFit
                                : undefined
                    }
                >
                    <TableCell className={classes.selectCheckboxTableCell}>
                        <Radio checked={isSelected} value={`track-${i}`} size="small" />
                    </TableCell>
                    <TableCell>{file.title}</TableCell>
                    <TableCell>{file.album}</TableCell>
                    <TableCell>{file.artist}</TableCell>
                    <TableCell>
                        {secondsToNormal(file.duration)}
                        {file.forcedEncoding && (
                            <Tooltip title="Forced format - this file will be uploaded as-is. Recording mode will be disregarded for it">
                                <span className={classes.forcedEncodingLabel}>&nbsp;{createForcedEncodingText(thisSpecFormat, file)}</span>
                            </Tooltip>
                        )}
                    </TableCell>
                </TableRow>
            );
        });
    }, [
        titles,
        selectedTrackIndex,
        setSelectedTrack,
        selectedTrackRef,
        renameTrackManually,
        beforeConversionAvailableCharacters,
        beforeConversionAvailableSeconds,
        classes.durationNotFit,
        classes.nameNotFit,
        classes.selectCheckboxTableCell,
        classes.forcedEncodingLabel,
        minidiscSpec,
        thisSpecFormat,
    ]);

    // Add/Remove tracks
    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            const bannedTypes = ['audio/mpegurl', 'audio/x-mpegurl'];
            const accepted = acceptedFiles.filter(n => !bannedTypes.includes(n.type));
            if (accepted.length > 0) {
                loadMetadataFromFiles(accepted)
                    .then(acceptedTitledFiles => {
                        setFiles(files => files.slice().concat(acceptedTitledFiles));
                    })
                    .catch(console.error);
            }
        },
        [setFiles, loadMetadataFromFiles]
    );
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: acceptedTypes,
        noClick: true,
    });
    const handleOpenLocalLibrary = useCallback(() => dispatch(openLocalLibrary()), [dispatch]);
    const disableRemove = selectedTrackIndex < 0 || selectedTrackIndex >= files.length;
    const handleRemoveSelectedTrack = useCallback(() => {
        const newFileArray = files.filter((f, i) => i !== selectedTrackIndex);
        setFiles(newFileArray);
        if (selectedTrackIndex >= newFileArray.length) {
            setSelectedTrack(newFileArray.length - 1);
        }
        if(newFileArray.length === 0) handleClose();
    }, [selectedTrackIndex, files, setFiles, handleClose]);

    const dialogVisible = useShallowEqualSelector(state => state.convertDialog.visible);

    const handleConvert = useCallback(() => {
        handleClose();
        setEnableReplayGain(false);
        dispatch(
            convertAndUpload(
                titles.map((n, i) => ({
                    ...n,
                    file: files[i].file,
                    artist: n.artist ?? '',
                    album: n.album ?? '',
                    // Exception: If an MP3 file was selected, do not 'force' upload it - treat it merely as a suggestion for the bitrate
                    forcedEncoding: n.forcedEncoding?.codec === 'MP3' && thisSpecFormat.codec !== 'MP3' ? null : n.forcedEncoding,
                })),
                thisSpecFormat,
                {
                    enableReplayGain,
                }
            )
        );
    }, [dispatch, handleClose, titles, thisSpecFormat, files, enableReplayGain]);

    const isSelectedMediocre = serviceRegistry.audioExportService!.getSupport(thisSpecFormat.codec) === 'mediocre';
    const isSelectedUnsupported = serviceRegistry.audioExportService!.getSupport(thisSpecFormat.codec) === 'unsupported';
    const formatsSupport = minidiscSpec.availableFormats.map(e => serviceRegistry.audioExportService!.getSupport(e.codec));

    const vintageMode = useShallowEqualSelector(state => state.appState.vintageMode);
    if (vintageMode) {
        const p = {
            visible,
            format: thisSpecFormat,
            titleFormat,

            titles,
            selectedTrackIndex,
            setSelectedTrack,

            availableCharacters,
            availableSeconds,
            loadingMetadata,

            renameTrackManually,

            moveFileUp,
            moveFileDown,

            handleClose,
            handleChangeFormat,
            handleChangeTitleFormat,
            handleConvert,

            tracksOrderVisible,
            setTracksOrderVisible,
            handleToggleTracksOrder,
            selectedTrackRef,

            getRootProps,
            getInputProps,
            isDragActive,
            open,

            disableRemove,
            handleRemoveSelectedTrack,
            handleRenameSelectedTrack,
            dialogVisible,
        };
        return <W95ConvertDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'xs'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="convert-dialog-slide-title"
            aria-describedby="convert-dialog-slide-description"
            classes={{ paper: cx({ [classes.himdDialog]: usesHimdTitles }) }}
        >
            <DialogTitle id="convert-dialog-slide-title">Upload Settings</DialogTitle>
            <DialogContent className={classes.dialogContent}>
                <div className={classes.formatAndTitle}>
                    <FormControl>
                        <Typography component="label" variant="caption" color="textSecondary">
                            Recording Mode
                        </Typography>
                        <ToggleButtonGroup value={thisSpecFormat.codec} exclusive onChange={handleChangeFormat} size="small">
                            {minidiscSpec.availableFormats.map((e, idx) => (
                                <ToggleButton
                                    disabled={formatsSupport[idx] === 'unsupported'}
                                    classes={{
                                        root: cx(classes.toggleButton, {
                                            [classes.toggleButtonWarning]: formatsSupport[idx] === 'mediocre',
                                        }),
                                    }}
                                    key={`k-uploadformat-${e.codec}`}
                                    value={e.codec}
                                >
                                    {e.codec}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </FormControl>

                    <div className={classes.rightBlock}>
                        {!usesHimdTitles && (
                            <FormControl className={classes.formControl}>
                                <Typography component="label" variant="caption" color="textSecondary">
                                    Track title
                                </Typography>
                                <FormControl className={classes.titleFormControl}>
                                    <Select value={titleFormat} color="secondary" input={<Input />} onChange={handleChangeTitleFormat}>
                                        <MenuItem value={`filename`}>Filename</MenuItem>
                                        <MenuItem value={`title`}>Title</MenuItem>
                                        <MenuItem value={`album-title`}>Album - Title</MenuItem>
                                        <MenuItem value={`artist-title`}>Artist - Title</MenuItem>
                                        <MenuItem value={`title-artist`}>Title - Artist</MenuItem>
                                        <MenuItem value={`artist-album-title`}>Artist - Album - Title</MenuItem>
                                    </Select>
                                </FormControl>
                            </FormControl>
                        )}
                        {thisSpecFormat.bitrate !== undefined && (
                            <FormControl className={classes.formControl}>
                                <Typography component="label" variant="caption" color="textSecondary">
                                    Bitrate
                                </Typography>
                                <FormControl className={classes.titleFormControl}>
                                    <Select
                                        value={thisSpecFormat.bitrate}
                                        color="secondary"
                                        input={<Input />}
                                        onChange={handleChangeBitrate}
                                    >
                                        {minidiscSpec.availableFormats
                                            .find(e => e.codec === format[minidiscSpec.specName].codec)!
                                            .availableBitrates!.map(e => (
                                                <MenuItem value={e} key={`bitratesel-${e}`}>
                                                    {e} Kbps
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </FormControl>
                        )}
                    </div>
                </div>
                <div></div>
                <Typography
                    component="h3"
                    className={classes.nameNotFit}
                    hidden={availableCharacters.halfWidth > 0 && availableCharacters.fullWidth > 0}
                    style={{ marginTop: '1em' }}
                    align="center"
                >
                    Warning: You have used up all the available{' '}
                    {[availableCharacters.halfWidth > 0 ? 'half' : null, availableCharacters.fullWidth > 0 ? 'full' : null]
                        .filter(n => n !== null)
                        .join(' and ')}{' '}
                    width characters. Some titles might get cut off.
                </Typography>
                <Typography
                    component="h3"
                    className={classes.durationNotFit}
                    hidden={availableSeconds >= 0}
                    style={{ marginTop: '1em' }}
                    align="center"
                >
                    Warning: You have used up all the available space on the disc.
                </Typography>
                <Typography
                    component="h3"
                    className={classes.warningMediocreEncoder}
                    hidden={!isSelectedMediocre}
                    style={{ marginTop: '1em' }}
                    align="center"
                >
                    Warning: You are using a mediocre encoder. The resulting audio is not going to be perfect. Alternative encoders are available in the settings.
                </Typography>
                <span className={classes.durationsSpan}>
                    <Typography component="h3" align="center" hidden={loadingMetadata}>
                        Total:{' '}
                        <TooltipOrDefault
                            tooltipEnabled={minidiscSpec.availableFormats.length > 1}
                            title={
                                LeftInNondefaultCodecs((disc?.left ?? 0) - availableSPSeconds)
                            }
                            arrow
                        >
                            <span className={cx({ [classes.timeTooltip]: minidiscSpec.availableFormats.length > 1 })}>
                                {secondsToNormal((disc?.left ?? 0) - availableSPSeconds)} {minidiscSpec.defaultFormat.codec} time{' '}
                            </span>
                        </TooltipOrDefault>
                    </Typography>
                    <Typography
                        component="h3"
                        align="center"
                        hidden={loadingMetadata}
                        className={cx({ [classes.durationNotFit]: availableSPSeconds <= 0 })}
                    >
                        Remaining:{' '}
                        <TooltipOrDefault
                            tooltipEnabled={minidiscSpec.availableFormats.length > 1}
                            title={
                                <React.Fragment>
                                    {minidiscSpec.availableFormats.map(e =>
                                        e.codec === minidiscSpec.defaultFormat.codec ? null : (
                                            <React.Fragment key={`totalrem-${e.codec}`}>
                                                <span>{`${secondsToNormal(
                                                    minidiscSpec.translateDefaultMeasuringModeTo(
                                                        {
                                                            codec: e.codec,
                                                            bitrate: e.availableBitrates
                                                                ? e.defaultBitrate ?? Math.max(...e.availableBitrates)
                                                                : undefined,
                                                        },
                                                        availableSPSeconds
                                                    )
                                                )} in ${e.codec} Mode`}</span>
                                                <br />
                                            </React.Fragment>
                                        )
                                    )}
                                </React.Fragment>
                            }
                            arrow
                        >
                            <span className={cx({ [classes.timeTooltip]: minidiscSpec.availableFormats.length > 1 })}>
                                {secondsToNormal(availableSPSeconds)} {minidiscSpec.defaultFormat.codec} time
                            </span>
                        </TooltipOrDefault>
                    </Typography>
                </span>
                {!fullWidthSupport && deviceSupportsFullWidth && fullWidthCharactersUsed ? (
                    <Typography color="error" component="p">
                        You seem to be trying to enter full-width text into the half-width slot.{' '}
                        <Link onClick={handleToggleFullWidthSupport} color="error" underline="always" style={{ cursor: 'pointer' }}>
                            Enable full-width title support
                        </Link>
                        ?
                    </Typography>
                ) : null}

                <Typography component="h3" color="error" hidden={!loadingMetadata} style={{ marginTop: '1em' }} align="center">
                    Reading Metadata...
                </Typography>
                <Accordion expanded={tracksOrderVisible} className={classes.tracksOrderAccordion} square={true}>
                    <div></div>
                    <div {...getRootProps()} style={{ outline: 'none' }}>
                        <Toolbar variant="dense" className={classes.toolbarHighlight}>
                            {serviceRegistry.libraryService && (
                                <IconButton className={classes.iconButton} edge="start" aria-label="add track from local library" onClick={handleOpenLocalLibrary}>
                                    <CloudDownload />
                                </IconButton>
                            )}
                            <IconButton className={classes.iconButton} edge="start" aria-label="add track" onClick={open}>
                                <AddIcon />
                            </IconButton>
                            <IconButton className={classes.iconButton} edge="start" aria-label="remove track" onClick={handleRemoveSelectedTrack} disabled={disableRemove}>
                                <RemoveIcon />
                            </IconButton>
                            <IconButton className={classes.iconButton} edge="start" aria-label="rename track" onClick={handleRenameSelectedTrack} disabled={disableRemove}>
                                <EditIcon />
                            </IconButton>
                            <div className={classes.spacer}></div>
                            <IconButton edge="end" aria-label="move up" onClick={moveFileDown}>
                                <ExpandMoreIcon />
                            </IconButton>
                            <IconButton edge="end" aria-label="move down" onClick={moveFileUp}>
                                <ExpandLessIcon />
                            </IconButton>
                        </Toolbar>
                        {!usesHimdTitles ? (
                            <AccordionDetails className={classes.tracksOrderAccordionDetail}>
                                <List dense={true} disablePadding={false} className={classes.trackList}>
                                    {renderTracks()}
                                </List>
                            </AccordionDetails>
                        ) : (
                            <Table size="small" className={classes.fixedTable}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell className={classes.selectCheckboxTableCell}></TableCell>
                                        <TableCell>Title</TableCell>
                                        <TableCell>Album</TableCell>
                                        <TableCell>Artist</TableCell>
                                        <TableCell>Duration</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>{renderHiMDTracks()}</TableBody>
                            </Table>
                        )}
                        <Backdrop className={classes.backdrop} open={isDragActive}>
                            Drop your Music to add it to the queue
                        </Backdrop>
                        <input {...getInputProps()} />
                    </div>
                </Accordion>
                <Accordion className={classes.advancedOptionsAccordion} square={true}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.advancedOptionsAccordionSummary}>
                        Advanced Options
                    </AccordionSummary>
                    <AccordionDetails className={classes.advancedOptionsAccordionContents}>
                        {deviceSupportsFullWidth && (
                            <FormControlLabel
                                label={`Enable full width titles support`}
                                className={classes.advancedOption}
                                control={<Checkbox checked={fullWidthSupport} onChange={handleToggleFullWidthSupport} />}
                            />
                        )}

                        <FormControlLabel
                            label={`Use ReplayGain`}
                            className={classes.advancedOption}
                            control={<Checkbox checked={enableReplayGain} onChange={handleToggleReplayGain} />}
                        />
                    </AccordionDetails>
                </Accordion>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleToggleTracksOrder} disabled={loadingMetadata} className={classes.showTracksOrderBtn}>
                    {`${tracksOrderVisible ? 'Hide' : 'Show'} Tracks`}
                </Button>
                <div className={classes.spacer}></div>
                <Button onClick={handleClose} disabled={loadingMetadata}>
                    Cancel
                </Button>
                <Button onClick={handleConvert} disabled={loadingMetadata || availableSeconds < 0 || isSelectedUnsupported}>
                    Ok
                </Button>
            </DialogActions>
        </Dialog>
    );
};
