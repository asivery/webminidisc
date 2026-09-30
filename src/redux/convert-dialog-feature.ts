import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HiMDCodecName } from 'himd-js';
import { enableBatching } from 'redux-batched-actions';
import { savePreference, loadPreference } from '../preferences';

export type TitleFormatType = 'filename' | 'title' | 'album-title' | 'artist-title' | 'artist-album-title' | 'title-artist';
export type ForcedEncodingFormat = { codec: 'SPM' | 'SPS' | HiMDCodecName; bitrate: number } | null;

export interface ConvertDialogFeature {
    visible: boolean;
    format: { [mdSpecName: string]: [number, number] };
    titleFormat: TitleFormatType;
    titles: {
        sourceId?: string;
        unicodeTitle?: string;
        unicodeSource?: string;
        unicodeSaved?: boolean;
        generatedFormat?: TitleFormatType;
        title: string;
        fullWidthTitle: string;
        duration: number;
        forcedEncoding: ForcedEncodingFormat;
        bytesToSkip: number;
        artist?: string;
        album?: string;
    }[];
}

const initialState: ConvertDialogFeature = {
    visible: false,
    format: loadPreference('uploadFormat', {}),
    titleFormat: loadPreference('trackTitleFormat', 'filename') as TitleFormatType,
    titles: [],
};

const slice = createSlice({
    name: 'convertDialog',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setFormat: (state, action: PayloadAction<ConvertDialogFeature['format']>) => {
            state.format = action.payload;
            savePreference('uploadFormat', state.format);
        },
        setTitleFormat: (state, action: PayloadAction<TitleFormatType>) => {
            state.titleFormat = action.payload;
            savePreference('trackTitleFormat', state.titleFormat);
        },
        setTitles: (state, action: PayloadAction<ConvertDialogFeature['titles']>) => {
            state.titles = action.payload;
        },
        refreshTitles: (state, action: PayloadAction<ConvertDialogFeature['titles']>) => {
            const previous = new Map(state.titles.map((track) => [track.sourceId, track]));
            state.titles = action.payload.map((track) => {
                const old = track.sourceId ? previous.get(track.sourceId) : undefined;
                return old?.unicodeSaved && old.generatedFormat === track.generatedFormat
                    ? {
                          ...track,
                          title: old.title,
                          fullWidthTitle: old.fullWidthTitle,
                          unicodeTitle: old.unicodeTitle,
                          unicodeSource: old.unicodeSource,
                          unicodeSaved: true,
                      }
                    : track;
            });
        },
        updateFormatForSpec: (state, action: PayloadAction<{ spec: string; codec: [number, number]; unlessUnset?: boolean }>) => {
            if (action.payload.unlessUnset && state.format[action.payload.spec] !== undefined) return;
            state.format = {
                ...state.format,
                [action.payload.spec]: action.payload.codec,
            };
            savePreference('uploadFormat', state.format);
        },
    },
});

export const { actions, reducer } = slice;
export default enableBatching(reducer);
