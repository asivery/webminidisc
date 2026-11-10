import React from 'react';
import { SvgIconProps } from '@mui/material/SvgIcon';
import {
    Add as MAdd,
    ArrowDropDown as MArrowDropDown,
    ArrowUpward as MArrowUpward,
    CloudDownload as MCloudDownload,
    DeleteForever as MDeleteForever,
    Edit as MEdit,
    ExpandLess as MExpandLess,
    ExpandMore as MExpandMore,
    Remove as MRemove,
} from '@mui/icons-material';
import { ArrowUp, ChevronDown, ChevronUp, CloudDownload, LucideIcon, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useShallowEqualSelector } from '../../frontend-utils';

const SIZES: Record<string, number | string> = { small: 18, medium: 20, large: 30, inherit: '1em' };

// A Material icon that draws its Lucide twin in Deck Mode. Stock dialogs import these in place of
// '@mui/icons-material', so the only change in an upstream file is its import line.
function deckAware(Material: React.ComponentType<SvgIconProps>, Lucide: LucideIcon) {
    const Icon = (props: SvgIconProps) => {
        const deckMode = useShallowEqualSelector((state) => state.appState.deckMode);
        if (!deckMode) return <Material {...props} />;
        const { fontSize = 'medium', className, style } = props;
        return <Lucide size={SIZES[fontSize] ?? 20} strokeWidth={1.75} className={className} style={style} aria-hidden />;
    };
    Icon.displayName = `DeckAware(${Lucide.displayName ?? 'Icon'})`;
    return Icon;
}

export const Add = deckAware(MAdd, Plus);
export const ArrowDropDown = deckAware(MArrowDropDown, ChevronDown);
export const ArrowUpward = deckAware(MArrowUpward, ArrowUp);
export const CloudDownloadIcon = deckAware(MCloudDownload, CloudDownload);
export const DeleteForever = deckAware(MDeleteForever, Trash2);
export const Edit = deckAware(MEdit, Pencil);
export const ExpandLess = deckAware(MExpandLess, ChevronUp);
export const ExpandMore = deckAware(MExpandMore, ChevronDown);
export const Remove = deckAware(MRemove, Minus);
