import React, { useState, useEffect } from 'react';
import { Capability } from '../services/interfaces/netmd';
import { useShallowEqualSelector } from '../frontend-utils';

import FormHelperText from '@mui/material/FormHelperText';
import { Controls } from './controls';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginRight: -theme.spacing(2),
        flexFlow: 'wrap',
    },
    formControl: {
        minWidth: 120,
    },
    selectEmpty: {
        marginTop: theme.spacing(2),
    },
    // Deck's transport bar gets its own full-width row; its main-screen negative margin is cancelled here.
    deckControls: {
        flexBasis: '100%',
        marginTop: theme.spacing(2),
        marginRight: theme.spacing(2),
        '& > div': { marginRight: 0 },
    },
    factoryModeNotice: {
        marginBottom: theme.spacing(2),
        fontWeight: 'bold',
    },
}));

export function LineInDeviceSelect({ handleChange, inputDeviceId }: { handleChange: (ev: any) => void; inputDeviceId: string }) {
    const { classes } = useStyles();

    const { deviceCapabilities } = useShallowEqualSelector((state) => state.main);
    const deckMode = useShallowEqualSelector((state) => state.appState.deckMode);
    const [devices, setInputDevices] = useState<{ deviceId: string; label: string }[]>([]);

    useEffect(() => {
        async function updateDeviceList() {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputDevices = devices
                .filter((device) => device.kind === 'audioinput')
                .map((device) => ({ deviceId: device.deviceId, label: device.label }));
            setInputDevices(inputDevices);
        }
        updateDeviceList();
    }, [setInputDevices]);
    return (
        <React.Fragment>
            {deviceCapabilities.includes(Capability.factoryMode) && (
                <Typography component="h4" variant="body2" className={classes.factoryModeNotice}>
                    It looks like this player supports the homebrew mode - it might be capable of RH1-style digital transfer. Please check
                    the homebrew mode for more information.
                </Typography>
            )}

            <Typography component="p" variant="body2">
                1. Connect your MD Player line-out to your PC audio line-in.
            </Typography>
            <Typography component="p" variant="body2">
                2. Use the controls at the bottom right to play some tracks.
            </Typography>
            <Typography component="p" variant="body2">
                3. Select the input source. You should hear the tracks playing on your PC.
            </Typography>
            <Typography component="p" variant="body2">
                4. Adjust the input gain and the line-out volume of your device.
            </Typography>
            <Box className={classes.container}>
                <FormControl className={classes.formControl}>
                    <Select value={inputDeviceId} onChange={handleChange} displayEmpty className={classes.selectEmpty}>
                        <MenuItem value="" disabled>
                            Input Source
                        </MenuItem>
                        {devices.map((device) => (
                            <MenuItem key={device.deviceId} value={device.deviceId}>
                                {device.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>Input Source</FormHelperText>
                </FormControl>
                {deckMode ? (
                    <div className={classes.deckControls}>
                        <Controls />
                    </div>
                ) : (
                    <Controls />
                )}
            </Box>
        </React.Fragment>
    );
}
