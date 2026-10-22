import React, { useCallback } from 'react';
import { useDispatch } from '../../frontend-utils';

import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import { MoreVert as MoreVertIcon } from '@mui/icons-material'

import {
    downloadRam,
    downloadRom,
    downloadToc,
    uploadToc,
    readToc,
    runTetris,
    stripSCMS,
    archiveDisc,
    toggleSPUploadSpeedup,
    stripTrProtect,
    enterHiMDUnrestrictedMode,
    toggleDiscSwapDetection,
    enterServiceMode,
} from '../../redux/factory/factory-actions';
import { actions as appActions } from '../../redux/app-feature';
import { actions as factoryEditOtherValuesDialogActions } from '../../redux/factory/factory-edit-other-values-dialog-feature';
import { useShallowEqualSelector } from "../../frontend-utils";
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { makeStyles } from 'tss-react/mui';

import { Refresh as RefreshIcon } from '@mui/icons-material'
import { GitHub as GitHubIcon } from '@mui/icons-material'
import { ExitToApp as ExitToAppIcon } from '@mui/icons-material'
import { ToggleOff as ToggleOffIcon } from '@mui/icons-material'
import { ToggleOn as ToggleOnIcon } from '@mui/icons-material'
import { Help as HelpIcon } from '@mui/icons-material'
import { Memory as MemoryIcon } from '@mui/icons-material'
import { Code as CodeIcon } from '@mui/icons-material'
import { GetApp as GetAppIcon } from '@mui/icons-material'
import { Publish as PublishIcon } from '@mui/icons-material'
import { Games as GamesIcon } from '@mui/icons-material'
import { Security as SecurityIcon } from '@mui/icons-material'
import { NoEncryption as NoEncryptionIcon } from '@mui/icons-material'
import { Archive as ArchiveIcon } from '@mui/icons-material'
import { LockOpen as LockOpenIcon } from '@mui/icons-material'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { HomeRepairService as HomeRepairServiceIcon } from '@mui/icons-material'
import { DiscFull as DiscFullIcon } from '@mui/icons-material'

import { Capability, ExploitCapability } from '../../services/interfaces/netmd';

const useStyles = makeStyles()(theme => ({
    listItemIcon: {
        minWidth: theme.spacing(5),
    },
    toolTippedText: {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
    },
}));

export const FactoryTopMenu = function(props: { onClick?: () => void }) {
    const { classes } = useStyles();
    const dispatch = useDispatch();

    const { exploitCapabilities, spUploadSpeedupActive, deviceDiscSwapDetectionDisabled } = useShallowEqualSelector(state => state.factory);
    const { deviceCapabilities } = useShallowEqualSelector(state => state.main);

    const githubLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const helpLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const hiddenFileInputRef = React.useRef<null | HTMLInputElement>(null);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
    const [submenuAnchorEl, setSubmenuAnchorEl] = React.useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);
    const submenuOpen = Boolean(submenuAnchorEl);

    const handleMenuOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setMenuAnchorEl(event.currentTarget);
        },
        [setMenuAnchorEl]
    );

    const handleSubmenuOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setSubmenuAnchorEl(event.currentTarget);
        },
        [setSubmenuAnchorEl]
    );

    const handleMenuClose = useCallback(() => {
        setMenuAnchorEl(null);
    }, [setMenuAnchorEl]);

    const handleSubmenuClose = useCallback(() => {
        setSubmenuAnchorEl(null);
        handleMenuClose();
    }, [setSubmenuAnchorEl, handleMenuClose]);

    const handleShowSettings = useCallback(() => {
        dispatch(appActions.showSettingsDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleExit = useCallback(() => {
        dispatch(appActions.setMainView('MAIN'));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleTOCUpload = useCallback(
        (event: any) => {
            const file = event.target.files[0];
            dispatch(uploadToc(file));
        },
        [dispatch]
    );

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

    const handleFactoryRefresh = useCallback(() => {
        dispatch(readToc());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleEditOtherToCValues = useCallback(() => {
        dispatch(factoryEditOtherValuesDialogActions.setVisible(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleReadRAM = useCallback(() => {
        dispatch(downloadRam());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleReadFirmware = useCallback(() => {
        dispatch(downloadRom());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleDownloadTOC = useCallback(() => {
        dispatch(downloadToc());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleUploadTOC = useCallback(() => {
        hiddenFileInputRef.current?.click();
        handleMenuClose();
    }, [hiddenFileInputRef, handleMenuClose]);

    const handlePlayTetris = useCallback(() => {
        dispatch(runTetris());
        dispatch(appActions.setMainView('WELCOME'));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleArchiveDisc = useCallback(() => {
        dispatch(archiveDisc());
        handleSubmenuClose();
    }, [dispatch, handleSubmenuClose]);

    const handleStripSCMS = useCallback(() => {
        dispatch(stripSCMS());
        handleSubmenuClose();
    }, [dispatch, handleSubmenuClose]);

    const handleAllUnprotect = useCallback(() => {
        dispatch(stripTrProtect());
        handleSubmenuClose();
    }, [dispatch, handleSubmenuClose]);

    const handleEnterHiMDUnrestrictedMode = useCallback(() => {
        dispatch(enterHiMDUnrestrictedMode());
        handleSubmenuClose();
    }, [dispatch, handleSubmenuClose]);

    const handleToggleSPUploadSpeedup = useCallback(() => {
        dispatch(toggleSPUploadSpeedup());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleToggleDiscSwapDetection = useCallback(() => {
        dispatch(toggleDiscSwapDetection());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleEnterServiceMode = useCallback(() => {
        dispatch(enterServiceMode());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const menuItems = [];
    menuItems.push(
        <MenuItem key="update" onClick={handleFactoryRefresh}>
            <ListItemIcon className={classes.listItemIcon}>
                <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Reload TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="editOtherTOC" onClick={handleEditOtherToCValues}>
            <ListItemIcon className={classes.listItemIcon}>
                <MemoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Other TOC values</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="toolbox" onClick={handleSubmenuOpen}>
            <ListItemIcon className={classes.listItemIcon}>
                <MoreVertIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Toolbox</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="feature-divider-himd" />);

    if (!window.native?.himdFullInterface) {
        menuItems.push(
            <MenuItem
                key="himdFullMode"
                onClick={handleEnterHiMDUnrestrictedMode}
                disabled={!exploitCapabilities.includes(ExploitCapability.himdFullMode)}
            >
                <ListItemIcon className={classes.listItemIcon}>
                    <NoEncryptionIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Switch to HiMD unrestricted mode</ListItemText>
            </MenuItem>
        );
    }

    menuItems.push(<Divider key="feature-divider-1" />);
    menuItems.push(
        <MenuItem key="readRAM" onClick={handleReadRAM} disabled={!exploitCapabilities.includes(ExploitCapability.readRam)}>
            <ListItemIcon className={classes.listItemIcon}>
                <MemoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Read RAM</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="readROM" onClick={handleReadFirmware} disabled={!exploitCapabilities.includes(ExploitCapability.readFirmware)}>
            <ListItemIcon className={classes.listItemIcon}>
                <CodeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Read Firmware</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="feature-divider-2" />);
    menuItems.push(
        <MenuItem key="downloadTOC" onClick={handleDownloadTOC}>
            <ListItemIcon className={classes.listItemIcon}>
                <GetAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="uploadTOC" onClick={handleUploadTOC}>
            <ListItemIcon className={classes.listItemIcon}>
                <PublishIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Upload TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="feature-divider-3" />);
    menuItems.push(
        <MenuItem
            key="speedupSP"
            onClick={handleToggleSPUploadSpeedup}
            disabled={!exploitCapabilities.includes(ExploitCapability.spUploadSpeedup)}
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
    menuItems.push(
        <MenuItem key="playTetris" onClick={handlePlayTetris} disabled={!exploitCapabilities.includes(ExploitCapability.runTetris)}>
            <ListItemIcon className={classes.listItemIcon}>
                <GamesIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Play TETRIS!</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="feature-divider-4" />);
    menuItems.push(
        <MenuItem key="settings" onClick={handleShowSettings}>
            <ListItemIcon className={classes.listItemIcon}>
                <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="exit" onClick={handleExit}>
            <ListItemIcon className={classes.listItemIcon}>
                <ExitToAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Exit homebrew mode</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="action-divider" />);
    menuItems.push(
        <MenuItem key="support" onClick={handleHelpLink}>
            <ListItemIcon className={classes.listItemIcon}>
                <HelpIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
                <Link
                    rel="noopener noreferrer"
                    href="https://minidisc.wiki/guides/webminidisc"
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

    const submenuItems = [];
    submenuItems.push(
        <MenuItem key="kill-scms" onClick={handleStripSCMS}>
            <ListItemIcon className={classes.listItemIcon}>
                <LockOpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Strip SCMS Information</ListItemText>
        </MenuItem>
    );
    submenuItems.push(
        <MenuItem key="kill-trprotect" onClick={handleAllUnprotect}>
            <ListItemIcon className={classes.listItemIcon}>
                <SecurityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Un-Protect all tracks</ListItemText>
        </MenuItem>
    );
    submenuItems.push(
        <MenuItem
            key="archive-disc"
            onClick={handleArchiveDisc}
            disabled={
                !(exploitCapabilities.includes(ExploitCapability.readFirmware) || deviceCapabilities.includes(Capability.trackDownload))
            }
        >
            <ListItemIcon className={classes.listItemIcon}>
                <ArchiveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Archive Disc</ListItemText>
        </MenuItem>
    );
    submenuItems.push(
        <MenuItem
            key="disable-disc-swap"
            onClick={handleToggleDiscSwapDetection}
            disabled={!(exploitCapabilities.includes(ExploitCapability.disableDiscSwapDetection))}
        >
            <ListItemIcon className={classes.listItemIcon}>
                {deviceDiscSwapDetectionDisabled ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{deviceDiscSwapDetectionDisabled ? 'Enable' : 'Disable'} disc swap detection</ListItemText>
        </MenuItem>
    );
    submenuItems.push(
        <MenuItem
            key="enter-service-mode"
            onClick={handleEnterServiceMode}
            disabled={!(exploitCapabilities.includes(ExploitCapability.enterServiceMode))}
        >
            <ListItemIcon className={classes.listItemIcon}>
                <HomeRepairServiceIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Enter Service Mode</ListItemText>
        </MenuItem>
    );

    return (
        <React.Fragment>
            <IconButton aria-label="actions" aria-controls="actions-menu" aria-haspopup="true" onClick={handleMenuOpen}>
                <MoreVertIcon />
            </IconButton>
            <Menu id="factory-actions-menu" anchorEl={menuAnchorEl} keepMounted open={menuOpen} onClose={handleMenuClose}>
                {menuItems}
            </Menu>
            <Menu
                id="factory-actions-submenu"
                anchorEl={submenuAnchorEl}
                keepMounted
                open={submenuOpen}
                onClose={handleSubmenuClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                {submenuItems}
            </Menu>
            <input type="file" ref={hiddenFileInputRef} style={{ display: 'none' }} onChange={handleTOCUpload} />
        </React.Fragment>
    );
};
