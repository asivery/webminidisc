import React from 'react';
import { makeStyles } from 'tss-react/mui';
import Tooltip from '@mui/material/Tooltip';
import { ChevronDown, ExternalLink, Plus, Trash2 } from 'lucide-react';

import { CHANGELOG } from '../../changelog';
import { TopMenu } from '../topmenu';
import SplitButton, { OptionType } from '../split-button';
import { SettingsDialog } from '../settings-dialog';
import { ManageEncodersDialog } from '../manage-encoders-dialog';
import { AboutDialog } from '../about-dialog';
import { ChangelogDialog } from '../changelog-dialog';
import { OtherDeviceDialog } from '../other-device-dialog';
import { DeckKey, DeckMark, DeckNotice, DeckPill, useDeckType, AMBER_SOFT, MUTED, DECK_COMPACT } from './common';

export interface DeckWelcomeProps {
    options: OptionType[];
    deleteCustom: (event: React.SyntheticEvent, index: number) => void;
    simpleServicesLength: number;
    browserSupported: boolean;
    connectDisabled: boolean;
    lastSelectedService: number;
    connectingInProgress: boolean;
    pairingFailed: boolean;
    pairingMessage: string;
    showWhyUnsupported: boolean;
    handleLearnWhy: (event: React.SyntheticEvent) => void;
    forceContinue: (event: React.SyntheticEvent) => void;
}

const useStyles = makeStyles()(() => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0,
        gap: 16,
        outline: 'none',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '4px 8px 0',
    },
    headerSide: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    hero: {
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px 16px 64px',
    },
    subheading: {
        marginTop: 12,
    },
    // More air around the call to action, with the Vivaldi note and the guide link pushed
    // well below it; the gaps tighten on short windows so the page still fits.
    connect: {
        marginTop: 72,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        [DECK_COMPACT]: { marginTop: 40, gap: 16 },
    },
    guide: {
        marginTop: 64,
        [DECK_COMPACT]: { marginTop: 32 },
    },
    // The stock split button: its two halves read as one larger primary key, the call to action on
    // this page and the one key that rests in amber.
    connectBox: {
        '& .MuiButtonGroup-root': { boxShadow: 'none' },
        // The group's "contained primary" styling paints the arrow half flat grey; outrank it.
        '& .MuiButtonGroup-root .MuiButton-root.MuiButtonGroup-grouped': {
            fontSize: 12,
            padding: '11px 20px',
            color: AMBER_SOFT,
            borderColor: 'rgba(255,170,51,0.4)',
            backgroundColor: 'transparent',
            backgroundImage: 'linear-gradient(#2b2c34, #1d1e24)',
            boxShadow: 'none',
        },
        // The stock split button sets the arrow half's grey inline; only a forced rule outranks it.
        '& .MuiButtonGroup-root .MuiButton-root.MuiButtonGroup-lastButton': {
            padding: '11px 8px',
            minWidth: 0,
            background: 'linear-gradient(#2b2c34, #1d1e24) !important',
        },
        '& .MuiButton-root svg': {
            color: AMBER_SOFT,
            width: 20,
            height: 20,
        },
    },
    // Dropdown entries: plain names for devices, a trailing bin for custom ones, a plus for "add".
    entry: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
    },
    entryIcon: {
        display: 'inline-flex',
        marginRight: 8,
        color: MUTED,
    },
    // The bin that removes a custom device shows only while its entry is hovered or focused.
    entryDelete: {
        display: 'inline-flex',
        padding: 4,
        margin: -4,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: MUTED,
        opacity: 0,
        transition: 'opacity 120ms',
        '.MuiMenuItem-root:hover &, .MuiMenuItem-root:focus-visible &, &:focus-visible': { opacity: 1 },
        '&:hover': { color: AMBER_SOFT },
    },
    vivaldi: {
        marginTop: 40,
        [DECK_COMPACT]: { marginTop: 20 },
        cursor: 'help',
        borderBottom: `1px dotted ${MUTED}`,
    },
    link: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        color: MUTED,
        textDecoration: 'none',
        '&:hover': { color: AMBER_SOFT },
    },
    why: {
        textAlign: 'left',
        '& ul': { margin: '8px 0 0', paddingLeft: 20 },
    },
}));

export const DeckWelcome = (props: DeckWelcomeProps) => {
    const { classes, cx } = useStyles();
    const { classes: type } = useDeckType();

    const mapToEntry = (option: OptionType) => {
        if (option.id >= props.simpleServicesLength) {
            return (
                <span className={classes.entry}>
                    {option.name}
                    <button
                        type="button"
                        className={classes.entryDelete}
                        aria-label={`delete ${option.name}`}
                        onClick={(e) => props.deleteCustom(e, option.id)}
                    >
                        <Trash2 size={14} />
                    </button>
                </span>
            );
        }
        if (option.customAddIcon) {
            return (
                <span className={classes.entry}>
                    <span>
                        <span className={classes.entryIcon}>
                            <Plus size={14} />
                        </span>
                        {option.name}
                    </span>
                </span>
            );
        }
        return option.name;
    };

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <div className={classes.headerSide}>
                    <DeckMark />
                    <DeckPill tone="version">{CHANGELOG[0].name}</DeckPill>
                </div>
                <TopMenu
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

            <div className={classes.hero}>
                <h1 className={type.display}>Web MiniDisc Pro</h1>
                <p className={cx(type.bodyMuted, classes.subheading)}>Brings NetMD devices to the web</p>

                {props.browserSupported ? (
                    <React.Fragment>
                        <div className={classes.connect}>
                            <span className={type.label}>Press the button to connect a NetMD device</span>
                            <SplitButton
                                options={props.options}
                                boxClassName={classes.connectBox}
                                width={240}
                                disabled={props.connectDisabled}
                                selectedIndex={props.lastSelectedService}
                                dropdownMapping={mapToEntry}
                                loading={props.connectingInProgress}
                            />
                            {props.pairingFailed && (
                                <DeckNotice tone="warning" label="Connection failed">
                                    {props.pairingMessage}
                                </DeckNotice>
                            )}
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
                                    <span className={cx(type.caption, classes.vivaldi)}>
                                        Using Vivaldi? Its WebUSB is broken; use another Chromium browser.
                                    </span>
                                </Tooltip>
                            )}
                        </div>
                        <a
                            className={cx(type.caption, classes.link, classes.guide)}
                            rel="noopener noreferrer"
                            target="_blank"
                            href="https://www.minidisc.wiki/guides/webminidisc"
                        >
                            First time here? Read the guide <ExternalLink size={12} />
                        </a>
                    </React.Fragment>
                ) : (
                    <DeckNotice tone="warning" label="Browser not supported">
                        <div className={classes.why}>
                            <p className={type.body}>
                                This web browser is not supported.{' '}
                                <a href="#" onClick={props.handleLearnWhy}>
                                    Learn why
                                </a>
                                . Try{' '}
                                <a rel="noopener noreferrer" target="_blank" href="https://www.google.com/chrome/">
                                    Chrome
                                </a>{' '}
                                instead, or{' '}
                                <a href="#" onClick={props.forceContinue}>
                                    load the app anyway
                                </a>{' '}
                                to connect to a remote device.
                            </p>
                            {props.showWhyUnsupported && (
                                <React.Fragment>
                                    <p className={type.body} style={{ marginTop: 8 }}>
                                        Web MiniDisc Pro requires a browser that supports both{' '}
                                        <a rel="noopener noreferrer" target="_blank" href="https://wicg.github.io/webusb/">
                                            WebUSB
                                        </a>{' '}
                                        and{' '}
                                        <a rel="noopener noreferrer" target="_blank" href="https://webassembly.org/">
                                            WebAssembly
                                        </a>
                                        .
                                    </p>
                                    <ul className={type.body}>
                                        <li>WebUSB is needed to control the NetMD device via the USB connection to your computer.</li>
                                        <li>WebAssembly is used to convert the music to a MiniDisc compatible format.</li>
                                    </ul>
                                </React.Fragment>
                            )}
                        </div>
                    </DeckNotice>
                )}
            </div>

            <SettingsDialog />
            <ManageEncodersDialog />
            <AboutDialog />
            <ChangelogDialog />
            <OtherDeviceDialog />
        </div>
    );
};
