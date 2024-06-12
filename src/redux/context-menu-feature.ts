import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';

export interface ContextMenuState {
    visible: boolean;
    trackID: string;
    position: { x: number; y: number } | null;
}

const initialState: ContextMenuState = {
    visible: false,
    trackID: '',
    position: null,
};

export const slice = createSlice({
    name: 'contextMenu',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setTrack: (state, action: PayloadAction<string>) => {
            state.trackID = action.payload;
        },
        setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.position = action.payload;
        },
        openContextMenu: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.visible = true;
            state.position = action.payload;
        }
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
