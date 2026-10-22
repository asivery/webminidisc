import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, batchActions } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';
import { actions as otherDeviceActions } from '../redux/other-device-feature';

import { makeStyles } from 'tss-react/mui';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { Services } from '../services/interface-service-manager';
import { addService } from '../redux/actions';
import { isAllValid, initializeParameters } from '../custom-parameters';
import { CustomParameterRendered } from './custom-parameters-renderer';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles()((theme) => ({
    marginUpDown: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    select: {
        minWidth: '100%',
        marginBottom: theme.spacing(2),
    },
    fullWidth: {
        minWidth: '100%',
    },
}));

export const OtherDeviceDialog = (props: {}) => {
    const dispatch = useDispatch();
    const { classes } = useStyles();

    const otherDeviceDialogVisible = useShallowEqualSelector((state) => state.otherDeviceDialog.visible);
    const otherDeviceDialogSelectedServiceIndex = useShallowEqualSelector((state) => state.otherDeviceDialog.selectedServiceIndex);
    const otherDeviceDialogCustomParameters = useShallowEqualSelector((state) => state.otherDeviceDialog.customParameters);

    const customServices = Services.filter((n) => n.customParameters);
    const currentService = customServices[otherDeviceDialogSelectedServiceIndex];

    const handleClose = useCallback(() => {
        dispatch(otherDeviceActions.setVisible(false));
    }, [dispatch]);

    const handleAdd = useCallback(() => {
        dispatch(otherDeviceActions.setVisible(false));
        dispatch(
            addService({
                name: currentService.name,
                parameters: otherDeviceDialogCustomParameters,
            })
        );
    }, [dispatch, otherDeviceDialogCustomParameters, currentService]);

    const [addButtonDisabled, setAddButtonDisabled] = useState(false);

    const handleServiceSelectionChanged = useCallback(
        (event: any) => {
            dispatch(
                batchActions([
                    otherDeviceActions.setSelectedServiceIndex(event.target.value as number),
                    otherDeviceActions.setCustomParameters(
                        initializeParameters(customServices[event.target.value as number].customParameters)
                    ),
                ])
            );
        },
        [dispatch, customServices]
    );

    const handleParameterChange = useCallback(
        (varName: string, value: string | number | boolean) => {
            const newData = { ...otherDeviceDialogCustomParameters };
            newData[varName] = value;
            dispatch(otherDeviceActions.setCustomParameters(newData));
        },
        [dispatch, otherDeviceDialogCustomParameters]
    );

    useEffect(
        () => setAddButtonDisabled(!isAllValid(currentService.customParameters!, otherDeviceDialogCustomParameters)),
        [otherDeviceDialogCustomParameters, currentService.customParameters]
    );

    return (
        <Dialog
            open={otherDeviceDialogVisible}
            onClose={handleClose}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition}
            aria-labelledby="rename-dialog-title"
        >
            <DialogTitle id="rename-dialog-title">Add Custom Device</DialogTitle>
            <DialogContent>
                <Select
                    onChange={handleServiceSelectionChanged}
                    value={otherDeviceDialogSelectedServiceIndex}
                    className={classes.select}
                    label="Service"
                >
                    {customServices.map((n, i) => (
                        <MenuItem value={i} key={`${i}`}>
                            {n.name}
                        </MenuItem>
                    ))}
                </Select>
                {currentService.description}
                <div className={classes.fullWidth}>
                    {currentService.customParameters!.map((n) =>
                        <CustomParameterRendered
                            parameter={n}
                            values={otherDeviceDialogCustomParameters}
                            parameterChangeCallback={handleParameterChange} />
                    )}
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button color={'primary'} onClick={handleAdd} disabled={addButtonDisabled}>
                    Add
                </Button>
            </DialogActions>
        </Dialog>
    );
};
