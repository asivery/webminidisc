import React, { useMemo, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Draggable, DraggableProvided, DragDropContext, Droppable, DroppableProvided, DroppableStateSnapshot } from '@hello-pangea/dnd';
import { Circle, Download, FilePlus, Folder, Pencil, Trash2 } from 'lucide-react';

import { useDeviceCapabilities, useShallowEqualSelector } from '../../frontend-utils';
import { DeviceStatus, Track } from '../../services/interfaces/netmd';
import serviceRegistry from '../../services/registry';
import { getGroupedTracks } from '../../utils';
import { GroupRow, MockTrackRow, TrackRow } from '../main-rows';
import { DeckPanel, DeckKey, DECK_SCROLLBAR, AMBER, AMBER_SOFT, GROTESK, MONO, TEXT, MUTED, LINE } from './common';
import type { DeckMainProps } from './main';
import { useTrackListKeyboard } from './track-keys';

const AMBER_FILL = 'rgba(255,170,51,0.1)';
const AMBER_DROP = 'rgba(255,170,51,0.12)';
const ROW_LINE = '1px solid rgba(42,44,51,0.3)';

// Same as getTrackStatus in ../main.tsx, which is not exported.
function getTrackStatus(track: Track, deviceStatus: DeviceStatus | null): 'playing' | 'paused' | 'none' {
    if (!deviceStatus || track.index !== deviceStatus.track) return 'none';
    if (deviceStatus.state === 'playing') return 'playing';
    if (deviceStatus.state === 'paused') return 'paused';
    return 'none';
}

const GROUP_LINE = 'rgba(255,170,51,0.35)';

const useStyles = makeStyles()(() => ({
    panel: {
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        // Room for the bar, the head and about five tracks before the list gives way; below that the Deck
        // screen scrolls instead (short windows).
        minHeight: 340,
    },
    bar: {
        padding: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        borderBottom: `1px solid ${LINE}`,
    },
    barSelected: {
        background: AMBER_FILL,
    },
    barSide: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    barCaption: {
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: '16px',
        fontWeight: 700,
        letterSpacing: 0.66,
        color: MUTED,
        whiteSpace: 'nowrap',
    },
    barCaptionSelected: {
        color: AMBER,
    },
    tableScroll: {
        overflowX: 'auto',
        ...DECK_SCROLLBAR,
    },
    // Applied to the outer table and to each group's inner table.
    table: {
        tableLayout: 'fixed',
        '& td': {
            height: 49,
            boxSizing: 'border-box',
            fontFamily: GROTESK,
            fontSize: 14,
            lineHeight: '20px',
            fontWeight: 500,
            color: TEXT,
            borderBottom: ROW_LINE,
        },
        // The head row and each group's rows are separate fixed-layout tables, so give the first two
        // columns identical boxes in both; the index number then sits under the # exactly.
        '& th:first-of-type, & td:first-of-type': {
            width: 40,
            boxSizing: 'border-box',
            padding: '0 12px',
        },
        '& th:nth-of-type(2), & td:nth-of-type(2)': {
            width: 32,
            boxSizing: 'border-box',
            padding: '0 8px',
            textAlign: 'center',
        },
        // Upstream indents a grouped track's number and title by 24px; keep the indent on the title only
        // so the numbers stay in one column under the # header.
        '& tr[class*="inGroupTrackRow"] > td[class*="indexCell"]': {
            transform: 'none',
        },
        '& td:nth-of-type(2)': {
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.66,
            color: MUTED,
        },
        // The stock row keeps format badge and duration in one cell; lay them out as two 112px columns,
        // badge centred in the first, time right-aligned in the second (27px in).
        '& td:last-child': {
            position: 'relative',
            width: 248,
            padding: 0,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.66,
            color: MUTED,
            whiteSpace: 'nowrap',
        },
        '& td:last-child span[class*="formatBadge"]': {
            position: 'absolute',
            left: 68,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'inline-block',
            background: 'rgba(255,170,51,0.15)',
            border: '1px solid rgba(255,170,51,0.3)',
            color: AMBER,
            fontFamily: MONO,
            fontSize: 11,
            lineHeight: '20px',
            fontWeight: 700,
            letterSpacing: 0,
            padding: '0 9px',
            borderRadius: 2,
            margin: 0,
            width: 'auto',
            height: 'auto',
            whiteSpace: 'nowrap',
        },
        // A mono track carries a second "MONO" badge upstream; fold it into one badge reading "SP MONO".
        '& td:last-child span[class*="channelBadge"]': {
            display: 'none',
        },
        '& td:last-child span[class*="channelBadge"] + span[class*="formatBadge"]::after': {
            content: '" MONO"',
        },
        '& td:last-child span[class*="durationCellTime"]': {
            position: 'absolute',
            right: 27,
            top: '50%',
            transform: 'translateY(-50%)',
        },
        // Group rows (the stock GroupRow, found by its folder icon) read as full-width dividers in the label style.
        '& tr:has(> td > [class*="groupFolderIcon"])': {
            backgroundColor: 'rgba(11,12,14,0.55)',
        },
        '& tr:has(> td > [class*="groupFolderIcon"]) > td': {
            height: 36,
            fontFamily: MONO,
            fontSize: 10,
            lineHeight: '14px',
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: MUTED,
        },
        '& tr:has(> td > [class*="groupFolderIcon"]) svg[class*="groupFolderIcon"]': {
            color: AMBER_SOFT,
        },
        // A group's tracks share the group row's tint and hang off it on an amber tree line: an L into each
        // title, the stem continuing down to the next track and stopping at the last one.
        '& tr[class*="inGroupTrackRow"]': {
            backgroundColor: 'rgba(11,12,14,0.55)',
        },
        // Indent with padding, not upstream's translateX, so the cell's bottom line stays under the whole row.
        '& tr[class*="inGroupTrackRow"] > td[class*="titleCell"]': {
            transform: 'none',
            position: 'relative',
            paddingLeft: 44,
        },
        '& tr[class*="inGroupTrackRow"] > td[class*="titleCell"]::before': {
            content: '""',
            position: 'absolute',
            left: 20,
            top: 0,
            bottom: 0,
            width: 12,
            borderLeft: `1px solid ${GROUP_LINE}`,
        },
        '& tr[class*="inGroupTrackRow"] > td[class*="titleCell"]::after': {
            content: '""',
            position: 'absolute',
            left: 20,
            top: '50%',
            width: 14,
            borderTop: `1px solid ${GROUP_LINE}`,
        },
        '& tr[class*="inGroupTrackRow"]:last-of-type > td[class*="titleCell"]::before': {
            bottom: '50%',
        },
        // Keyboard focus (see track-keys.ts): an inset amber ring on the focused row, and the controls upstream
        // reveals on hover (a track's play key, a group's delete) also appear while the row has focus.
        '& tr[class*="rowClass"]:focus': { outline: 'none' },
        '& tr[class*="rowClass"]:focus-visible': { outline: `2px solid ${AMBER}`, outlineOffset: -2 },
        '& tr[class*="trackRow"]:focus-within [class*="playButtonInTrackList"]': { display: 'inline-flex' },
        '& tr[class*="trackRow"]:focus-within [class*="trackIndex"]': { display: 'none' },
        '& tr[class*="groupHeadRow"]:focus-within [class*="deleteGroupButton"]': { display: 'inline-flex' },
        '& tr[class*="groupHeadRow"]:focus-within svg[class*="groupFolderIcon"]': { display: 'none' },
        // Upstream marks the playing or paused row with its currentTrackRow class.
        '& tr[class*="currentTrackRow"]': {
            backgroundColor: AMBER_FILL,
        },
        '& tr[class*="currentTrackRow"] td': {
            color: AMBER,
        },
    },
    // The outer rows only wrap a group's inner table, so they take no stripe or line.
    outerTable: {
        '& > tbody > tr > td': {
            height: 'auto',
            borderBottom: 'none',
        },
    },
    head: {
        '& th': {
            height: 49,
            boxSizing: 'border-box',
            background: 'rgba(11,12,14,0.8)',
            borderBottom: `1px solid ${LINE}`,
            fontFamily: MONO,
            fontSize: 10,
            lineHeight: '14px',
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: MUTED,
        },
    },
    dragHandleHead: {},
    indexHead: {},
    formatLengthHead: {
        width: 248,
        padding: 0,
    },
    formatHead: {
        display: 'inline-block',
        width: 136,
        textAlign: 'center',
    },
    lengthHead: {
        display: 'inline-block',
        width: 112,
        textAlign: 'right',
        paddingRight: 27,
        boxSizing: 'border-box',
    },
    groupCell: {
        padding: 0,
    },
    droppingOver: {
        backgroundColor: AMBER_DROP,
        // Dragging a track over a group must not reveal the group's hover-only delete control.
        '& [class*="deleteGroupButton"]': { display: 'none !important' },
        '& svg[class*="groupFolderIcon"]': { display: 'inline-block !important' },
    },
}));

export const DeckTrackTable = ({ props }: { props: DeckMainProps }) => {
    const { classes, cx } = useStyles();
    const deviceCapabilities = useDeviceCapabilities();
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const groupedTracks = useMemo(() => getGroupedTracks(props.disc), [props.disc]);
    const isHimdTrack = deviceCapabilities.himdTitles;
    const columns = 4 + (isHimdTrack ? 2 : 0);

    const [uploadMenuAnchorEl, setUploadMenuAnchorEl] = useState<null | HTMLElement>(null);
    // The stock app renames a group by double-click and deletes it with a hover-only icon; Deck adds a
    // right-click menu. Group rows are told apart from track rows by their empty drag-handle cell.
    const [groupMenu, setGroupMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const openGroupMenu = (event: React.MouseEvent, groupIndex: number) => {
        const row = (event.target as HTMLElement).closest('tr');
        if (!row || !row.querySelector('td[class*="dragHandleEmpty"]')) return;
        event.preventDefault();
        setGroupMenu({ x: event.clientX, y: event.clientY, index: groupIndex });
    };
    // Same choice as openUploadMenu in ../main.tsx, whose menu is only rendered by the default look.
    const openUploadMenu = (event: React.MouseEvent<HTMLElement>) => {
        if (serviceRegistry.libraryService) {
            setUploadMenuAnchorEl(event.currentTarget);
        } else {
            props.open();
        }
    };
    const canDownload = deviceCapabilities.trackDownload || props.factoryModeRippingInMainUi;
    const selected = props.selectedCount > 0;
    const keyboard = useTrackListKeyboard(groupedTracks, props.handleDrop, deviceCapabilities.metadataEdit);

    return (
        <DeckPanel className={classes.panel}>
            <div className={cx(classes.bar, selected && classes.barSelected)}>
                <div className={classes.barSide}>
                    <span className={cx(classes.barCaption, selected && classes.barCaptionSelected)}>
                        {selected
                            ? `${props.selectedCount} selected`
                            : `${props.tracks.length} ${props.tracks.length === 1 ? 'track' : 'tracks'}`}
                    </span>
                </div>
                <div className={classes.barSide}>
                    <DeckKey
                        compact
                        icon={canDownload ? <Download size={11} /> : <Circle size={11} />}
                        disabled={!selected}
                        onClick={props.handleShowDumpDialog}
                    >
                        {canDownload ? 'Download' : 'Record'}
                    </DeckKey>
                    <DeckKey
                        compact
                        icon={<Folder size={11} />}
                        disabled={!selected || !props.canGroup || !deviceCapabilities.metadataEdit}
                        onClick={props.handleGroupTracks}
                    >
                        Group
                    </DeckKey>
                    <DeckKey
                        compact
                        icon={<Pencil size={11} />}
                        disabled={props.selectedCount !== 1 || !deviceCapabilities.metadataEdit}
                        onClick={props.handleRenameActionClick}
                    >
                        Rename
                    </DeckKey>
                    <DeckKey
                        compact
                        icon={<Trash2 size={11} />}
                        disabled={!selected || !deviceCapabilities.metadataEdit}
                        onClick={props.handleDeleteSelected}
                    >
                        Delete
                    </DeckKey>
                    <DeckKey compact icon={<FilePlus size={11} />} disabled={!deviceCapabilities.trackUpload} onClick={openUploadMenu}>
                        Import tracks
                    </DeckKey>
                    <Menu anchorEl={uploadMenuAnchorEl} open={Boolean(uploadMenuAnchorEl)} onClose={() => setUploadMenuAnchorEl(null)}>
                        <MenuItem
                            onClick={() => {
                                setUploadMenuAnchorEl(null);
                                props.open();
                            }}
                        >
                            Upload from this machine
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setUploadMenuAnchorEl(null);
                                props.handleOpenLocalLibrary();
                            }}
                        >
                            Upload from library
                        </MenuItem>
                    </Menu>
                </div>
            </div>
            {deviceCapabilities.contentList && (
                <div className={classes.tableScroll} ref={keyboard.containerRef} onKeyDown={keyboard.onKeyDown}>
                    <Table size="small" className={cx(classes.table, classes.outerTable)}>
                        <TableHead className={classes.head}>
                            <TableRow>
                                <TableCell className={classes.dragHandleHead}></TableCell>
                                <TableCell className={classes.indexHead}>#</TableCell>
                                <TableCell>Title</TableCell>
                                {isHimdTrack && (
                                    <>
                                        <TableCell>Album</TableCell>
                                        <TableCell>Artist</TableCell>
                                    </>
                                )}
                                <TableCell className={classes.formatLengthHead}>
                                    <span className={classes.formatHead}>Format</span>
                                    <span className={classes.lengthHead}>Length</span>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <DragDropContext onDragEnd={props.handleDrop}>
                            <TableBody>
                                {groupedTracks.map((group, index) => (
                                    <TableRow key={`${index}`}>
                                        <TableCell colSpan={columns} className={classes.groupCell}>
                                            <Table size="small" className={classes.table}>
                                                <Droppable droppableId={`${index}`} key={`${index}`}>
                                                    {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                                        <TableBody
                                                            {...provided.droppableProps}
                                                            ref={provided.innerRef}
                                                            className={cx({ [classes.droppingOver]: snapshot.isDraggingOver })}
                                                            onContextMenu={
                                                                group.title !== null ? (e) => openGroupMenu(e, group.index) : undefined
                                                            }
                                                        >
                                                            <MockTrackRow isHimdTrack={isHimdTrack} />
                                                            {group.title !== null && (
                                                                <GroupRow
                                                                    usesHimdTracks={isHimdTrack}
                                                                    group={group}
                                                                    onRename={props.handleRenameGroup}
                                                                    onDelete={props.handleDeleteGroup}
                                                                    isSelected={props.selectedGroups.includes(group.index)}
                                                                    onSelect={props.handleSelectGroupClick}
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
                                                                            isHimdTrack={isHimdTrack}
                                                                            draggableProvided={provided}
                                                                            inGroup={group.title !== null}
                                                                            isSelected={props.selected.includes(t.index)}
                                                                            trackStatus={getTrackStatus(t, deviceStatus)}
                                                                            onSelect={props.handleSelectTrackClick}
                                                                            // TrackRow fires onRename on double-click; in Deck a double-click plays.
                                                                            onRename={props.handleTogglePlayPauseTrack}
                                                                            onTogglePlayPause={props.handleTogglePlayPauseTrack}
                                                                            onOpenContextMenu={(e) => props.handleOpenContextMenu(e, t)}
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
                </div>
            )}
            <Menu
                open={groupMenu !== null}
                onClose={() => setGroupMenu(null)}
                anchorReference="anchorPosition"
                anchorPosition={groupMenu ? { top: groupMenu.y, left: groupMenu.x } : undefined}
            >
                <MenuItem
                    disabled={!deviceCapabilities.metadataEdit}
                    onClick={(e) => {
                        const index = groupMenu!.index;
                        setGroupMenu(null);
                        props.handleRenameGroup(e, index);
                    }}
                >
                    <ListItemIcon>
                        <Pencil size={14} />
                    </ListItemIcon>
                    <ListItemText>Rename group</ListItemText>
                </MenuItem>
                <MenuItem
                    disabled={!deviceCapabilities.metadataEdit}
                    onClick={(e) => {
                        const index = groupMenu!.index;
                        setGroupMenu(null);
                        props.handleDeleteGroup(e, index);
                    }}
                >
                    <ListItemIcon>
                        <Trash2 size={14} />
                    </ListItemIcon>
                    <ListItemText>Delete group</ListItemText>
                </MenuItem>
            </Menu>
        </DeckPanel>
    );
};
