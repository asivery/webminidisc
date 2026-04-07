import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { stat } from 'fs';
import { enableBatching } from 'redux-batched-actions';

export interface LoadingDialogState {
    visible: boolean;
    cancelled: boolean;

    writtenProgress: number;
    encryptedProgress: number;
    totalProgress: number;

    trackTotal: number;
    trackConverting: number;
    trackCurrent: number;

    titleCurrent: string;
    titleConverting: string;

    trackEncodeProgress: number;
    trackEncodeProgressOutOf: number;
}

const initialState: LoadingDialogState = {
    visible: false,
    cancelled: false,

    // Current Track Upload
    writtenProgress: 0,
    encryptedProgress: 0,
    totalProgress: 1,

    // Tracks done
    trackTotal: 1,
    trackConverting: 0,
    trackCurrent: 0,
    titleCurrent: '',
    titleConverting: '',

    trackEncodeProgress: 0,
    trackEncodeProgressOutOf: 0,
};

export const slice = createSlice({
    name: 'uploadDialog',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setWriteProgress: (state, action: PayloadAction<{ written: number; encrypted: number; total: number }>) => {
            state.encryptedProgress = action.payload.encrypted;
            state.writtenProgress = action.payload.written;
            state.totalProgress = action.payload.total;
        },
        setCancelUpload: (state, action: PayloadAction<boolean>) => {
            state.cancelled = action.payload;
        },
        setTrackProgress: (
            state,
            action: PayloadAction<{ total: number; current: number; converting: number; titleCurrent: string; titleConverting: string }>
        ) => {
            state.trackTotal = action.payload.total;
            state.trackCurrent = action.payload.current;
            state.trackConverting = action.payload.converting;
            state.titleCurrent = action.payload.titleCurrent;
            state.titleConverting = action.payload.titleConverting;
        },
        setTrackEncodingProgress: (state, action: PayloadAction<{ state: number; total: number }>) => {
            state.trackEncodeProgress = action.payload.state;
            state.trackEncodeProgressOutOf = action.payload.total;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
