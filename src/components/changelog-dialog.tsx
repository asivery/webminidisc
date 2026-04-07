import React, { ReactNode, useCallback, useMemo } from 'react';
import { useDispatch } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';

import { actions as appActions } from '../redux/app-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { makeStyles } from 'tss-react/mui';
import { W95ChangelogDialog } from './win95/changelog-dialog';
import { CHANGELOG } from '../changelog';
import { ChangelogEntry } from '../bridge-types';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        flexDirection: 'row',
    },
    formControl: {
        minWidth: 60,
    },
    toggleButton: {
        minWidth: 40,
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
        height: 400,
    },
    header: {
        margin: 0,
    },
    list: {
        marginTop: 0,
    },
}));

export const ChangelogDialog = (props: {}) => {
    const dispatch = useDispatch();
    const { classes } = useStyles();

    const vintageMode = useShallowEqualSelector((state) => state.appState.vintageMode);
    const visible = useShallowEqualSelector((state) => state.appState.changelogDialogVisible);

    const handleClose = useCallback(() => {
        localStorage.setItem('version', (window as any).wmdVersion);
        dispatch(appActions.showChangelogDialog(false));
    }, [dispatch]);

    const handleOpenEncoderSettings = useCallback(() => {
        dispatch(appActions.showSettingsDialog(true));
    }, [dispatch]);

    const content = useMemo(() => {
        const changelog = [...CHANGELOG];

        // Merge with wrapper (ElectronWMD) changelog
        if (window.native?.wrapperChangelog) {
            main: for (let injection of window.native.wrapperChangelog) {
                if (injection.before === null) {
                    changelog.push(injection.entry);
                } else {
                    for (let i = 0; i < changelog.length; i++) {
                        if (changelog[i].name === injection.before) {
                            changelog.splice(i, 0, injection.entry);
                            continue main;
                        }
                    }
                    // Hasn't continued main - reached end of iteration
                    console.log(`Warning - Cannot merge changelogs - unknown version ${injection.before}!`);
                }
            }
        }

        // Render the changelog.
        let content: ReactNode[] = [];

        function renderElement(element: ChangelogEntry): ReactNode {
            if (typeof element === 'string') return element;
            if (Array.isArray(element)) {
                // An array of inlined elements to be concatenated together
                return (
                    <>
                        {element.map((e, i) => (
                            <React.Fragment key={i}>{renderElement(e)}</React.Fragment>
                        ))}
                    </>
                );
            }
            if (element.type === 'code') return <code>{element.content}</code>;
            if (element.type === 'link') {
                let onClickHandler = undefined;
                if (element.clickHandler === 'openSettings') {
                    onClickHandler = handleOpenEncoderSettings;
                }
                return (
                    <Link href={element.url} onClick={onClickHandler}>
                        {element.content}
                    </Link>
                );
            }
            if (element.type === 'sublist') {
                return (
                    <>
                        {element.name}
                        {renderList(element.content)}
                    </>
                );
            }
        }

        function renderList(elements: ChangelogEntry[]) {
            return (
                <ul>
                    {elements.map((e, i) => (
                        <li key={i}>{renderElement(e)}</li>
                    ))}
                </ul>
            );
        }

        for (let version of changelog) {
            content.push(
                <React.Fragment key={version.name}>
                    <h2 className={classes.header}>{version.name}</h2>
                    {renderList(version.contents)}
                </React.Fragment>
            );
        }

        return <>{content}</>;
    }, [handleOpenEncoderSettings, classes]);

    if (vintageMode) {
        const p = {
            visible,
            handleClose,
            content,
        };
        return <W95ChangelogDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'xs'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="changelog-dialog-slide-title"
            aria-describedby="changelog-dialog-slide-description"
        >
            <DialogTitle id="changelog-dialog-slide-title">Changelog</DialogTitle>
            <DialogContent className={classes.dialogContent}>{content}</DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};
