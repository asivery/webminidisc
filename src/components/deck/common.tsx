import React, { CSSProperties, ReactNode } from 'react';
import Button, { ButtonProps } from '@mui/material/Button';
import { makeStyles } from 'tss-react/mui';

export const GROTESK = "'Space Grotesk', Roboto, sans-serif";
export const MONO = "'JetBrains Mono', monospace";
export const AMBER = '#ffaa33';
export const AMBER_SOFT = '#ffb84d';
export const TEXT = '#eae7e2';
export const MUTED = '#b5b0a8';
export const LINE = '#2a2c33';

// Deck's compact layout: half a laptop screen (under 1024px wide) or a short window (under 760px tall).
export const DECK_COMPACT = '@media (max-width: 1023px), (max-height: 760px)';

// Thin dark scrollbars for Deck's scroll regions; the thumb warms to amber under the pointer.
export const DECK_SCROLLBAR = {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: `${LINE} #0b0c0e`,
    '&::-webkit-scrollbar': { width: 8, height: 8 },
    '&::-webkit-scrollbar-track': { background: '#0b0c0e', borderRadius: 2 },
    '&::-webkit-scrollbar-thumb': { background: LINE, borderRadius: 2, border: '1px solid #131418' },
    '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,170,51,0.45)' },
    '&::-webkit-scrollbar-corner': { background: '#0b0c0e' },
};

const useStyles = makeStyles()(() => ({
    panel: {
        position: 'relative',
        background: 'linear-gradient(180deg, #1f2026, #15161b)',
        border: `1px solid ${LINE}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.07)',
        padding: 17,
    },
    keyActive: {
        border: '1px solid rgba(255,170,51,0.4)',
        color: AMBER_SOFT,
    },
    keyCompact: {
        padding: '5px 11px',
        letterSpacing: 0.8,
        '& .MuiButton-startIcon': { marginRight: 4 },
    },
    lcd: {
        background: '#18140c',
        border: '1px solid rgba(255,170,51,0.2)',
        borderRadius: 4,
        padding: '9px 17px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
    },
    lcdMeter: {
        border: '1px solid rgba(255,170,51,0.15)',
        padding: 15,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.95), inset 0 0 1px #000',
    },
    specRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        borderBottom: 'none',
        padding: '4px 0 5px',
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '16px',
        letterSpacing: 0.66,
        '&:not(:last-child)': {
            borderBottom: '1px solid rgba(42,44,51,0.4)',
        },
    },
    specLabel: {
        color: MUTED,
        fontWeight: 500,
        flexShrink: 0,
    },
    specValue: {
        color: TEXT,
        fontWeight: 500,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    specEmphasis: {
        fontWeight: 700,
    },
    specAccent: {
        color: AMBER_SOFT,
    },
    label: {
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 500,
        textTransform: 'uppercase',
        color: MUTED,
        letterSpacing: 0.5,
    },
    pill: {
        display: 'inline-block',
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 500,
        borderRadius: 2,
        whiteSpace: 'nowrap',
    },
    pillAmber: {
        background: '#251e12',
        color: '#d4af37',
        textTransform: 'uppercase',
        padding: '2px 7px',
    },
    pillMuted: {
        background: '#0b0c0e',
        border: `1px solid ${LINE}`,
        color: MUTED,
        textTransform: 'uppercase',
        padding: '2px 7px',
    },
    pillVersion: {
        background: '#22242a',
        border: `1px solid ${LINE}`,
        color: AMBER,
        letterSpacing: 0.8,
        padding: '3px 9px',
    },
    pillLcd: {
        background: '#251e12',
        color: AMBER,
        fontSize: 9,
        lineHeight: '20px',
        fontWeight: 700,
        letterSpacing: 1.68,
        padding: '0 4px',
    },
    status: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: MONO,
        fontSize: 11,
        lineHeight: '16px',
        fontWeight: 500,
        letterSpacing: 0.66,
        color: MUTED,
        whiteSpace: 'nowrap',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        flexShrink: 0,
    },
    notice: {
        background: 'rgba(26,27,32,0.6)',
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxWidth: 520,
    },
    noticeWarning: {
        borderColor: 'rgba(255,170,51,0.4)',
    },
    noticeBody: {
        fontFamily: GROTESK,
        fontSize: 14,
        lineHeight: '20px',
        color: TEXT,
        '& a': { color: AMBER_SOFT },
    },
    mark: {
        width: 28,
        height: 28,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#22242a',
        border: '1px solid #787672',
        borderRadius: 2,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: AMBER,
    },
}));

// Deck's type scale. Headings in Space Grotesk, readouts in JetBrains Mono; every Deck screen draws
// its text from these seven steps so sizes stay consistent across screens and notices.
export const useDeckType = makeStyles()(() => ({
    display: { fontFamily: GROTESK, fontSize: 32, lineHeight: '40px', fontWeight: 700, letterSpacing: -0.64, color: TEXT, margin: 0 },
    heading: { fontFamily: GROTESK, fontSize: 24, lineHeight: '32px', fontWeight: 700, letterSpacing: -0.6, color: TEXT, margin: 0 },
    subheading: { fontFamily: GROTESK, fontSize: 18, lineHeight: '24px', fontWeight: 600, color: TEXT, margin: 0 },
    body: { fontFamily: GROTESK, fontSize: 14, lineHeight: '20px', fontWeight: 400, color: TEXT, margin: 0 },
    bodyMuted: { fontFamily: GROTESK, fontSize: 16, lineHeight: '24px', fontWeight: 400, color: MUTED, margin: 0 },
    caption: { fontFamily: MONO, fontSize: 11, lineHeight: '16px', fontWeight: 500, letterSpacing: 0.66, color: MUTED },
    label: {
        fontFamily: MONO,
        fontSize: 10,
        lineHeight: '14px',
        fontWeight: 500,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: MUTED,
    },
}));

export const DeckPanel = ({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) => {
    const { classes, cx } = useStyles();
    return (
        <div className={cx(classes.panel, className)} style={style}>
            {children}
        </div>
    );
};

// A bevelled key. The theme styles every MUI Button as one; this adds the amber "active" state,
// the denser table-bar variant and an `icon` shorthand for the leading glyph.
export const DeckKey = ({
    active,
    compact,
    icon,
    className,
    ...rest
}: ButtonProps & { active?: boolean; compact?: boolean; icon?: ReactNode }) => {
    const { classes, cx } = useStyles();
    return (
        <Button
            size="small"
            startIcon={icon}
            {...rest}
            className={cx(active && classes.keyActive, compact && classes.keyCompact, className)}
        />
    );
};

export const LcdWindow = ({
    children,
    className,
    variant = 'ticker',
    onClick,
    title,
}: {
    children?: ReactNode;
    className?: string;
    variant?: 'ticker' | 'meter';
    onClick?: () => void;
    title?: string;
}) => {
    const { classes, cx } = useStyles();
    return (
        <div className={cx(classes.lcd, variant === 'meter' && classes.lcdMeter, className)} onClick={onClick} title={title}>
            {children}
        </div>
    );
};

export const SpecRow = ({ label, value, accent, emphasis }: { label: string; value: string; accent?: boolean; emphasis?: boolean }) => {
    const { classes, cx } = useStyles();
    return (
        <div className={classes.specRow}>
            <span className={classes.specLabel}>{label}</span>
            <span
                className={cx(classes.specValue, (accent || emphasis) && classes.specEmphasis, accent && classes.specAccent)}
                title={value}
            >
                {value}
            </span>
        </div>
    );
};

export const DeckLabel = ({ children, className }: { children?: ReactNode; className?: string }) => {
    const { classes, cx } = useStyles();
    return <span className={cx(classes.label, className)}>{children}</span>;
};

export const DeckPill = ({
    children,
    tone = 'amber',
    className,
}: {
    children?: ReactNode;
    tone?: 'amber' | 'muted' | 'version' | 'lcd';
    className?: string;
}) => {
    const { classes, cx } = useStyles();
    const toneClass = {
        amber: classes.pillAmber,
        muted: classes.pillMuted,
        version: classes.pillVersion,
        lcd: classes.pillLcd,
    }[tone];
    return <span className={cx(classes.pill, toneClass, className)}>{children}</span>;
};

// The square "MD" brand mark from the header.
export const DeckMark = () => {
    const { classes } = useStyles();
    return <span className={classes.mark}>MD</span>;
};

// A bordered panel for notices: a mono label line and body text; amber-edged when it is a warning.
export const DeckNotice = ({ label, children, tone = 'info' }: { label?: ReactNode; children?: ReactNode; tone?: 'info' | 'warning' }) => {
    const { classes, cx } = useStyles();
    return (
        <div className={cx(classes.notice, tone === 'warning' && classes.noticeWarning)} role={tone === 'warning' ? 'alert' : undefined}>
            {label && <span className={classes.label}>{label}</span>}
            <div className={classes.noticeBody}>{children}</div>
        </div>
    );
};

// A small coloured dot followed by a mono caption, e.g. "TOC Synced".
export const DeckStatus = ({ children, dot = AMBER_SOFT }: { children?: ReactNode; dot?: string }) => {
    const { classes } = useStyles();
    return (
        <span className={classes.status}>
            <span className={classes.statusDot} style={{ background: dot }} />
            {children}
        </span>
    );
};
