import React, { useCallback, useEffect, useRef, useState } from 'react';
import { forAnyDesktop, forWideDesktop, useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions as appActions } from '../redux/app-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import { makeStyles } from 'tss-react/mui';
import { Button, IconButton, List, ListItem, ListItemText, Tooltip } from '@mui/material';
import { AudioEncoderV1Metadata } from '../services/audio/apiv1/external-interface';
import { DYNAMIC_ENCODER_SAR_SUBMAGIC, EncoderStorageManager } from '../services/audio/apiv1/dynamic-encoders';
import { DeleteForever } from '@mui/icons-material';
import { validateAndLoadEncoders } from '../redux/actions';
import { SARFile } from '../services/audio/apiv1/external-archive';

const useStyles = makeStyles()((theme) => ({
    main: {
        [forAnyDesktop(theme)]: {
            height: 600,
        },
        [forWideDesktop(theme)]: {
            height: 700,
        },
        display: 'flex',
        flexDirection: 'column',
    },
    mainList: {
        flexGrow: 1,
    },
    dialogButtons: {
        justifyContent: 'space-between',
    },
    virtuallyDisabled: {
        cursor: 'default',
        filter: 'brightness(0.5)',
    },
}));

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const ManageEncodersDialog = (props: {}) => {
    const { classes } = useStyles();
    const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

    const { manageEncodersDialogVisible: visible } = useShallowEqualSelector((state) => state.appState);
    const dispatch = useDispatch();

    const handleClose = useCallback(() => {
        dispatch(appActions.showManageEncodersDialog(false));
    }, [dispatch]);

    const [installedEncodersMetadata, setInstalledEncodersMetadata] = useState<ReturnType<typeof EncoderStorageManager['INSTANCE']['listAvailableEncodersMetadata']>>([]);

    const reloadInstalledEncoders = useCallback(() => {
        setInstalledEncodersMetadata(EncoderStorageManager.INSTANCE.listAvailableEncodersMetadata());
    }, [setInstalledEncodersMetadata]);

    useEffect(() => {
        if(visible) {
            reloadInstalledEncoders();
        }
    }, [visible, reloadInstalledEncoders]);

    const handleInstallNewEncoder = useCallback(() => {
        hiddenFileInputRef.current!.click();
    }, [hiddenFileInputRef]);

    const handleDeleteEncoder = useCallback((encoderId: string) => {
        const deps = EncoderStorageManager.INSTANCE.buildReverseDependentsList(encoderId);
        if(window.confirm(`You are going to delete the following encoders:\n${deps.join(', ')}\nDo you want to continue?`)) {
            EncoderStorageManager.INSTANCE.uninstallEncoders(deps);
            dispatch(validateAndLoadEncoders(false));
            reloadInstalledEncoders();
        }
    }, [dispatch, setInstalledEncodersMetadata, reloadInstalledEncoders]);

    const handleInstallLocalEncoders = useCallback(async () => {
        for(let i = 0; i < (hiddenFileInputRef.current!.files?.length ?? 0); i++) {
            const file = hiddenFileInputRef.current!.files!.item(i);
            const buffer = await file!.arrayBuffer();
            const contents = new Uint8Array(buffer);
            const sarSubMagic = SARFile.readSubMagicOfArchve(contents);
            if(sarSubMagic !== DYNAMIC_ENCODER_SAR_SUBMAGIC) {
                window.alert(`Not a valid Web MiniDisc Encoder: ${file?.name}`);
                continue;
            }
            // Since we don't have any encoders which have dependencies yet, it's possible
            // to just install without checking any dependencies.
            await EncoderStorageManager.INSTANCE.installEncoderSkipDependencyCheck(contents, false);
        }
        reloadInstalledEncoders();
        hiddenFileInputRef.current!.value = '';
    }, [hiddenFileInputRef, reloadInstalledEncoders]);

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            classes={{ paper: classes.main }}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="manage-encoder-dialog-slide-title"
        >
            <DialogTitle id="manage-encoder-dialog-slide-title">Installed encoders</DialogTitle>
            <DialogContent>
                <input type="file" ref={hiddenFileInputRef} style={{ display: 'none' }} onChange={handleInstallLocalEncoders} multiple={true} />
                <List className={classes.mainList}>
                    {installedEncodersMetadata.map((e, i) => (
                        <ListItem
                            key={`installed-encoder-${i}`}
                            secondaryAction={
                                e.isServerProvided ? (
                                    <Tooltip title="Server-provided encoder">
                                        <IconButton disableRipple={true} className={classes.virtuallyDisabled} edge="end" aria-label="delete">
                                            <DeleteForever />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    <IconButton onClick={() => handleDeleteEncoder(e.encoderId)} edge="end" aria-label="delete">
                                        <DeleteForever />
                                    </IconButton>
                                )
                            }
                        >
                            <ListItemText
                                primary={e.userFriendlyName}
                                secondary={e.description}
                            />
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions className={classes.dialogButtons}>
                <Button onClick={handleInstallNewEncoder}>
                    Install new
                </Button>
                <Button onClick={handleClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};
