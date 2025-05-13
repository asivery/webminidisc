import React, { useContext } from 'react';
import {
    Table,
    TableHead,
    TableRow,
    TableHeadCell,
    TableBody,
    TableDataCell,
    Divider,
    Toolbar,
    Bar,
    Button,
    WindowContent,
    Tooltip,
    List,
    ListItem,
} from 'react95';
import { makeStyles } from 'tss-react/mui';
import { DropzoneRootProps, DropzoneInputProps, FileRejection } from 'react-dropzone';
import { ThemeContext } from 'styled-components';
import { Controls } from '../controls';
import { AdaptiveFile, bytesToHumanReadable, formatTimeFromSeconds } from '../../utils';
import { useDeviceCapabilities, useShallowEqualSelector } from '../../frontend-utils';

import DeleteIconUrl from '../../images/win95/delete.png';
import MicIconUrl from '../../images/win95/mic.png';
import MoveIconUrl from '../../images/win95/move.png';
import RenameIconUrl from '../../images/win95/rename.png';
import DeviceIconUrl from '../../images/win95/device.png';
import { RenameDialog } from '../rename-dialog';
import { AboutDialog } from '../about-dialog';

import MDIconUrl from '../../images/win95/minidisc32.png';
import { FloatingButton, CustomTableRow } from './common';
import { ConvertDialog } from '../convert-dialog';
import { UploadDialog } from '../upload-dialog';
import { ErrorDialog } from '../error-dialog';
import { RecordDialog } from '../record-dialog';
import { DumpDialog } from '../dump-dialog';
import { PanicDialog } from '../panic-dialog';
import { ChangelogDialog } from '../changelog-dialog';
import { Disc } from '../../services/interfaces/netmd';

const useStyles = makeStyles()((theme: any) => ({
    container: {
        width: '100%',
        flex: '1 1 auto',
        display: 'flex',
        minHeight: 0,
        '& > div': {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
        },
    },
    table: {
        height: '100%',
        width: '100%',
        display: 'flex !important',
        flexDirection: 'column',
    },
    windowContent: {
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 0,
    },
    controlsContainer: {
        width: '100%',
        marginTop: 16,
    },
    toolbarIcon: {
        marginRight: 4,
    },
    toolbarItem: {
        padding: '6px 10px',
    },
}));

export const W95Main = (props: {
    disc: Disc | null;
    deviceName: string;
    factoryModeRippingInMainUi: boolean;
    selected: number[];
    setSelected: React.Dispatch<React.SetStateAction<number[]>>;
    selectedCount: number;
    tracks: {
        index: number;
        title: string;
        fullWidthTitle: string;
        group: string | null;
        duration: number;
        encoding: string;
    }[];
    uploadedFiles: (File | AdaptiveFile)[];
    setUploadedFiles: React.Dispatch<React.SetStateAction<(File | AdaptiveFile)[]>>;
    onDrop: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void;
    getRootProps: (props?: DropzoneRootProps | undefined) => DropzoneRootProps;
    getInputProps: (props?: DropzoneInputProps | undefined) => DropzoneInputProps;
    isDragActive: boolean;
    isUsingBytes: boolean;
    open: () => void;
    moveMenuAnchorEl: HTMLElement | null;
    setMoveMenuAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
    handleShowMoveMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
    handleCloseMoveMenu: () => void;
    handleMoveSelectedTrack: (destIndex: number) => void;
    handleShowDumpDialog: () => void;
    handleDeleteSelected: (event: React.MouseEvent) => void;
    handleRenameActionClick: (event: React.MouseEvent) => void;
    handleRenameTrack: (event: React.MouseEvent, item: number) => void;
    handleSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleSelectTrackClick: (event: React.MouseEvent, item: number) => void;
}) => {
    const { classes } = useStyles();
    const themeContext = useContext(ThemeContext)!;
    const { mainView } = useShallowEqualSelector((state) => state.appState);

    const deviceCapabilities = useDeviceCapabilities();

    return (
        <>
            <Divider />
            <Toolbar style={{ flexWrap: 'wrap', position: 'relative' }}>
                {props.selectedCount === 0 ? (
                    <>
                        <img alt="device" src={DeviceIconUrl} style={{ marginTop: -10, marginLeft: 10 }} />
                        <div className={classes.toolbarItem}>
                            {`${props.deviceName}: (` || `Loading...`}
                            {props.disc?.fullWidthTitle && `${props.disc?.fullWidthTitle} / `}
                            {props.disc ? props.disc.title || `Untitled Disc` : ''}
                            {`)`}
                        </div>
                        <Bar size={35} />
                        <img alt="minidisc" src={MDIconUrl} style={{ width: 32, marginLeft: 10 }} />
                        {props.disc !== null ? props.isUsingBytes ?
                            <div className={classes.toolbarItem}>{`${bytesToHumanReadable(
                                props.disc.left
                            )} left of ${bytesToHumanReadable(props.disc.total)} `}</div>
                        : (
                            <Tooltip
                                text={`${formatTimeFromSeconds(props.disc.left * 2)} in LP2 or ${formatTimeFromSeconds(
                                    props.disc.left * 4
                                )} in LP4`}
                                enterDelay={100}
                                leaveDelay={500}
                            >
                                <div className={classes.toolbarItem}>{`${formatTimeFromSeconds(
                                    props.disc.left
                                )} left of ${formatTimeFromSeconds(props.disc.total)} `}</div>
                            </Tooltip>
                        ) : null}
                    </>
                ) : null}

                {props.selectedCount > 0 ? (
                    <>
                        <Button
                            variant="menu"
                            disabled={props.selectedCount !== 1 || !deviceCapabilities.metadataEdit}
                            onClick={props.handleShowMoveMenu}
                        >
                            <img alt="move" src={MoveIconUrl} className={classes.toolbarIcon} />
                            Move
                        </Button>
                        <Button variant="menu" onClick={props.handleShowDumpDialog}>
                            <img alt="record" src={MicIconUrl} className={classes.toolbarIcon} />
                            Record
                        </Button>
                        <Button variant="menu" disabled={!deviceCapabilities.metadataEdit} onClick={props.handleDeleteSelected}>
                            <img alt="delete" src={DeleteIconUrl} className={classes.toolbarIcon} />
                            Delete
                        </Button>
                        <Button
                            variant="menu"
                            onClick={props.handleRenameActionClick}
                            disabled={props.selectedCount > 1 || !deviceCapabilities.metadataEdit}
                        >
                            <img alt="rename" src={RenameIconUrl} className={classes.toolbarIcon} />
                            Rename
                        </Button>
                        {props.moveMenuAnchorEl ? (
                            <List style={{ position: 'absolute', left: 16, top: 32, zIndex: 2 }}>
                                {Array(props.tracks.length)
                                    .fill(null)
                                    .map((_, i) => {
                                        return (
                                            <ListItem key={`pos-${i}`} onClick={() => props.handleMoveSelectedTrack(i)}>
                                                {i + 1}
                                            </ListItem>
                                        );
                                    })}
                            </List>
                        ) : null}
                    </>
                ) : null}
                <Bar size={35} />
            </Toolbar>
            <Divider />
            <WindowContent className={classes.windowContent}>
                {deviceCapabilities.contentList && (
                    <div className={classes.container} {...props.getRootProps()} style={{ outline: 'none' }}>
                        <input {...props.getInputProps()} />
                        <Table className={classes.table}>
                            <TableHead>
                                <TableRow head style={{ display: 'flex' }}>
                                    <TableHeadCell style={{ width: '2ch' }}>#</TableHeadCell>
                                    <TableHeadCell style={{ textAlign: 'left', flex: '1 1 auto' }}>Title</TableHeadCell>
                                    <TableHeadCell style={{ textAlign: 'right', width: '20%' }}>Duration</TableHeadCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {props.tracks.map((track) => (
                                    <CustomTableRow
                                        style={props.selected.includes(track.index) ? themeContext.selectedTableRow : {}}
                                        key={track.index}
                                        onDoubleClick={(event: React.MouseEvent) =>
                                            deviceCapabilities.metadataEdit && props.handleRenameTrack(event, track.index)
                                        }
                                        onClick={(event: React.MouseEvent) => props.handleSelectTrackClick(event, track.index)}
                                    >
                                        <TableDataCell style={{ textAlign: 'center', width: '2ch' }}>{track.index + 1}</TableDataCell>
                                        <TableDataCell style={{ width: '80%' }}>
                                            <div>
                                                {track.fullWidthTitle && `${track.fullWidthTitle} / `}
                                                {track.title || `No Title`}
                                            </div>
                                        </TableDataCell>
                                        <TableDataCell style={{ textAlign: 'right', width: '20%' }}>
                                            <span>{track.encoding}</span>
                                            &nbsp;
                                            <span>{formatTimeFromSeconds(track.duration)}</span>
                                        </TableDataCell>
                                    </CustomTableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <div className={classes.controlsContainer}>{mainView === 'MAIN' ? <Controls /> : null}</div>
            </WindowContent>
            {deviceCapabilities.trackUpload && <FloatingButton onClick={props.open} />}

            <UploadDialog />
            <ErrorDialog />
            <ConvertDialog files={props.uploadedFiles} />
            <RenameDialog />
            <RecordDialog />
            <DumpDialog
                trackIndexes={props.selected}
                isCapableOfDownload={deviceCapabilities.trackDownload || props.factoryModeRippingInMainUi}
                isExploitDownload={props.factoryModeRippingInMainUi}
            />
            <AboutDialog />
            <ChangelogDialog />
            <PanicDialog />
        </>
    );
};
