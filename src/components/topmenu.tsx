import React, { useCallback } from 'react';
import { useDispatch, batchActions, useDeviceCapabilities } from '../frontend-utils';

import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { wipeDisc, listContent, selfTest, exportCSV, importCSV, openRecognizeTrackDialog } from '../redux/actions';
import { actions as appActions } from '../redux/app-feature';
import { actions as renameDialogActions, RenameType } from '../redux/rename-dialog-feature';
import { actions as factoryNoticeDialogActions } from '../redux/factory/factory-notice-dialog-feature';
import { dispatchQueue } from '../utils';
import { useShallowEqualSelector } from '../frontend-utils';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { makeStyles } from 'tss-react/mui';

import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import GitHubIcon from '@mui/icons-material/GitHub';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import BugReportIcon from '@mui/icons-material/BugReport';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import InfoIcon from '@mui/icons-material/Info';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import Win95Icon from '../images/win95/win95.png';
import HelpIcon from '@mui/icons-material/Help';
import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import PublishIcon from '@mui/icons-material/Publish';
import ArchiveIcon from '@mui/icons-material/Archive';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SecurityIcon from '@mui/icons-material/Security';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CodeIcon from '@mui/icons-material/Code';

import { W95TopMenu } from './win95/topmenu';
import { ExploitCapability } from '../services/interfaces/netmd';

import {
    archiveDisc,
    enableFactoryRippingModeInMainUi,
    enterHiMDUnrestrictedMode,
    initializeFactoryMode,
    readToc,
    stripSCMS,
    stripTrProtect,
    toggleSPUploadSpeedup,
    writeModifiedTOC,
} from '../redux/factory/factory-actions';

const useStyles = makeStyles()((theme) => ({
    listItemIcon: {
        minWidth: theme.spacing(5),
    },
    toolTippedText: {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
    },
}));

export const TopMenu = function (props: { tracksSelected?: number[]; onClick?: () => void }) {
    const { classes } = useStyles();
    const dispatch = useDispatch();

    const { mainView, vintageMode, factoryModeRippingInMainUi, factoryModeShortcuts } = useShallowEqualSelector((state) => state.appState);
    const { disc } = useShallowEqualSelector((state) => state.main);
    const { spUploadSpeedupActive } = useShallowEqualSelector((state) => state.factory);
    const discTitle = useShallowEqualSelector((state) => state.main.disc?.title ?? ``);
    const fullWidthDiscTitle = useShallowEqualSelector((state) => state.main.disc?.fullWidthTitle ?? ``);

    const githubLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const helpLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const hiddenFileInputRef = React.useRef<null | HTMLInputElement>(null);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
    const [shortcutsAnchorEl, setShortcutsAnchorEl] = React.useState<null | HTMLElement>(null);
    const [isShiftDown, setIsShiftDown] = React.useState(false);
    const menuOpen = Boolean(menuAnchorEl);
    const shortcutsOpen = Boolean(shortcutsAnchorEl);

    const deviceCapabilities = useDeviceCapabilities();

    const handleMenuOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setIsShiftDown(event.shiftKey);
            setMenuAnchorEl(event.currentTarget);
        },
        [setMenuAnchorEl, setIsShiftDown]
    );

    const handleShortcutsOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            dispatch(initializeFactoryMode());
            setShortcutsAnchorEl(event.currentTarget);
        },
        [setShortcutsAnchorEl, dispatch]
    );

    const handleVintageMode = useCallback(() => {
        dispatch(appActions.setVintageMode(!vintageMode));
    }, [dispatch, vintageMode]);

    const handleShortcutsClose = useCallback(() => {
        setShortcutsAnchorEl(null);
    }, [setShortcutsAnchorEl]);

    const handleMenuClose = useCallback(() => {
        setMenuAnchorEl(null);
        handleShortcutsClose();
    }, [setMenuAnchorEl, handleShortcutsClose]);

    const handleShowSettings = useCallback(() => {
        dispatch(appActions.showSettingsDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleWipeDisc = useCallback(() => {
        dispatch(wipeDisc());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleRefresh = useCallback(() => {
        dispatch(listContent(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleRenameDisc = useCallback(() => {
        dispatch(
            batchActions([
                renameDialogActions.setVisible(true),
                renameDialogActions.setCurrentName(discTitle),
                renameDialogActions.setCurrentFullWidthName(fullWidthDiscTitle),
                renameDialogActions.setIndex(-1),
                renameDialogActions.setRenameType(RenameType.DISC),
            ])
        );
        handleMenuClose();
    }, [dispatch, handleMenuClose, discTitle, fullWidthDiscTitle]);

    const handleSelfTest = useCallback(() => {
        handleMenuClose();
        dispatch(selfTest());
    }, [dispatch, handleMenuClose]);

    const handleExit = useCallback(() => {
        dispatch(appActions.setMainView('WELCOME'));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleShowAbout = useCallback(() => {
        dispatch(appActions.showAboutDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleShowChangelog = useCallback(() => {
        dispatch(appActions.showChangelogDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleGithubLink = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.target !== githubLinkRef.current) {
                // Prevent opening the link twice
                githubLinkRef.current?.click();
            }
            handleMenuClose();
        },
        [handleMenuClose]
    );

    const handleHelpLink = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.target !== helpLinkRef.current) {
                // Prevent opening the link twice
                helpLinkRef.current?.click();
            }
            handleMenuClose();
        },
        [handleMenuClose]
    );

    const handleEnterFactoryMode = useCallback(() => {
        dispatch(factoryNoticeDialogActions.setVisible(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleToggleFactoryModeRippingInMainUi = useCallback(() => {
        if (factoryModeRippingInMainUi) {
            dispatch(appActions.setFactoryModeRippingInMainUi(false));
        } else {
            dispatch(enableFactoryRippingModeInMainUi());
        }
        handleMenuClose();
    }, [dispatch, factoryModeRippingInMainUi, handleMenuClose]);

    const handleExportCSV = useCallback(() => {
        dispatch(exportCSV());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleImportCSV = useCallback(() => {
        hiddenFileInputRef.current?.click();
        handleMenuClose();
    }, [hiddenFileInputRef, handleMenuClose]);

    const handleCSVImportFromFile = useCallback(
        (event: any) => {
            const file = event.target.files[0];
            dispatch(importCSV(file));
            event.target.value = '';
        },
        [dispatch]
    );

    const handleOpenSongRecognition = useCallback(() => {
        dispatch(openRecognizeTrackDialog(props.tracksSelected ?? []));
        handleMenuClose();
    }, [dispatch, handleMenuClose, props.tracksSelected]);

    const menuItems = [],
        shortcutsItems = [];

    // BEGIN HOMEBREW / MAINUI BRIDGE

    const { exploitCapabilities, firmwareVersion } = useShallowEqualSelector((state) => state.factory);

    const isExploitCapable = (expl: ExploitCapability) => exploitCapabilities.includes(expl);

    const handleArchiveDisc = useCallback(async () => {
        handleMenuClose();
        dispatch(dispatchQueue(readToc(), archiveDisc()));
    }, [dispatch, handleMenuClose]);

    const handleStripSCMS = useCallback(() => {
        dispatch(dispatchQueue(readToc(), stripSCMS(), writeModifiedTOC()));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleAllUnprotect = useCallback(() => {
        dispatch(dispatchQueue(readToc(), stripTrProtect(), writeModifiedTOC()));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleToggleSPUploadSpeedup = useCallback(() => {
        dispatch(toggleSPUploadSpeedup());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleEnterHiMDUnrestrictedMode = useCallback(() => {
        dispatch(enterHiMDUnrestrictedMode());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const noDisc = disc === null;

    shortcutsItems.push(
        <MenuItem
            key="short-archive-disc"
            onClick={handleArchiveDisc}
            disabled={!(isExploitCapable(ExploitCapability.downloadAtrac) || deviceCapabilities.trackDownload) || noDisc}
        >
            <ListItemIcon className={classes.listItemIcon}>
                <ArchiveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Archive Disc</ListItemText>
        </MenuItem>
    );
    shortcutsItems.push(
        <MenuItem key="short-kill-scms" onClick={handleStripSCMS} disabled={!isExploitCapable(ExploitCapability.flushUTOC) || noDisc}>
            <ListItemIcon className={classes.listItemIcon}>
                <LockOpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Strip SCMS Information</ListItemText>
        </MenuItem>
    );
    shortcutsItems.push(
        <MenuItem
            key="short-kill-trprotect"
            onClick={handleAllUnprotect}
            disabled={!isExploitCapable(ExploitCapability.flushUTOC) || noDisc}
        >
            <ListItemIcon className={classes.listItemIcon}>
                <SecurityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Un-Protect all tracks</ListItemText>
        </MenuItem>
    );
    shortcutsItems.push(
        <MenuItem
            key="short-speedupSP"
            onClick={handleToggleSPUploadSpeedup}
            disabled={!isExploitCapable(ExploitCapability.spUploadSpeedup)}
        >
            <ListItemIcon className={classes.listItemIcon}>
                {spUploadSpeedupActive ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>
                {spUploadSpeedupActive ? `Disable ` : `Enable `}
                <Tooltip title="On some devices, this can speed up SP upload" arrow>
                    <span className={classes.toolTippedText}>SP Upload Speedup</span>
                </Tooltip>
            </ListItemText>
        </MenuItem>
    );

    if (firmwareVersion.startsWith('H') && !window.native?.himdFullInterface) {
        // HIMD
        shortcutsItems.push(
            <MenuItem
                key="short-himdFullMode"
                onClick={handleEnterHiMDUnrestrictedMode}
                disabled={!isExploitCapable(ExploitCapability.himdFullMode)}
            >
                <ListItemIcon className={classes.listItemIcon}>
                    <ArrowUpwardIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Switch to HiMD unrestricted mode</ListItemText>
            </MenuItem>
        );
    }

    // END HOMEBREW / MAINUI BRIDGE

    if (mainView === 'MAIN' && disc !== null) {
        menuItems.push(
            <MenuItem key="update" onClick={handleRefresh}>
                <ListItemIcon className={classes.listItemIcon}>
                    <RefreshIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Reload TOC</ListItemText>
            </MenuItem>
        );
    }
    if (deviceCapabilities.factoryMode && mainView === 'MAIN') {
        if (factoryModeShortcuts) {
            menuItems.push(
                <MenuItem key="factoryEntryShortcuts" onClick={handleShortcutsOpen}>
                    <ListItemIcon className={classes.listItemIcon}>
                        <MenuOpenIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Homebrew Mode Shortcuts</ListItemText>
                </MenuItem>
            );
        }
        menuItems.push(
            <MenuItem key="factoryEntry" onClick={handleEnterFactoryMode}>
                <ListItemIcon className={classes.listItemIcon}>
                    <CodeIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Enter Homebrew Mode</ListItemText>
            </MenuItem>
        );
    }
    if (mainView === 'MAIN' && disc !== null) {
        menuItems.push(
            <MenuItem key="title" onClick={handleRenameDisc} disabled={!deviceCapabilities.metadataEdit}>
                <ListItemIcon className={classes.listItemIcon}>
                    <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Rename Disc</ListItemText>
            </MenuItem>
        );
        menuItems.push(
            <MenuItem key="wipe" onClick={handleWipeDisc} disabled={!deviceCapabilities.metadataEdit}>
                <ListItemIcon className={classes.listItemIcon}>
                    <DeleteForeverIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Wipe Disc</ListItemText>
            </MenuItem>
        );

        menuItems.push(
            <MenuItem
                key="song-recognition"
                onClick={handleOpenSongRecognition}
                disabled={!deviceCapabilities.playbackControl || !deviceCapabilities.contentList}
            >
                <ListItemIcon className={classes.listItemIcon}>
                    <MusicNoteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Song Recognition</ListItemText>
            </MenuItem>
        );

        menuItems.push(
            <MenuItem key="import-csv" onClick={handleImportCSV} disabled={!deviceCapabilities.metadataEdit}>
                <ListItemIcon className={classes.listItemIcon}>
                    <PublishIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Import titles from CSV</ListItemText>
            </MenuItem>
        );

        menuItems.push(
            <MenuItem key="export-csv" onClick={handleExportCSV}>
                <ListItemIcon className={classes.listItemIcon}>
                    <GetAppIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export titles to CSV</ListItemText>
            </MenuItem>
        );

        menuItems.push(<Divider key="action-divider" />);
        if (deviceCapabilities.factoryMode) {
            menuItems.push(
                <MenuItem key="factoryUnify" onClick={handleToggleFactoryModeRippingInMainUi}>
                    <ListItemIcon className={classes.listItemIcon}>
                        {factoryModeRippingInMainUi ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>
                        {factoryModeRippingInMainUi ? `Disable ` : `Enable `}
                        <Tooltip
                            title="This advanced feature enables RH1-style ripping from the main ui. The homebrew mode's notice still applies."
                            arrow
                        >
                            <span className={classes.toolTippedText}>Homebrew Mode Ripping In Main UI</span>
                        </Tooltip>
                    </ListItemText>
                </MenuItem>
            );
        }
    }

    if (mainView !== 'WELCOME') {
        menuItems.push(
            <MenuItem key="exit" onClick={handleExit}>
                <ListItemIcon className={classes.listItemIcon}>
                    <ExitToAppIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Exit</ListItemText>
            </MenuItem>
        );
    }

    menuItems.push(
        <MenuItem key="settings" onClick={handleShowSettings}>
            <ListItemIcon className={classes.listItemIcon}>
                <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="vintageMode" onClick={handleVintageMode}>
            <ListItemIcon className={classes.listItemIcon}>
                <img alt="Windows 95" src={Win95Icon} width="24px" height="24px" />
            </ListItemIcon>
            <ListItemText>Retro Mode (beta)</ListItemText>
        </MenuItem>
    );

    if (mainView === 'MAIN') {
        if (isShiftDown) {
            menuItems.push(
                <MenuItem key="test" onClick={handleSelfTest}>
                    <ListItemIcon className={classes.listItemIcon}>
                        <BugReportIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Self Test</ListItemText>
                </MenuItem>
            );
        }
        menuItems.push(<Divider key="feature-divider" />);
    }
    menuItems.push(
        <MenuItem key="about" onClick={handleShowAbout}>
            <ListItemIcon className={classes.listItemIcon}>
                <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>About</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="changelog" onClick={handleShowChangelog}>
            <ListItemIcon className={classes.listItemIcon}>
                <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Changelog</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="support" onClick={handleHelpLink}>
            <ListItemIcon className={classes.listItemIcon}>
                <HelpIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
                <Link
                    rel="noopener noreferrer"
                    href="https://www.minidisc.wiki/guides/start"
                    target="_blank"
                    ref={helpLinkRef}
                    onClick={handleHelpLink}
                >
                    Support and FAQ
                </Link>
            </ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="github" onClick={handleGithubLink}>
            <ListItemIcon className={classes.listItemIcon}>
                <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
                <Link
                    rel="noopener noreferrer"
                    href="https://github.com/asivery/webminidisc"
                    target="_blank"
                    ref={githubLinkRef}
                    onClick={handleGithubLink}
                >
                    Fork me on GitHub
                </Link>
            </ListItemText>
        </MenuItem>
    );

    if (vintageMode) {
        const p = {
            mainView,
            onClick: props.onClick,
            handleWipeDisc,
            handleRefresh,
            handleRenameDisc,
            handleExit,
            handleShowAbout,
            handleShowChangelog,
            handleVintageMode,
        };
        return <W95TopMenu {...p} />;
    }
    return (
        <React.Fragment>
            <IconButton aria-label="actions" aria-controls="actions-menu" aria-haspopup="true" onClick={handleMenuOpen}>
                <MoreVertIcon />
            </IconButton>
            <Menu id="actions-menu" anchorEl={menuAnchorEl} keepMounted open={menuOpen} onClose={handleMenuClose}>
                {menuItems}
            </Menu>
            <Menu
                id="factory-actions-submenu"
                anchorEl={shortcutsAnchorEl}
                keepMounted
                open={shortcutsOpen}
                onClose={handleShortcutsClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                {shortcutsItems}
            </Menu>

            <input type="file" accept=".csv" ref={hiddenFileInputRef} style={{ display: 'none' }} onChange={handleCSVImportFromFile} />
        </React.Fragment>
    );
};
