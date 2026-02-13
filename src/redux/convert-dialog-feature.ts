import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HiMDCodecName } from 'himd-js';
import { enableBatching } from 'redux-batched-actions';
import { Codec } from '../services/interfaces/netmd';
import { savePreference, loadPreference } from '../utils';

export type TitleFormatType = 'filename' | 'title' | 'album-title' | 'artist-title' | 'artist-album-title' | 'title-artist';
export type ForcedEncodingFormat = { codec: 'SPM' | 'SPS' | HiMDCodecName; bitrate: number; } | null;

export interface ConvertDialogFeature {
    visible: boolean;
    format: { [mdSpecName: string]: [number, number] };
    titleFormat: TitleFormatType;
    stripTrackNumbers: boolean;
    titles: {
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
    stripTrackNumbers: loadPreference('stripTrackNumbers', false),
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
        setStripTrackNumbers: (state, action: PayloadAction<boolean>) => {
            state.stripTrackNumbers = action.payload;
            savePreference('stripTrackNumbers', state.stripTrackNumbers);
        },
        setTitles: (
            state,
            action: PayloadAction<
                {
                    title: string;
                    fullWidthTitle: string;
                    duration: number;
                    forcedEncoding: ForcedEncodingFormat;
                    bytesToSkip: number;
                    artist?: string;
                    album?: string;
                }[]
            >
        ) => {
            state.titles = action.payload;
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
