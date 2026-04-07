import React, { useCallback, useState } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { deleteService, pair } from '../redux/actions';

import { useShallowEqualSelector } from '../frontend-utils';

import { makeStyles } from 'tss-react/mui';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';

import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { TopMenu } from './topmenu';
import ChromeIconPath from '../images/chrome-icon.svg';
import { W95Welcome } from './win95/welcome';

import SplitButton, { OptionType } from './split-button';
import {
    createService,
    doesServiceRequireChrome,
    getConnectButtonName,
    getServiceSpec,
    getSimpleServices,
    Services,
} from '../services/interface-service-manager';

import { OtherDeviceDialog } from './other-device-dialog';
import { SettingsDialog } from './settings-dialog';
import { ChangelogDialog } from './changelog-dialog';
import { AboutDialog } from './about-dialog';

import { actions as otherDialogActions } from '../redux/other-device-feature';
import { actions as appActions } from '../redux/app-feature';
import { initializeParameters } from '../custom-parameters';

const useStyles = makeStyles()((theme) => ({
    main: {
        position: 'relative',
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
    buttonBox: {
        marginTop: theme.spacing(3),
        minWidth: 200,
    },
    deleteButton: {
        width: theme.spacing(2),
        height: theme.spacing(2),
        verticalAlign: 'middle',
        marginLeft: theme.spacing(-0.5),
        marginRight: theme.spacing(1.5),
    },
    standardOption: {
        marginLeft: theme.spacing(3),
    },
    spacing: {
        marginTop: theme.spacing(1),
    },
    notice: {
        marginTop: theme.spacing(2),
        backgroundColor: 'unset',
    },
    chromeLogo: {
        marginTop: theme.spacing(1),
        width: 96,
        height: 96,
    },
    why: {
        alignSelf: 'flex-start',
        marginTop: theme.spacing(3),
    },
    headBox: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    connectContainer: {
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
    supportContainer: {
        flex: '1 1 auto',
        display: 'flex',
        justifyContent: 'center',
        flexDirection: 'column',
        alignItems: 'center',
    },
}));

export const Welcome = (props: {}) => {
    const { classes } = useStyles();
    const dispatch = useDispatch();
    const {
        browserSupported,
        runningChrome,
        availableServices,
        pairingFailed,
        pairingMessage,
        vintageMode,
        lastSelectedService,
        connectingInProgress,
    } = useShallowEqualSelector((state) => state.appState);
    const simpleServicesLength = getSimpleServices().length;
    if (pairingMessage.toLowerCase().match(/denied/)) {
        // show linux instructions
    }
    // Access denied.

    const deleteCustom = useCallback(
        (event: React.SyntheticEvent, index: number) => {
            event.stopPropagation();
            dispatch(deleteService(index));
        },
        [dispatch]
    );

    const [showWhyUnsupported, setWhyUnsupported] = useState(false);
    const handleLearnWhy = (event: React.SyntheticEvent) => {
        event.preventDefault();
        setWhyUnsupported(true);
    };

    const forceContinue = (event: React.SyntheticEvent) => {
        event.preventDefault();
        dispatch(appActions.setBrowserSupported(true));
    };

    if (vintageMode) {
        const p = {
            dispatch,
            pairingFailed,
            pairingMessage,
            createService: () => createService(availableServices[lastSelectedService]) ?? null,
            spec: getServiceSpec(availableServices[lastSelectedService])!,
            connectName: getConnectButtonName(availableServices[lastSelectedService]),
        };
        return <W95Welcome {...p}></W95Welcome>;
    }

    const options: OptionType[] = availableServices.map((n, i) => ({
        name: getConnectButtonName(n),
        switchTo: true,
        handler: () => {
            const instance = createService(availableServices[i]);
            if (instance) {
                dispatch(appActions.setLastSelectedService(i));
                dispatch(pair(instance, getServiceSpec(availableServices[i])!));
            }
        },
        id: i,
        disabled: !runningChrome && doesServiceRequireChrome(availableServices[i]),
    }));

    const firstService = Services.find((n) => n.customParameters);
    if (firstService) {
        options.push({
            name: 'Add Custom Device',
            switchTo: false,
            handler: () =>
                dispatch(
                    batchActions([
                        otherDialogActions.setVisible(true),
                        otherDialogActions.setSelectedServiceIndex(0),
                        otherDialogActions.setCustomParameters(initializeParameters(firstService.customParameters)),
                    ])
                ),
            customAddIcon: true,
        });
    }

    const mapToEntry = (option: OptionType) => {
        return option.id >= simpleServicesLength ? (
            <React.Fragment>
                <IconButton aria-label="delete" className={classes.deleteButton} size="small" onClick={(e) => deleteCustom(e, option.id)}>
                    <DeleteIcon />
                </IconButton>
                {option.name}
            </React.Fragment>
        ) : option.customAddIcon ? (
            <React.Fragment>
                <IconButton aria-label="add custom device" className={classes.deleteButton} size="small">
                    <AddIcon />
                </IconButton>
                {option.name}
            </React.Fragment>
        ) : (
            <span className={classes.standardOption}>{option.name}</span>
        );
    };

    return (
        <React.Fragment>
            <Box className={classes.headBox}>
                <Typography component="h1" variant="h4">
                    Web MiniDisc Pro
                </Typography>
                <TopMenu />
            </Box>
            <Typography component="h2" variant="body2">
                Brings NetMD Devices to the Web
            </Typography>
            <Box className={classes.main}>
                {browserSupported ? (
                    <React.Fragment>
                        <div className={classes.connectContainer}>
                            <Typography component="h2" variant="subtitle1" align="center" className={classes.spacing}>
                                Press the button to connect to a NetMD device
                            </Typography>

                            <SplitButton
                                options={options}
                                color="primary"
                                boxClassName={classes.buttonBox}
                                width={200}
                                disabled={Services[lastSelectedService].requiresChrome && !runningChrome}
                                selectedIndex={lastSelectedService}
                                dropdownMapping={mapToEntry}
                                loading={connectingInProgress}
                            />

                            <FormControl
                                error={true}
                                className={classes.spacing}
                                style={{ visibility: pairingFailed ? 'visible' : 'hidden' }}
                            >
                                <FormHelperText>{pairingMessage}</FormHelperText>
                            </FormControl>
                            {!window.native?.interface && (
                                <Tooltip
                                    title={
                                        <span>
                                            Vivaldi's implementation of WebUSB is broken.
                                            <br />
                                            If you are using Vivaldi, most of this app's features will be broken.
                                            <br />
                                            Please switch to a different Chromium-based browser.
                                        </span>
                                    }
                                >
                                    <Alert severity="info" className={classes.notice}>
                                        <b>Notice for users of the Vivaldi web browser</b> <br />
                                    </Alert>
                                </Tooltip>
                            )}
                        </div>
                        <div>
                            <Typography component="h2" variant="subtitle1" align="center" className={classes.spacing}>
                                <Link rel="noopener noreferrer" target="_blank" href="https://www.minidisc.wiki/guides/webminidisc">
                                    <span style={{ verticalAlign: 'middle' }}>First time here? Read the guide</span>{' '}
                                    <OpenInNewIcon style={{ verticalAlign: 'middle' }} fontSize="inherit" />
                                </Link>
                            </Typography>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <Typography component="h2" variant="subtitle1" align="center" className={classes.spacing}>
                            This Web browser is not supported.&nbsp;
                            <Link rel="noopener noreferrer" href="#" onClick={handleLearnWhy}>
                                Learn Why
                            </Link>
                        </Typography>

                        <Link rel="noopener noreferrer" target="_blank" href="https://www.google.com/chrome/">
                            <img alt="Chrome Logo" src={ChromeIconPath} className={classes.chromeLogo} />
                        </Link>

                        <Typography component="h2" variant="subtitle1" align="center" className={classes.spacing}>
                            Try using{' '}
                            <Link rel="noopener noreferrer" target="_blank" href="https://www.google.com/chrome/">
                                Chrome
                            </Link>{' '}
                            instead
                        </Typography>

                        <Typography component="p" variant="subtitle1" align="center" className={classes.spacing}>
                            If you want to connect to a remote device, click{' '}
                            <Link rel="noopener noreferrer" href="#" onClick={forceContinue}>
                                here
                            </Link>{' '}
                            to load the app anyway.
                        </Typography>

                        {showWhyUnsupported ? (
                            <>
                                <Typography component="p" variant="body2" className={classes.why}>
                                    Web MiniDisc Pro requires a browser that supports both{' '}
                                    <Link rel="noopener noreferrer" target="_blank" href="https://wicg.github.io/webusb/">
                                        WebUSB
                                    </Link>{' '}
                                    and{' '}
                                    <Link rel="noopener noreferrer" target="_blank" href="https://webassembly.org/">
                                        WebAssembly
                                    </Link>
                                    .
                                </Typography>
                                <ul>
                                    <li>WebUSB is needed to control the NetMD device via the USB connection to your computer.</li>
                                    <li>WebAssembly is used to convert the music to a MiniDisc compatible format</li>
                                </ul>
                            </>
                        ) : null}
                    </React.Fragment>
                )}
            </Box>
            <SettingsDialog />
            <AboutDialog />
            <ChangelogDialog />
            <OtherDeviceDialog />
        </React.Fragment>
    );
};

export default Welcome;
