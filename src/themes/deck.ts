import { createTheme } from '@mui/material/styles';
import { themeCommons } from './commons';

const mono = "'JetBrains Mono', monospace";
const grotesk = "'Space Grotesk', Roboto, sans-serif";

// Key chrome is shared by text and icon buttons; the label type applies to text buttons only, so icons keep MUI's size.
const deckButtonChrome = {
    borderRadius: 2,
    border: '1px solid rgba(255,255,255,0.14)',
    backgroundImage: 'linear-gradient(#2b2c34, #1d1e24)',
    color: '#eae7e2',
    '&:hover': { backgroundImage: 'linear-gradient(#33343d, #23242b)', color: '#ffb84d', borderColor: 'rgba(255,170,51,0.4)' },
    '&:active': {
        transform: 'translateY(1px)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
        color: '#ffb84d',
        borderColor: 'rgba(255,170,51,0.4)',
    },
};

const deckButtonLabel = {
    fontFamily: mono,
    fontSize: 10,
    lineHeight: '16px',
    fontWeight: 500,
    textTransform: 'none' as const,
    letterSpacing: 0.66,
    padding: '7px 13px',
    minHeight: 0,
    '& .MuiButton-startIcon': { marginLeft: 0, marginRight: 6 },
    '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: 11 },
};

const text = '#eae7e2';
const muted = '#b5b0a8';
const line = '#2a2c33';
const inset = '#0b0c0e';
const amber = '#ffaa33';
const amberSoft = '#ffb84d';

// Thin dark scrollbars, as on the main screen's scroll regions (DECK_SCROLLBAR in components/deck/common).
const scrollbar = {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: `${line} ${inset}`,
    '&::-webkit-scrollbar': { width: 8, height: 8 },
    '&::-webkit-scrollbar-track': { background: inset, borderRadius: 2 },
    '&::-webkit-scrollbar-thumb': { background: line, borderRadius: 2, border: '1px solid #131418' },
    '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,170,51,0.45)' },
};

const chip = { backgroundColor: '#251e12', color: '#d4af37', fontFamily: mono, fontSize: 9, borderRadius: 2 };

export const deckTheme = createTheme({
    palette: {
        mode: 'dark',
        background: { default: '#131418', paper: '#1a1b20' },
        primary: { main: '#ffaa33', light: '#ffb84d', contrastText: '#1a1b20' },
        // `dark` is the Convert dialog's selection bar: Deck's dark amber tint, not MUI's computed brown.
        secondary: { main: '#ffb84d', dark: '#251e12', contrastText: '#1a1b20' },
        // Warnings (e.g. Upload's "poor quality" LP2/LP4 keys) in terracotta, so they never read as the amber selection.
        warning: { main: '#e07a5f', contrastText: '#1a1b20' },
        text: { primary: '#eae7e2', secondary: '#b5b0a8' },
        divider: 'rgba(42,44,51,0.8)',
    },
    typography: {
        fontFamily: grotesk,
        body1: { fontSize: 14, lineHeight: '20px' },
        body2: { fontSize: 13, lineHeight: '18px' },
        caption: { fontFamily: mono, fontSize: 10, letterSpacing: 0.5 },
        h6: { fontFamily: grotesk, fontSize: 18, lineHeight: '24px', fontWeight: 600 },
    },
    shape: { borderRadius: 4 },
    components: {
        ...themeCommons.components,
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: '#131418', fontFamily: grotesk },
                // Keyboard focus (WCAG 2.4.7) on Deck's own focusable non-MUI elements: the device heading,
                // the ticker and its seek strip.
                '[role="button"]:focus-visible, [role="slider"]:focus-visible': { outline: `2px solid ${amber}`, outlineOffset: 2 },
            },
        },
        MuiPaper: {
            ...themeCommons.components.MuiPaper,
            styleOverrides: {
                ...themeCommons.components.MuiPaper.styleOverrides,
                root: {
                    backgroundImage: 'linear-gradient(#1f2026, #15161b)',
                    border: '1px solid rgba(42,44,51,0.8)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
                },
            },
        },
        MuiButton: { styleOverrides: { root: { ...deckButtonChrome, ...deckButtonLabel }, containedPrimary: { color: '#ffb84d' } } },
        // Every MUI control (keys, icon keys, switches, checkboxes, menu items, tabs) shows an amber ring when
        // reached by keyboard; mouse clicks never show it.
        MuiButtonBase: {
            styleOverrides: { root: { '&.Mui-focusVisible': { outline: `2px solid ${amber}`, outlineOffset: 2 } } },
        },
        // Bordered keys can't take MUI's negative edge margins (they made the Upload toolbar's keys overlap).
        MuiIconButton: { styleOverrides: { root: deckButtonChrome, edgeStart: { marginLeft: 0 }, edgeEnd: { marginRight: 0 } } },
        MuiToolbar: { styleOverrides: { root: { gap: 6 } } },
        MuiChip: {
            styleOverrides: {
                root: chip,
                colorPrimary: chip,
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: { borderBottom: '1px solid rgba(42,44,51,0.8)' },
                head: { fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#b5b0a8' },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&.Mui-selected': { backgroundColor: 'rgba(255,170,51,0.08)' },
                },
            },
        },
        // Dialogs: a Deck panel over a dimmed deck, the title as a subheading over a hairline, prose in
        // Space Grotesk, the key row under a hairline. Every stock dialog picks this up unchanged.
        MuiBackdrop: {
            styleOverrides: {
                root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: 'rgba(8,8,10,0.72)', backdropFilter: 'blur(2px)' } },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    boxShadow: '0 16px 48px rgba(0,0,0,0.8), inset 0 1px 0 0 rgba(255,255,255,0.07)',
                    // Upstream's write-protect drawing (images/md_lock.svg) is near-black line art; redraw it in Deck's
                    // colours: shells off-white, the tab amber (its grey callout already reads on charcoal). SVGR turns
                    // the file's inline styles into React style objects, so the browser serialises them as rgb().
                    '& svg [style*="stroke: rgb(35, 31, 32)"], & svg [style*="stroke:#231f20"]': { stroke: `${muted} !important` },
                    '& svg [style*="fill: rgb(35, 31, 32)"], & svg [style*="fill:#231f20"]': { fill: `${amber} !important` },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontFamily: grotesk,
                    fontSize: 18,
                    lineHeight: '24px',
                    fontWeight: 600,
                    color: text,
                    padding: '18px 24px 14px',
                    borderBottom: `1px solid ${line}`,
                    marginBottom: 12,
                },
            },
        },
        MuiDialogContent: { styleOverrides: { root: scrollbar } },
        MuiDialogContentText: { styleOverrides: { root: { fontFamily: grotesk, fontSize: 14, lineHeight: '20px', color: muted } } },
        MuiDialogActions: {
            styleOverrides: {
                root: { padding: '12px 24px 16px', borderTop: `1px solid ${line}`, gap: 8, '& > :not(:first-of-type)': { marginLeft: 0 } },
            },
        },
        MuiFormControlLabel: { styleOverrides: { label: { fontFamily: grotesk, fontSize: 14, lineHeight: '20px', color: text } } },
        // Switches: a dark inset slot; the knob rests muted and lights amber when on.
        MuiSwitch: {
            styleOverrides: {
                switchBase: {
                    color: muted,
                    '&.Mui-checked': { color: amber },
                    '&.Mui-checked + .MuiSwitch-track': { backgroundColor: amber, opacity: 0.3 },
                    '&.Mui-disabled': { color: '#4a4a4f' },
                },
                track: { backgroundColor: inset, border: `1px solid ${line}`, opacity: 1, borderRadius: 3 },
                thumb: { borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)' },
            },
        },
        MuiCheckbox: { styleOverrides: { root: { color: muted } } },
        MuiRadio: { styleOverrides: { root: { color: muted } } },
        // Fields are LCD-dark insets with mono readouts; the edge warms to amber on hover and focus.
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: inset,
                    fontFamily: mono,
                    fontSize: 12,
                    letterSpacing: 0.4,
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
                    '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,170,51,0.4)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: amber, borderWidth: 1 },
                },
            },
        },
        MuiInput: {
            styleOverrides: {
                root: {
                    fontFamily: mono,
                    fontSize: 12,
                    letterSpacing: 0.4,
                    '&:before': { borderBottomColor: line },
                    '&:hover:not(.Mui-disabled):before': { borderBottomColor: 'rgba(255,170,51,0.4)' },
                },
            },
        },
        MuiFilledInput: { styleOverrides: { root: { backgroundColor: inset, fontFamily: mono, fontSize: 12 } } },
        MuiInputLabel: { styleOverrides: { root: { fontFamily: mono, fontSize: 12, letterSpacing: 0.4, color: muted } } },
        MuiFormHelperText: { styleOverrides: { root: { fontFamily: mono, fontSize: 10, letterSpacing: 0.4 } } },
        MuiSelect: {
            styleOverrides: {
                select: { paddingTop: 9, paddingBottom: 9 },
                icon: { color: muted },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: inset,
                    border: `1px solid ${line}`,
                    color: text,
                    fontFamily: mono,
                    fontSize: 10,
                    letterSpacing: 0.5,
                    borderRadius: 2,
                },
                arrow: { color: inset },
            },
        },
        // Alerts and accordions are notices, not panels: drop the Paper gradient and shadow they inherit.
        MuiAlert: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: 'rgba(26,27,32,0.6)',
                    boxShadow: 'none',
                    border: `1px solid ${line}`,
                    borderRadius: 4,
                    color: text,
                    fontFamily: grotesk,
                    fontSize: 14,
                    lineHeight: '20px',
                },
                standardWarning: { borderColor: 'rgba(255,170,51,0.4)', '& .MuiAlert-icon': { color: amber } },
                standardError: { borderColor: 'rgba(232,93,74,0.5)', '& .MuiAlert-icon': { color: '#e85d4a' } },
                standardInfo: { '& .MuiAlert-icon': { color: muted } },
                standardSuccess: { '& .MuiAlert-icon': { color: amber } },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: 'rgba(26,27,32,0.6)',
                    boxShadow: 'none',
                    border: `1px solid ${line}`,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { margin: '8px 0' },
                    // Two-class selectors so these beat stock dialogs' own zero-padding summary classes.
                    '&.MuiPaper-root': { borderRadius: 4 },
                    '& .MuiAccordionSummary-root': {
                        padding: '0 14px',
                        minHeight: '40px !important',
                        height: 'auto',
                        fontFamily: grotesk,
                        fontSize: 14,
                        fontWeight: 500,
                        color: text,
                    },
                    '& .MuiAccordionSummary-expandIconWrapper': { color: muted },
                    '& .MuiAccordionDetails-root': { padding: '4px 14px 12px' },
                },
            },
        },
        // Spinners: a fixed arc turning at a steady rate, instead of MUI's arc that grows and shrinks (reads as a wobble).
        MuiCircularProgress: {
            styleOverrides: {
                indeterminate: { animationDuration: '0.9s', animationTimingFunction: 'linear' },
                circleIndeterminate: { animation: 'none', strokeDasharray: '70px 200px', strokeDashoffset: 0 },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: { backgroundColor: inset, height: 6, borderRadius: 2, border: `1px solid ${line}` },
                bar: { backgroundColor: amber },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    ...deckButtonLabel,
                    color: text,
                    borderColor: 'rgba(255,255,255,0.14)',
                    '&.Mui-selected': { color: amberSoft, backgroundColor: 'rgba(255,170,51,0.1)', borderColor: 'rgba(255,170,51,0.4)' },
                    '&:hover': { color: amberSoft },
                },
            },
        },
        MuiLink: { styleOverrides: { root: { color: amberSoft } } },
        MuiTab: { styleOverrides: { root: { ...deckButtonLabel, fontSize: 11, color: muted, '&.Mui-selected': { color: amberSoft } } } },
        // Menus read like the Deck keys: mono captions, off-white at rest, amber under the pointer.
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontFamily: mono,
                    fontSize: 11,
                    letterSpacing: 0.66,
                    color: '#eae7e2',
                    minHeight: 32,
                    '&:hover': { color: '#ffb84d', backgroundColor: 'rgba(255,170,51,0.08)' },
                    '&.Mui-focusVisible': { color: '#ffb84d', backgroundColor: 'rgba(255,170,51,0.08)', outlineOffset: -2 },
                    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 28 },
                    '& .MuiListItemText-primary': { fontFamily: mono, fontSize: 11, letterSpacing: 0.66 },
                    '& .MuiListItemText-secondary': { fontFamily: mono, fontSize: 9, color: '#b5b0a8' },
                },
            },
        },
        MuiDivider: { styleOverrides: { root: { borderColor: '#2a2c33' } } },
    },
});
