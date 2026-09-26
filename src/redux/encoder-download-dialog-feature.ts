import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';

export interface RecordingDialogState {
    visible: boolean;

    currentEncoderIndex: number,
    totalEncoders: number,
    currentEncoderName: string,
}

const initialState: RecordingDialogState = {
    visible: false,

    currentEncoderIndex: 0,
    totalEncoders: 0,
    currentEncoderName: '',
};

export const slice = createSlice({
    name: 'encoderDownloadDialog',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setProgress: (
            state,
            action: PayloadAction<{ currentEncoderIndex: number; totalEncoders: number; currentEncoderName: string }>
        ) => {
            state.currentEncoderIndex = action.payload.currentEncoderIndex;
            state.totalEncoders = action.payload.totalEncoders;
            state.currentEncoderName = action.payload.currentEncoderName;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
