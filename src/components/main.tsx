import React, { useEffect, useCallback, useState } from 'react';
import { useDeviceCapabilities, useDispatch } from '../frontend-utils';
import { FileRejection, useDropzone } from 'react-dropzone';
import {
    DragDropContext,
    Draggable,
    DraggableProvided,
    DropResult,
    ResponderProvided,
    Droppable,
    DroppableProvided,
    DroppableStateSnapshot,
} from 'react-beautiful-dnd';
import { listContent, deleteTracks, moveTrack, groupTracks, deleteGroups, dragDropTrack, ejectDisc, flushDevice } from '../redux/actions';
import { actions as renameDialogActions, RenameType } from '../redux/rename-dialog-feature';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import { actions as dumpDialogActions } from '../redux/dump-dialog-feature';
import { actions as appStateActions } from '../redux/app-feature';
import { actions as contextMenuActions } from '../redux/context-menu-feature';

import { DeviceStatus } from 'netmd-js';
import { control, openLocalLibrary } from '../redux/actions';

import { formatTimeFromSeconds, getGroupedTracks, getSortedTracks, isSequential, acceptedTypes, AdaptiveFile } from '../utils';
import { belowDesktop, forAnyDesktop, useShallowEqualSelector, themeSpacing, batchActions } from '../frontend-utils';

import { makeStyles } from 'tss-react/mui';
import { alpha, lighten } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Backdrop from '@mui/material/Backdrop';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import EjectIcon from '@mui/icons-material/Eject';
import DoneIcon from '@mui/icons-material/Done';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LinearProgress from '@mui/material/LinearProgress';

import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';

import { GroupRow, LeftInNondefaultCodecs, MockTrackRow, TrackRow } from './main-rows';
import { RenameDialog } from './rename-dialog';
import { UploadDialog } from './upload-dialog';
import { RecordDialog } from './record-dialog';
import { ErrorDialog } from './error-dialog';
import { PanicDialog } from './panic-dialog';
import { ConvertDialog } from './convert-dialog';
import { AboutDialog } from './about-dialog';
import { DumpDialog } from './dump-dialog';
import { TopMenu } from './topmenu';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import { W95Main } from './win95/main';
import { useMemo } from 'react';
import { ChangelogDialog } from './changelog-dialog';
import { Track } from '../services/interfaces/netmd';
import { FactoryModeNoticeDialog } from './factory/factory-notice-dialog';
import { FactoryModeProgressDialog } from './factory/factory-progress-dialog';
import { SongRecognitionDialog } from './song-recognition-dialog';
import { SongRecognitionProgressDialog } from './song-recognition-progress-dialog';
import { SettingsDialog } from './settings-dialog';
import { FactoryModeBadSectorDialog } from './factory/factory-bad-sector-dialog';
import { DiscProtectedDialog } from './disc-protected-dialog';
import { ContextMenu } from './context-menu';
import { LocalLibraryDialog } from './local-library';
import { Menu, MenuItem } from '@mui/material';
import serviceRegistry from '../services/registry';

// TODO jss-to-tss-react codemod: Unable to handle style definition reliably. Unsupported arrow function syntax.
//Unexpected value type of ConditionalExpression.
const useStyles = makeStyles()((theme) => ({
    add: {
        position: 'absolute',
        bottom: theme.spacing(3),
        right: theme.spacing(3),
        [belowDesktop(theme)]: {
            bottom: theme.spacing(2),
        },
    },
    main: {
        overflowY: 'auto',
        flex: '1 1 auto',
        marginBottom: theme.spacing(3),
        outline: 'none',
        marginLeft: theme.spacing(-1),
        marginRight: theme.spacing(-1),
        [forAnyDesktop(theme)]: {
            marginLeft: theme.spacing(-2),
            marginRight: theme.spacing(-2),
        },
    },
    toolbar: {
        marginTop: theme.spacing(2),
        marginLeft: theme.spacing(-2),
        marginRight: theme.spacing(-2),
        [theme.breakpoints.up(600 + themeSpacing(theme, 2) * 2)]: {
            marginLeft: theme.spacing(-3),
            marginRight: theme.spacing(-3),
        },
    },
    toolbarLabel: {
        flex: '1 1 100%',
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
    headBox: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    spacing: {
        marginTop: theme.spacing(1),
    },
    indexCell: {
        whiteSpace: 'nowrap',
        paddingRight: 0,
        width: theme.spacing(4),
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    remainingTimeTooltip: {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
    },
    hoveringOverGroup: {
        backgroundColor: `${alpha(theme.palette.secondary.dark, 0.4)}`,
    },
    dragHandleEmpty: {
        width: 20,
        padding: `${theme.spacing(0.5)} 0 0 0`,
    },
    fixedTable: {
        tableLayout: 'fixed',
    },
    topbarButton: {
        marginRight: theme.spacing(0.5),
    },
    topbarLargeButton: {
        marginRight: theme.spacing(0.5),
        minWidth: 'min-content',
    },
}));

function getTrackStatus(track: Track, deviceStatus: DeviceStatus | null): 'playing' | 'paused' | 'none' {
    if (!deviceStatus || track.index !== deviceStatus.track) {
        return 'none';
    }

    if (deviceStatus.state === 'playing') {
        return 'playing';
    } else if (deviceStatus.state === 'paused') {
        return 'paused';
    } else {
        return 'none';
    }
}

export const Main = (props: {}) => {
    const dispatch = useDispatch();
    const disc = useShallowEqualSelector((state) => state.main.disc);
    const flushable = useShallowEqualSelector((state) => state.main.flushable);
    const deviceName = useShallowEqualSelector((state) => state.main.deviceName);
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const factoryModeRippingInMainUi = useShallowEqualSelector((state) => state.appState.factoryModeRippingInMainUi);
    const { vintageMode } = useShallowEqualSelector((state) => state.appState);

    const [selected, setSelected] = React.useState<number[]>([]);
    const [selectedGroups, setSelectedGroups] = React.useState<number[]>([]);
    const [uploadedFiles, setUploadedFiles] = React.useState<(File | AdaptiveFile)[]>([]);
    const [lastClicked, setLastClicked] = useState(-1);
    const [moveMenuAnchorEl, setMoveMenuAnchorEl] = React.useState<null | HTMLElement>(null);

    const deviceCapabilities = useDeviceCapabilities();

    const handleShowMoveMenu = useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            setMoveMenuAnchorEl(event.currentTarget);
        },
        [setMoveMenuAnchorEl]
    );
    const handleCloseMoveMenu = useCallback(() => {
        setMoveMenuAnchorEl(null);
    }, [setMoveMenuAnchorEl]);

    const handleMoveSelectedTrack = useCallback(
        (destIndex: number) => {
            dispatch(moveTrack(selected[0], destIndex));
            handleCloseMoveMenu();
        },
        [dispatch, selected, handleCloseMoveMenu]
    );

    const handleDrop = useCallback(
        (result: DropResult, provided: ResponderProvided) => {
            if (!result.destination) return;
            const sourceList = parseInt(result.source.droppableId),
                sourceIndex = result.source.index,
                targetList = parseInt(result.destination.droppableId),
                targetIndex = result.destination.index;
            dispatch(dragDropTrack(sourceList, sourceIndex, targetList, targetIndex));
        },
        [dispatch]
    );

    const handleShowDumpDialog = useCallback(() => {
        dispatch(dumpDialogActions.setVisible(true));
    }, [dispatch]);

    useEffect(() => {
        dispatch(listContent());
    }, [dispatch]);

    useEffect(() => {
        setSelected([]); // Reset selection if disc changes
        setSelectedGroups([]);
    }, [disc]);

    const [wasLastDiscNull, setWasLastDiscNull] = useState<boolean>(false);
    const discProtectedDialogDisabled = useShallowEqualSelector((state) => state.appState.discProtectedDialogDisabled);
    useEffect(() => {
        if (disc === null && !wasLastDiscNull) {
            setWasLastDiscNull(true);
            dispatch(appStateActions.showDiscProtectedDialog(false));
        } else if (disc !== null && wasLastDiscNull && disc.writeProtected && disc.writable) {
            setWasLastDiscNull(false);
            if (!discProtectedDialogDisabled) {
                dispatch(appStateActions.showDiscProtectedDialog(true));
            }
        }
    }, [dispatch, disc, wasLastDiscNull, discProtectedDialogDisabled, setWasLastDiscNull]);

    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
            const bannedTypes = ['audio/mpegurl', 'audio/x-mpegurl'];
            const accepted = acceptedFiles.filter((n) => !bannedTypes.includes(n.type));
            if (accepted.length > 0) {
                setUploadedFiles(accepted);
                dispatch(convertDialogActions.setVisible(true));
            }
        },
        [dispatch]
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: acceptedTypes,
        noClick: true,
    });

    const { classes, cx } = useStyles();
    const tracks = useMemo(() => getSortedTracks(disc), [disc]);
    const groupedTracks = useMemo(() => getGroupedTracks(disc), [disc]);

    // Action Handlers
    const handleSelectTrackClick = useCallback(
        (event: React.MouseEvent, item: number) => {
            setSelectedGroups([]);
            if (event.shiftKey && selected.length && lastClicked !== -1) {
                const rangeBegin = Math.min(lastClicked + 1, item),
                    rangeEnd = Math.max(lastClicked - 1, item);
                const copy = [...selected];
                for (let i = rangeBegin; i <= rangeEnd; i++) {
                    const index = copy.indexOf(i);
                    if (index === -1) copy.push(i);
                    else copy.splice(index, 1);
                }
                if (!copy.includes(item)) copy.push(item);
                setSelected(copy);
            } else if (selected.includes(item)) {
                setSelected(selected.filter((i) => i !== item));
            } else {
                setSelected([...selected, item]);
            }
            setLastClicked(item);
        },
        [selected, setSelected, lastClicked, setLastClicked]
    );

    const handleOpenContextMenu = useCallback(
        (event: React.MouseEvent, track: Track) => {
            if (!track) return;
            event.preventDefault();
            dispatch(contextMenuActions.openContextMenu({ position: { x: event.clientX, y: event.clientY }, track: track }));
        },
        [dispatch]
    );

    const handleSelectGroupClick = useCallback(
        (event: React.MouseEvent, item: number) => {
            setSelected([]);
            if (selectedGroups.includes(item)) {
                setSelectedGroups(selectedGroups.filter((i) => i !== item));
            } else {
                setSelectedGroups([...selectedGroups, item]);
            }
        },
        [selectedGroups, setSelected, setSelectedGroups]
    );

    const handleSelectAllClick = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setSelectedGroups([]);
            if (selected.length < tracks.length) {
                setSelected(tracks.map((t) => t.index));
            } else {
                setSelected([]);
            }
        },
        [selected, tracks, setSelected, setSelectedGroups]
    );

    const handleRenameTrack = useCallback(
        (event: React.MouseEvent, index: number) => {
            const track = tracks.find((t) => t.index === index);
            if (!track) {
                return;
            }

            dispatch(
                batchActions([
                    renameDialogActions.setVisible(true),
                    renameDialogActions.setHimdTitle(track.title),
                    renameDialogActions.setHimdAlbum(track.album ?? ''),
                    renameDialogActions.setHimdArtist(track.artist ?? ''),
                    renameDialogActions.setCurrentName(track.title),
                    renameDialogActions.setCurrentFullWidthName(track.fullWidthTitle),
                    renameDialogActions.setIndex(track.index),
                    renameDialogActions.setRenameType(
                        track.album !== undefined || track.album !== undefined ? RenameType.HIMD : RenameType.TRACK
                    ),
                ])
            );
        },
        [dispatch, tracks]
    );

    const handleRenameGroup = useCallback(
        (event: React.MouseEvent, index: number) => {
            const group = groupedTracks.find((g) => g.index === index);
            if (!group) {
                return;
            }

            dispatch(
                batchActions([
                    renameDialogActions.setVisible(true),
                    renameDialogActions.setIndex(index),
                    renameDialogActions.setCurrentName(group.title ?? ''),
                    renameDialogActions.setCurrentFullWidthName(group.fullWidthTitle ?? ''),
                    renameDialogActions.setRenameType(RenameType.GROUP),
                ])
            );
        },
        [dispatch, groupedTracks]
    );

    const handleRenameActionClick = useCallback(
        (event: React.MouseEvent) => {
            if (event.detail !== 1) return; //Event retriggering when hitting enter in the dialog
            handleRenameTrack(event, selected[0]);
        },
        [handleRenameTrack, selected]
    );

    const handleDeleteSelected = useCallback(
        (event: React.MouseEvent) => {
            dispatch(deleteTracks(selected));
        },
        [dispatch, selected]
    );

    const handleDeleteTrack = useCallback(
        (event: React.MouseEvent, index: number) => {
            dispatch(deleteTracks([index]));
        },
        [dispatch]
    );

    const handleGroupTracks = useCallback(
        (event: React.MouseEvent) => {
            dispatch(groupTracks(selected));
        },
        [dispatch, selected]
    );

    const handleDeleteGroup = useCallback(
        (event: React.MouseEvent, index: number) => {
            event.stopPropagation();
            dispatch(deleteGroups([index]));
        },
        [dispatch]
    );

    const handleDeleteSelectedGroups = useCallback(
        (event: React.MouseEvent) => {
            dispatch(deleteGroups(selectedGroups));
            setSelectedGroups([]);
        },
        [dispatch, selectedGroups, setSelectedGroups]
    );

    const handleEject = useCallback(
        (event: React.MouseEvent) => {
            dispatch(ejectDisc());
        },
        [dispatch]
    );

    const handleFlush = useCallback(
        (event: React.MouseEvent) => {
            dispatch(flushDevice());
        },
        [dispatch]
    );

    const handleRenameDisc = useCallback(
        (event: React.MouseEvent) => {
            if (!deviceCapabilities.metadataEdit) return;
            dispatch(
                batchActions([
                    renameDialogActions.setVisible(true),
                    renameDialogActions.setCurrentName(disc!.title),
                    renameDialogActions.setCurrentFullWidthName(disc!.fullWidthTitle),
                    renameDialogActions.setIndex(-1),
                    renameDialogActions.setRenameType(RenameType.DISC),
                ])
            );
        },
        [deviceCapabilities.metadataEdit, dispatch, disc]
    );

    const handleTogglePlayPauseTrack = useCallback(
        (event: React.MouseEvent, track: number) => {
            if (!deviceStatus) {
                return;
            }
            if (deviceStatus.track !== track) {
                dispatch(control('goto', track));
                dispatch(control('play'));
            } else if (deviceStatus.state === 'playing') {
                dispatch(control('pause'));
            } else {
                dispatch(control('play'));
            }
        },
        [dispatch, deviceStatus]
    );

    const canGroup = useMemo(() => {
        return (
            tracks.filter((n) => n.group === null && selected.includes(n.index)).length === selected.length &&
            isSequential(selected.sort((a, b) => a - b))
        );
    }, [tracks, selected]);

    const selectedCount = selected.length;
    const selectedGroupsCount = selectedGroups.length;

    const [uploadMenuAnchorEl, setUploadMenuAnchorEl] = React.useState<null | HTMLElement>(null);

    const openUploadMenu = useCallback(
        (ev: any) => {
            if (serviceRegistry.libraryService) {
                setUploadMenuAnchorEl(ev.currentTarget);
            } else {
                open();
            }
        },
        [open, setUploadMenuAnchorEl]
    );

    const handleOpenLocalLibrary = useCallback(() => {
        setUploadedFiles([]);
        setUploadMenuAnchorEl(null);
        dispatch(openLocalLibrary());
    }, [dispatch]);

    if (vintageMode) {
        const p = {
            disc,
            deviceName,

            factoryModeRippingInMainUi,

            selected,
            setSelected,
            selectedCount,

            tracks,
            uploadedFiles,
            setUploadedFiles,

            onDrop,
            getRootProps,
            getInputProps,
            isDragActive,
            open,

            moveMenuAnchorEl,
            setMoveMenuAnchorEl,

            handleShowMoveMenu,
            handleCloseMoveMenu,
            handleMoveSelectedTrack,
            handleShowDumpDialog,
            handleDeleteSelected,
            handleRenameActionClick,
            handleRenameTrack,
            handleSelectAllClick,
            handleSelectTrackClick,
        };
        return <W95Main {...p} />;
    }

    return (
        <React.Fragment>
            <Box className={classes.headBox}>
                <Typography component="h1" variant="h4">
                    {deviceName || `Loading...`}
                </Typography>
                <span>
                    {deviceCapabilities.discEject && (
                        <IconButton
                            aria-label="actions"
                            aria-controls="actions-menu"
                            aria-haspopup="true"
                            onClick={handleEject}
                            disabled={!disc}
                        >
                            <EjectIcon />
                        </IconButton>
                    )}

                    {flushable && (
                        <Tooltip title="Commit changes">
                            <IconButton aria-label="actions" aria-controls="actions-menu" aria-haspopup="true" onClick={handleFlush}>
                                <DoneIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    <TopMenu tracksSelected={selected} />
                </span>
            </Box>
            <Typography component="h2" variant="body2">
                {disc !== null ? (
                    <React.Fragment>
                        <span>{`${formatTimeFromSeconds(disc.left)} left of ${formatTimeFromSeconds(disc.total)} `}</span>
                        <Tooltip title={LeftInNondefaultCodecs(disc.left)} arrow>
                            <span className={classes.remainingTimeTooltip}>SP Mode</span>
                        </Tooltip>
                        <div className={classes.spacing} />
                        <LinearProgress
                            variant="determinate"
                            color={((disc.total - disc.left) * 100) / disc.total >= 90 ? 'secondary' : 'primary'}
                            value={((disc.total - disc.left) * 100) / disc.total}
                        />
                    </React.Fragment>
                ) : (
                    `No disc loaded`
                )}
            </Typography>
            <Toolbar
                className={cx(classes.toolbar, {
                    [classes.toolbarHighlight]: selectedCount > 0 || selectedGroupsCount > 0,
                })}
            >
                {selectedCount > 0 || selectedGroupsCount > 0 ? (
                    <Checkbox
                        indeterminate={selectedCount > 0 && selectedCount < tracks.length}
                        checked={selectedCount > 0}
                        disabled={selectedGroupsCount > 0}
                        color="secondary"
                        onChange={handleSelectAllClick}
                        inputProps={{ 'aria-label': 'select all tracks' }}
                    />
                ) : null}
                {selectedCount > 0 || selectedGroupsCount > 0 ? (
                    <Typography className={classes.toolbarLabel} color="inherit" variant="subtitle1">
                        {selectedCount || selectedGroupsCount} selected
                    </Typography>
                ) : (
                    <Typography onDoubleClick={handleRenameDisc} component="h3" variant="h6" className={classes.toolbarLabel}>
                        {disc?.fullWidthTitle && `${disc.fullWidthTitle} / `}
                        {disc ? disc?.title || `Untitled Disc` : ''}
                    </Typography>
                )}
                {selectedCount > 0 ? (
                    <React.Fragment>
                        <Tooltip title={`${deviceCapabilities.trackDownload ? 'Download' : 'Record'} from MD`}>
                            <Button
                                className={classes.topbarLargeButton}
                                color="inherit"
                                aria-label={deviceCapabilities.trackDownload || factoryModeRippingInMainUi ? 'Download' : 'Record'}
                                onClick={handleShowDumpDialog}
                            >
                                {deviceCapabilities.trackDownload || factoryModeRippingInMainUi ? 'Download' : 'Record'}
                            </Button>
                        </Tooltip>
                    </React.Fragment>
                ) : null}

                {selectedCount > 0 ? (
                    <Tooltip title="Delete">
                        <span>
                            <IconButton
                                className={classes.topbarButton}
                                aria-label="delete"
                                disabled={!deviceCapabilities.metadataEdit}
                                onClick={handleDeleteSelected}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}

                {selectedCount > 0 ? (
                    <Tooltip title={canGroup ? 'Group' : ''}>
                        <span>
                            <IconButton
                                className={classes.topbarButton}
                                aria-label="group"
                                disabled={!canGroup || !deviceCapabilities.metadataEdit}
                                onClick={handleGroupTracks}
                            >
                                <CreateNewFolderIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}

                {selectedCount > 0 ? (
                    <Tooltip title="Rename">
                        <span>
                            <IconButton
                                className={classes.topbarButton}
                                aria-label="rename"
                                disabled={selectedCount !== 1 || !deviceCapabilities.metadataEdit}
                                onClick={handleRenameActionClick}
                            >
                                <EditIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}

                {selectedGroupsCount > 0 ? (
                    <Tooltip title="Ungroup">
                        <span>
                            <IconButton
                                className={classes.topbarButton}
                                aria-label="ungroup"
                                disabled={!deviceCapabilities.metadataEdit}
                                onClick={handleDeleteSelectedGroups}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}

                {selectedGroupsCount > 0 ? (
                    <Tooltip title="Rename Group">
                        <span>
                            <IconButton
                                className={classes.topbarButton}
                                aria-label="rename group"
                                disabled={!deviceCapabilities.metadataEdit || selectedGroupsCount !== 1}
                                onClick={(e) => handleRenameGroup(e, selectedGroups[0])}
                            >
                                <EditIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                ) : null}
            </Toolbar>
            {deviceCapabilities.contentList ? (
                <Box className={classes.main} {...getRootProps()} id="main">
                    <input {...getInputProps()} />
                    <Table size="small" className={classes.fixedTable}>
                        <TableHead>
                            <TableRow>
                                <TableCell className={classes.dragHandleEmpty}></TableCell>
                                <TableCell className={classes.indexCell}>#</TableCell>
                                <TableCell>Title</TableCell>
                                {deviceCapabilities.himdTitles && (
                                    <>
                                        <TableCell>Album</TableCell>
                                        <TableCell>Artist</TableCell>
                                    </>
                                )}
                                <TableCell align="right">Duration</TableCell>
                            </TableRow>
                        </TableHead>
                        <DragDropContext onDragEnd={handleDrop}>
                            <TableBody>
                                {groupedTracks.map((group, index) => (
                                    <TableRow key={`${index}`}>
                                        <TableCell colSpan={4 + (deviceCapabilities.himdTitles ? 2 : 0)} style={{ padding: '0' }}>
                                            <Table size="small" className={classes.fixedTable}>
                                                <Droppable droppableId={`${index}`} key={`${index}`}>
                                                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                                        <TableBody
                                                            {...provided.droppableProps}
                                                            ref={provided.innerRef}
                                                            className={cx({ [classes.hoveringOverGroup]: snapshot.isDraggingOver })}
                                                        >
                                                            <MockTrackRow isHimdTrack={deviceCapabilities.himdTitles} />
                                                            {group.title !== null && (
                                                                <GroupRow
                                                                    usesHimdTracks={deviceCapabilities.himdTitles}
                                                                    group={group}
                                                                    onRename={handleRenameGroup}
                                                                    onDelete={handleDeleteGroup}
                                                                    isSelected={selectedGroups.includes(group.index)}
                                                                    onSelect={handleSelectGroupClick}
                                                                />
                                                            )}
                                                            {group.title === null && group.tracks.length === 0 && (
                                                                <TableRow style={{ height: '1px' }} />
                                                            )}
                                                            {group.tracks.map((t, tidx) => (
                                                                <Draggable
                                                                    draggableId={`${group.index}-${t.index}`}
                                                                    key={`t-${t.index}`}
                                                                    index={tidx}
                                                                    isDragDisabled={!deviceCapabilities.metadataEdit}
                                                                >
                                                                    {(provided: DraggableProvided) => (
                                                                        <TrackRow
                                                                            track={t}
                                                                            isHimdTrack={deviceCapabilities.himdTitles}
                                                                            draggableProvided={provided}
                                                                            inGroup={group.title !== null}
                                                                            isSelected={selected.includes(t.index)}
                                                                            trackStatus={getTrackStatus(t, deviceStatus)}
                                                                            onSelect={handleSelectTrackClick}
                                                                            onRename={handleRenameTrack}
                                                                            onTogglePlayPause={handleTogglePlayPauseTrack}
                                                                            onOpenContextMenu={(e) => handleOpenContextMenu(e, t)}
                                                                        />
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </TableBody>
                                                    )}
                                                </Droppable>
                                            </Table>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </DragDropContext>
                    </Table>
                    {isDragActive && deviceCapabilities.trackUpload ? (
                        <Backdrop className={classes.backdrop} open={isDragActive}>
                            Drop your Music to Upload
                        </Backdrop>
                    ) : null}
                </Box>
            ) : null}
            {deviceCapabilities.trackUpload ? (
                <Fab color="primary" aria-label="add" className={classes.add} onClick={openUploadMenu}>
                    <AddIcon />
                </Fab>
            ) : null}
            <Menu anchorEl={uploadMenuAnchorEl} open={Boolean(uploadMenuAnchorEl)} onClose={() => setUploadMenuAnchorEl(null)}>
                <MenuItem
                    onClick={() => {
                        setUploadMenuAnchorEl(null);
                        open();
                    }}
                >
                    Upload from this machine
                </MenuItem>
                <MenuItem onClick={handleOpenLocalLibrary}>Upload from library</MenuItem>
            </Menu>

            <DiscProtectedDialog />
            <UploadDialog />
            <RenameDialog />
            <ErrorDialog />
            <ConvertDialog files={uploadedFiles} />
            <RecordDialog />
            <FactoryModeProgressDialog />
            <FactoryModeBadSectorDialog />
            <DumpDialog
                trackIndexes={selected}
                isCapableOfDownload={deviceCapabilities.trackDownload || factoryModeRippingInMainUi}
                isExploitDownload={factoryModeRippingInMainUi}
            />
            <SongRecognitionDialog />
            <SongRecognitionProgressDialog />
            <FactoryModeNoticeDialog />
            <AboutDialog />
            <ChangelogDialog />
            <SettingsDialog />
            <LocalLibraryDialog setUploadedFiles={setUploadedFiles} />
            <PanicDialog />
            <ContextMenu onTogglePlayPause={handleTogglePlayPauseTrack} onRename={handleRenameTrack} onDelete={handleDeleteTrack} />
        </React.Fragment>
    );
};
export default Main;
