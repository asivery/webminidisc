import React, { useCallback, useRef } from 'react';
import { makeStyles } from 'tss-react/mui';
import Backdrop from '@mui/material/Backdrop';
import type { DropResult, ResponderProvided } from '@hello-pangea/dnd';
import { ArrowUpFromLine, Check, ChevronDown, Download, Music, Pencil, RefreshCw, Timer, Trash2, Upload } from 'lucide-react';

import { useDeviceCapabilities, useDispatch, useShallowEqualSelector } from '../../frontend-utils';
import { listContent, wipeDisc, exportCSV, importCSV, openRecognizeTrackDialog } from '../../redux/actions';
import { actions as appActions } from '../../redux/app-feature';
import serviceRegistry from '../../services/registry';
import { DeviceStatus, Disc as MdDisc, MinidiscSpec, RecordingCodec, Track, getDefaultCodecName } from '../../services/interfaces/netmd';
import { bytesToHumanReadable, formatTimeFromSeconds } from '../../utils';
import { buildDeviceInfoRows } from '../device-info-rows';
import { CHANGELOG } from '../../changelog';
import { TopMenu } from '../topmenu';
import type { W95Main } from '../win95/main';
import {
    DeckPanel,
    DeckKey,
    LcdWindow,
    SpecRow,
    DeckLabel,
    DeckPill,
    DeckStatus,
    DeckMark,
    DECK_SCROLLBAR,
    GROTESK,
    MONO,
    AMBER,
    AMBER_SOFT,
    TEXT,
    MUTED,
    LINE,
    DECK_COMPACT,
} from './common';
import { DeckTrackTable } from './track-table';
import { MiniDiscIcon } from './minidisc-icon';

import { RenameDialog } from '../rename-dialog';
import { UploadDialog } from '../upload-dialog';
import { RecordDialog } from '../record-dialog';
import { ErrorDialog } from '../error-dialog';
import { PanicDialog } from '../panic-dialog';
import { ConvertDialog } from '../convert-dialog';
import { AboutDialog } from '../about-dialog';
import { DeviceInfoDialog } from '../device-info-dialog';
import { DumpDialog } from '../dump-dialog';
import { ChangelogDialog } from '../changelog-dialog';
import { FactoryModeNoticeDialog } from '../factory/factory-notice-dialog';
import { FactoryModeProgressDialog } from '../factory/factory-progress-dialog';
import { SongRecognitionDialog } from '../song-recognition-dialog';
import { SongRecognitionProgressDialog } from '../song-recognition-progress-dialog';
import { SettingsDialog } from '../settings-dialog';
import { FactoryModeBadSectorDialog } from '../factory/factory-bad-sector-dialog';
import { DiscProtectedDialog } from '../disc-protected-dialog';
import { DeckContextMenu } from './context-menu';
import { LocalLibraryDialog } from '../local-library';
import { ManageEncodersDialog } from '../manage-encoders-dialog';

export type DeckMainProps = React.ComponentProps<typeof W95Main> & {
    handleTogglePlayPauseTrack: (event: React.MouseEvent, track: number) => void;
    handleDeleteTrack: (event: React.MouseEvent, index: number) => void;
    handleEject: (event: React.MouseEvent) => void;
    handleFlush: (event: React.MouseEvent) => void;
    handleRenameDisc: (event: React.MouseEvent) => void;
    handleDrop: (result: DropResult, provided: ResponderProvided) => void;
    handleOpenContextMenu: (event: React.MouseEvent, track: Track) => void;
    handleRenameGroup: (event: React.MouseEvent, index: number) => void;
    handleDeleteGroup: (event: React.MouseEvent, index: number) => void;
    handleSelectGroupClick: (event: React.MouseEvent, index: number) => void;
    selectedGroups: number[];
    handleGroupTracks: (event: React.MouseEvent) => void;
    canGroup: boolean;
    handleOpenLocalLibrary: () => void;
};

export function deckStatusText(status: DeviceStatus | null, loading: boolean): 'CONNECTING' | 'BUSY' | 'NO DISC' | 'READY' {
    if (status === null) return 'CONNECTING';
    if (loading) return 'BUSY';
    return status.discPresent && status.state !== 'unknown' ? 'READY' : 'NO DISC';
}

export function tocPillText(disc: MdDisc | null, flushable: boolean): 'NO DISC' | 'WRITE PROTECTED' | 'UNSAVED CHANGES' | 'TOC SYNCED' {
    if (disc === null) return 'NO DISC';
    if (disc.writeProtected) return 'WRITE PROTECTED';
    return flushable ? 'UNSAVED CHANGES' : 'TOC SYNCED';
}

// Sentence-case captions for the disc card's status line.
const TOC_CAPTIONS = {
    'NO DISC': 'No disc',
    'WRITE PROTECTED': 'Write protected',
    'UNSAVED CHANGES': 'Unsaved changes',
    'TOC SYNCED': 'TOC Synced',
} as const;

// "SP (Standard 292k)", "LP2 (132k ATRAC3)": the tile caption for a recording format.
function formatCaption(format: RecordingCodec): string {
    const name = format.userFriendlyName ?? format.codec;
    const detail =
        format.codec === 'SPS'
            ? `Standard ${format.defaultBitrate}k`
            : `${format.defaultBitrate}k ${format.codec === 'AT3' ? 'ATRAC3' : format.codec}`;
    return `${name} (${detail})`;
}

// "11m 46s free" / "1h 59m free".
function formatFree(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m free` : `${m}m ${String(sec).padStart(2, '0')}s free`;
}

export function freeTimeTiles(spec: MinidiscSpec, left: number): { name: string; value: string }[] {
    // Hi-MD bytes mode: one free-space figure, as main.tsx shows.
    if (spec.measurementUnits === 'bytes') return [{ name: 'Free', value: bytesToHumanReadable(left) }];
    const tiles: { name: string; value: string }[] = [];
    const seen = new Set<string>();
    for (const format of spec.availableFormats) {
        if (format.codec === 'SPM') continue;
        const key = format.userFriendlyName ?? format.codec;
        if (seen.has(key)) continue;
        seen.add(key);
        const value = formatFree(spec.translateDefaultMeasuringModeTo({ codec: format.codec, bitrate: format.defaultBitrate }, left));
        tiles.push({ name: formatCaption(format), value });
    }
    return tiles;
}

const ellipsis = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
} as const;

const useStyles = makeStyles()((theme) => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        [DECK_COMPACT]: { gap: 12 },
        minWidth: 0,
        marginBottom: 16,
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        outline: 'none',
        ...DECK_SCROLLBAR,
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1,
        color: '#fff',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '4px 8px 8px',
        marginBottom: -8,
        // On short windows the cards scroll under the header; it stays put with the page colour behind it.
        position: 'sticky',
        top: 0,
        zIndex: 3,
        background: '#131418',
    },
    headerSide: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minWidth: 0,
    },
    appTitle: {
        fontFamily: GROTESK,
        fontSize: 18,
        lineHeight: '24px',
        fontWeight: 700,
        letterSpacing: -0.45,
        color: AMBER_SOFT,
        ...ellipsis,
    },
    cards: {
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) 2fr',
        gap: 16,
        [DECK_COMPACT]: { gap: 12 },
        [theme.breakpoints.down(1024)]: {
            gridTemplateColumns: '1fr',
        },
    },
    card: {
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    deviceTop: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        [DECK_COMPACT]: { gap: 6 },
    },
    statusRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    led: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: AMBER_SOFT,
        boxShadow: `0 0 8px ${AMBER}`,
    },
    // Not READY (connecting, busy, no disc): the LED drops to an unlit amber with no glow.
    ledDim: {
        background: 'rgba(255,170,51,0.25)',
        boxShadow: 'none',
    },
    heading: {
        fontFamily: GROTESK,
        fontSize: 24,
        lineHeight: '32px',
        fontWeight: 700,
        letterSpacing: -0.6,
        color: TEXT,
        margin: 0,
        ...ellipsis,
    },
    // The device name and its spec rows open About this device; the name warms to amber like a key.
    clickable: {
        cursor: 'pointer',
        '&:hover, &:focus-visible': { color: AMBER_SOFT },
    },
    clickableRows: {
        cursor: 'pointer',
    },
    specs: {
        padding: '4px 0',
        [DECK_COMPACT]: { display: 'none' },
    },
    // Compact layout: the spec rows fold into one line; the heading still opens the full details.
    specsCompact: {
        display: 'none',
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '16px',
        letterSpacing: 0.66,
        color: MUTED,
        ...ellipsis,
        [DECK_COMPACT]: { display: 'block' },
    },
    discTop: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    discWell: {
        width: 48,
        height: 48,
        flexShrink: 0,
        padding: 5,
        background: '#0b0c0e',
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex',
    },
    discWellInner: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#22242a',
        border: '1px solid rgba(42,44,51,0.6)',
        borderRadius: 2,
        color: AMBER_SOFT,
    },
    discTitleBlock: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        minWidth: 0,
        flex: '1 1 auto',
    },
    discTitle: {
        minWidth: 0,
        maxWidth: '100%',
    },
    keyRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        [DECK_COMPACT]: { gap: 6, '& .MuiButton-root': { padding: '5px 10px' } },
    },
    meter: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    meterLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '16px',
        letterSpacing: 0.66,
        color: TEXT,
    },
    meterUsed: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600,
    },
    meterRemaining: {
        fontWeight: 700,
    },
    bar: {
        height: 16,
        padding: 3,
        borderRadius: 2,
        border: '1px solid rgba(42,44,51,0.6)',
        background: '#0b0c0e',
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 7px, rgba(0,0,0,0.65) 7px 8px)',
        overflow: 'hidden',
        display: 'flex',
    },
    barFill: {
        height: '100%',
        borderRadius: 2,
        background: 'linear-gradient(90deg, #ffaa33 0%, #e2c08d 50%, #c99a5b 100%)',
        boxShadow: '0 0 6px rgba(255,170,51,0.4)',
    },
    tiles: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 8,
        paddingTop: 15,
        borderTop: '1px solid rgba(42,44,51,0.3)',
    },
    tile: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        minWidth: 0,
        padding: 5,
        background: 'rgba(26,27,32,0.6)',
        border: '1px solid rgba(42,44,51,0.4)',
        borderRadius: 2,
        textAlign: 'center',
    },
    tileName: {
        fontFamily: MONO,
        fontSize: 9,
        lineHeight: '14px',
        fontWeight: 500,
        letterSpacing: 0.8,
        color: MUTED,
        ...ellipsis,
        maxWidth: '100%',
    },
    tileValue: {
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 600,
        letterSpacing: 0.8,
        color: AMBER_SOFT,
        ...ellipsis,
        maxWidth: '100%',
    },
}));

type Classes = ReturnType<typeof useStyles>['classes'];

const DeckHeader = ({ props, classes, flushable }: { props: DeckMainProps; classes: Classes; flushable: boolean }) => {
    const deviceCapabilities = useDeviceCapabilities();
    return (
        <div className={classes.header}>
            <div className={classes.brand}>
                <div className={classes.headerSide}>
                    <DeckMark />
                    <span className={classes.appTitle}>Web MiniDisc Pro</span>
                </div>
                <DeckPill tone="version">{CHANGELOG[0].name}</DeckPill>
            </div>
            <div className={classes.headerSide}>
                {deviceCapabilities.discEject && (
                    <DeckKey icon={<ArrowUpFromLine size={11} />} onClick={props.handleEject} disabled={!props.disc}>
                        Eject
                    </DeckKey>
                )}
                {flushable && (
                    <DeckKey icon={<Check size={11} />} onClick={props.handleFlush}>
                        Commit
                    </DeckKey>
                )}
                <TopMenu
                    tracksSelected={props.selected}
                    renderTrigger={(open) => (
                        <DeckKey
                            icon={<ChevronDown size={11} />}
                            aria-label="menu"
                            aria-controls="actions-menu"
                            aria-haspopup="true"
                            onClick={open}
                        >
                            Menu
                        </DeckKey>
                    )}
                />
            </div>
        </div>
    );
};

const EMPHASISED_ROWS = new Set(['Model', 'USB ID', 'Tracks']);

const DeviceCard = ({ props, classes }: { props: DeckMainProps; classes: Classes }) => {
    const dispatch = useDispatch();
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const deviceInfo = useShallowEqualSelector((state) => state.main.deviceInfo);
    const loading = useShallowEqualSelector((state) => state.appState.loading);
    const status = deckStatusText(deviceStatus, loading);
    const rows = buildDeviceInfoRows(props.deviceName, deviceInfo, props.disc, serviceRegistry.netmdSpec);
    return (
        <DeckPanel className={classes.card}>
            <div className={classes.deviceTop}>
                <div className={classes.statusRow}>
                    <span className={status === 'READY' ? classes.led : `${classes.led} ${classes.ledDim}`} />
                    <DeckLabel>{status === 'CONNECTING' ? status : `ONLINE • ${status}`}</DeckLabel>
                </div>
                <h2
                    className={`${classes.heading} ${classes.clickable}`}
                    title={props.deviceName}
                    role="button"
                    tabIndex={0}
                    aria-label={`${props.deviceName}: show device details`}
                    onClick={() => dispatch(appActions.showDeviceInfoDialog(true))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            dispatch(appActions.showDeviceInfoDialog(true));
                        }
                    }}
                >
                    {props.deviceName}
                </h2>
            </div>
            <div className={`${classes.specs} ${classes.clickableRows}`} onClick={() => dispatch(appActions.showDeviceInfoDialog(true))}>
                {rows.map((row) => (
                    <SpecRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        accent={row.label === 'USB ID'}
                        emphasis={EMPHASISED_ROWS.has(row.label)}
                    />
                ))}
            </div>
            <div
                className={`${classes.specsCompact} ${classes.clickableRows}`}
                onClick={() => dispatch(appActions.showDeviceInfoDialog(true))}
            >
                {rows
                    .filter((row) => row.label === 'Disc' || row.label === 'Tracks')
                    .map((row) => row.value)
                    .join(' · ')}
            </div>
        </DeckPanel>
    );
};

const DiscCard = ({ props, classes, flushable }: { props: DeckMainProps; classes: Classes; flushable: boolean }) => {
    const dispatch = useDispatch();
    const deviceCapabilities = useDeviceCapabilities();
    const hiddenFileInputRef = useRef<HTMLInputElement>(null);
    const spec = serviceRegistry.netmdSpec;
    const disc = props.disc;
    const noDisc = disc === null;
    const canEdit = deviceCapabilities.metadataEdit;

    const handleCSVImportFromFile = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) dispatch(importCSV(file));
            event.target.value = '';
        },
        [dispatch]
    );

    const usesBytes = spec?.measurementUnits === 'bytes';
    const fmt = (n: number) => (usesBytes ? bytesToHumanReadable(n) : formatTimeFromSeconds(n, false));
    const title = disc ? (disc.fullWidthTitle ? `${disc.fullWidthTitle} / ${disc.title}` : disc.title || 'Untitled Disc') : '';
    // Worked out from total and free space: the same units the remaining figure uses on every service.
    const used = disc ? disc.total - disc.left : 0;
    const usedPercent = disc && disc.total > 0 ? Math.min(100, (used / disc.total) * 100) : 0;

    return (
        <DeckPanel className={classes.card} style={{ padding: 21 }}>
            <div className={classes.discTop}>
                <span className={classes.discWell}>
                    <span className={classes.discWellInner}>
                        <MiniDiscIcon size={32} strokeWidth={1.25} />
                    </span>
                </span>
                <div className={classes.discTitleBlock}>
                    <h2 className={`${classes.heading} ${classes.discTitle}`} title={title} onDoubleClick={props.handleRenameDisc}>
                        {title}
                    </h2>
                    <DeckStatus>{TOC_CAPTIONS[tocPillText(disc, flushable)]}</DeckStatus>
                </div>
            </div>
            <div className={classes.keyRow}>
                <DeckKey icon={<RefreshCw size={11} />} disabled={noDisc} onClick={() => dispatch(listContent(true))}>
                    Reload TOC
                </DeckKey>
                <DeckKey icon={<Pencil size={11} />} disabled={noDisc || !canEdit} onClick={props.handleRenameDisc}>
                    Rename
                </DeckKey>
                <DeckKey icon={<Trash2 size={11} />} disabled={noDisc || !canEdit} onClick={() => dispatch(wipeDisc())}>
                    Wipe disc
                </DeckKey>
                <DeckKey icon={<Upload size={11} />} disabled={noDisc || !canEdit} onClick={() => hiddenFileInputRef.current?.click()}>
                    Import titles
                </DeckKey>
                <DeckKey icon={<Download size={11} />} disabled={noDisc} onClick={() => dispatch(exportCSV())}>
                    Export titles
                </DeckKey>
                <DeckKey
                    icon={<Music size={11} />}
                    disabled={noDisc || !deviceCapabilities.playbackControl || !deviceCapabilities.contentList}
                    onClick={() => dispatch(openRecognizeTrackDialog(props.selected))}
                >
                    Song recognition
                </DeckKey>
                <input type="file" accept=".csv" ref={hiddenFileInputRef} style={{ display: 'none' }} onChange={handleCSVImportFromFile} />
            </div>
            <LcdWindow variant="meter" className={classes.meter}>
                {disc === null || !spec ? (
                    <DeckLabel>NO DISC</DeckLabel>
                ) : (
                    <>
                        <div className={classes.meterLabels}>
                            <span className={classes.meterUsed}>
                                <Timer size={12} />
                                {`${fmt(used)} USED`}
                            </span>
                            <span className={classes.meterRemaining}>
                                {usesBytes
                                    ? `${fmt(disc.left)} REMAINING`
                                    : `${fmt(disc.left)} REMAINING (${getDefaultCodecName(spec)} Mode)`}
                            </span>
                        </div>
                        <div className={classes.bar}>
                            <div className={classes.barFill} style={{ width: `${usedPercent}%` }} />
                        </div>
                        <div className={classes.tiles}>
                            {freeTimeTiles(spec, disc.left).map((tile) => (
                                <div key={tile.name} className={classes.tile}>
                                    <span className={classes.tileName}>{tile.name}</span>
                                    <span className={classes.tileValue}>{tile.value}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </LcdWindow>
        </DeckPanel>
    );
};

export const DeckMain = (props: DeckMainProps) => {
    const { classes } = useStyles();
    const flushable = useShallowEqualSelector((state) => state.main.flushable);
    const deviceCapabilities = useDeviceCapabilities();

    return (
        <div className={classes.root} {...props.getRootProps({ tabIndex: -1 })}>
            <input {...props.getInputProps()} />
            <DeckHeader props={props} classes={classes} flushable={flushable} />
            <div className={classes.cards}>
                <DeviceCard props={props} classes={classes} />
                <DiscCard props={props} classes={classes} flushable={flushable} />
            </div>
            <DeckTrackTable props={props} />
            {props.isDragActive && deviceCapabilities.trackUpload ? (
                <Backdrop className={classes.backdrop} open={props.isDragActive}>
                    Drop your Music to Upload
                </Backdrop>
            ) : null}

            <DiscProtectedDialog />
            <UploadDialog />
            <RenameDialog />
            <ErrorDialog />
            <ConvertDialog files={props.uploadedFiles} />
            <RecordDialog />
            <FactoryModeProgressDialog />
            <FactoryModeBadSectorDialog />
            <DumpDialog
                trackIndexes={props.selected}
                isCapableOfDownload={deviceCapabilities.trackDownload || props.factoryModeRippingInMainUi}
                isExploitDownload={props.factoryModeRippingInMainUi}
            />
            <SongRecognitionDialog />
            <SongRecognitionProgressDialog />
            <FactoryModeNoticeDialog />
            <AboutDialog />
            <DeviceInfoDialog />
            <ChangelogDialog />
            <SettingsDialog />
            <ManageEncodersDialog />
            <LocalLibraryDialog setUploadedFiles={props.setUploadedFiles} />
            <PanicDialog />
            <DeckContextMenu
                onTogglePlayPause={props.handleTogglePlayPauseTrack}
                onRename={props.handleRenameTrack}
                onDelete={props.handleDeleteTrack}
            />
        </div>
    );
};
