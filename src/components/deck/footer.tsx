import React from 'react';
import { makeStyles } from 'tss-react/mui';

import { useDispatch } from '../../frontend-utils';
import { actions as appActions } from '../../redux/app-feature';
import { GROTESK, MONO, MUTED, LINE, DECK_COMPACT } from './common';

const useStyles = makeStyles()(() => ({
    footer: {
        flex: '0 0 auto',
        width: '100%',
        marginTop: 16,
        [DECK_COMPACT]: { marginTop: 8 },
        background: '#0b0c0e',
        borderTop: `1px solid ${LINE}`,
        color: MUTED,
    },
    track: {
        maxWidth: 1280,
        margin: '0 auto',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 24px',
        [DECK_COMPACT]: { padding: '6px 16px', gap: 8, flexWrap: 'nowrap' },
    },
    copyright: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: GROTESK,
        fontSize: 12,
        lineHeight: '16px',
        [DECK_COMPACT]: { fontSize: 11, whiteSpace: 'nowrap' },
    },
    links: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 24,
        [DECK_COMPACT]: { gap: 14, flexWrap: 'nowrap' },
    },
    link: {
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 500,
        letterSpacing: 0.8,
        color: MUTED,
        // The app's base stylesheet strips underlines from every anchor with !important; match it.
        '&, &:link, &:visited': {
            textDecoration: 'underline !important',
            textUnderlineOffset: 2,
            color: MUTED,
        },
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        '&:hover': { color: '#eae7e2' },
    },
}));

// Deck Mode's footer: the stock copyright line plus the links the stock top menu keeps under "About".
export const DeckFooter = () => {
    const { classes } = useStyles();
    const dispatch = useDispatch();
    const external = (href: string, label: string) => (
        <a className={classes.link} rel="noopener noreferrer" target="_blank" href={href}>
            {label}
        </a>
    );
    return (
        <footer className={classes.footer}>
            <div className={classes.track}>
                <span className={classes.copyright}>
                    (c) {external('https://stefano.brilli.me/', 'Stefano Brilli')}, {external('https://github.com/asivery/', 'Asivery')}{' '}
                    {new Date().getFullYear()}
                </span>
                <span className={classes.links}>
                    {external('https://www.minidisc.wiki/guides/start', 'NetMD Driver Guide')}
                    <button type="button" className={classes.link} onClick={() => dispatch(appActions.showAboutDialog(true))}>
                        About
                    </button>
                    <button type="button" className={classes.link} onClick={() => dispatch(appActions.showChangelogDialog(true))}>
                        Changelog
                    </button>
                    {external('https://github.com/asivery/webminidisc', 'Fork me on GitHub')}
                    {external('https://ko-fi.com/asivery', 'Donate')}
                </span>
            </div>
        </footer>
    );
};
