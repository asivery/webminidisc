import React from 'react';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions as appActions } from '../redux/app-feature';
import serviceRegistry from '../services/registry';
import { buildDeviceInfoRows } from './device-info-rows';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { W95DeviceInfoDialog } from './win95/device-info-dialog';
import MiniDiscLogo from '../images/minidisclogo.svg';

export type { DeviceInfoRow } from './device-info-rows';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const DeviceInfoDialog = (props: {}) => {
    const dispatch = useDispatch();

    const visible = useShallowEqualSelector((state) => state.appState.deviceInfoDialogVisible);
    const vintageMode = useShallowEqualSelector((state) => state.appState.vintageMode);
    const { deviceName, deviceInfo, disc } = useShallowEqualSelector((state) => state.main);

    const handleClose = () => {
        dispatch(appActions.showDeviceInfoDialog(false));
    };

    const title = deviceName || 'Connected device';
    const rows = buildDeviceInfoRows(deviceName, deviceInfo, disc, serviceRegistry.netmdSpec);

    if (vintageMode) {
        const p = {
            visible,
            handleClose,
            title,
            imageUrl: MiniDiscLogo,
            rows,
        };
        return <W95DeviceInfoDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="device-info-dialog-slide-title"
        >
            <DialogTitle id="device-info-dialog-slide-title">{title}</DialogTitle>
            <DialogContent>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <img src={MiniDiscLogo} alt="MiniDisc" style={{ width: 180, maxWidth: '100%' }} />
                    <Table size="small" style={{ flex: 1, minWidth: 240 }}>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.label}>
                                    <TableCell component="th" scope="row" style={{ fontWeight: 'bold', width: 130 }}>
                                        {row.label}
                                    </TableCell>
                                    <TableCell>{row.value}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};
