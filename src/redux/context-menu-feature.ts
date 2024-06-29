import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { Track } from '../services/interfaces/netmd';

export interface ContextMenuState {
    visible: boolean;
    track:Track | null;
    position: { x: number; y: number } | null;
}

const initialState: ContextMenuState = {
    visible: false,
    track:null,
    position: null,
};

export const slice = createSlice({
    name: 'contextMenu',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setTrack: (state, action: PayloadAction<Track>) => {
            state.track = action.payload;
        },
        setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.position = action.payload;
        },
        openContextMenu: (state, action: PayloadAction<{position: { x: number; y: number }, track:Track}>) => {
            state.visible = true;
            state.position = action.payload.position;
            state.track = action.payload.track;
        },
        closeContextMenu: (state, action: PayloadAction<null>) => {
            state.visible = false;
            state.position = null;
            state.track = null;
        }

    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
