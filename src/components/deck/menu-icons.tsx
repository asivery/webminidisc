import React from 'react';
import {
    Archive,
    ArrowUpward,
    BugReport,
    Code,
    DeleteForever,
    Edit,
    ExitToApp,
    GetApp,
    Headphones,
    Help,
    Info,
    LockOpen,
    MenuOpen,
    MonetizationOn,
    MusicNote,
    Publish,
    Refresh,
    Security,
    Settings,
    Storage,
    ToggleOff,
    ToggleOn,
} from '@mui/icons-material';
import {
    Archive as LArchive,
    ArrowUp,
    Bug,
    Code as LCode,
    Trash2,
    Pencil,
    LogOut,
    Download,
    Headphones as LHeadphones,
    CircleHelp,
    Info as LInfo,
    LockOpen as LLockOpen,
    PanelLeft,
    HandCoins,
    Music,
    Upload,
    RefreshCw,
    Shield,
    Settings as LSettings,
    HardDrive,
    ToggleLeft,
    ToggleRight,
} from 'lucide-react';

// The stock top menu draws Material icons. In Deck Mode the same items are shown with their Lucide
// counterparts, matched by component identity so nothing in the stock file names a Lucide icon.
// Icons with no Lucide twin (the GitHub mark, the Windows 95 bitmap for Retro Mode) pass through.
const SWAP = new Map<React.ElementType, React.ElementType>([
    [Archive, LArchive],
    [ArrowUpward, ArrowUp],
    [BugReport, Bug],
    [Code, LCode],
    [DeleteForever, Trash2],
    [Edit, Pencil],
    [ExitToApp, LogOut],
    [GetApp, Download],
    [Headphones, LHeadphones],
    [Help, CircleHelp],
    [Info, LInfo],
    [LockOpen, LLockOpen],
    [MenuOpen, PanelLeft],
    [MonetizationOn, HandCoins],
    [MusicNote, Music],
    [Publish, Upload],
    [Refresh, RefreshCw],
    [Security, Shield],
    [Settings, LSettings],
    [Storage, HardDrive],
    [ToggleOff, ToggleLeft],
    [ToggleOn, ToggleRight],
]);

export function deckMenuItems(node: React.ReactNode): React.ReactNode {
    return React.Children.map(node, (child) => {
        if (!React.isValidElement(child)) return child;
        const Lucide = SWAP.get(child.type as React.ElementType);
        if (Lucide) return <Lucide size={14} />;
        const { children } = child.props as { children?: React.ReactNode };
        if (children === undefined || typeof children === 'function') return child;
        return React.cloneElement(child, undefined, deckMenuItems(children));
    });
}
