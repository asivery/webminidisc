import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { LocalDatabase } from '../services/library/library';

export interface LocalLibraryState {
    visible: boolean;
    database: LocalDatabase | null;
    status: string | null;
}

const initialState: LocalLibraryState = {
    visible: false,
    database: null,
    status: null,
};

const slice = createSlice({
    name: 'localLibraryState',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setDatabase: (state, action: PayloadAction<LocalDatabase | null>) => {
            state.database = action.payload;
        },
        setStatus: (state, action: PayloadAction<string | null>) => {
            state.status = action.payload;
        },
    },
});

export const { actions, reducer } = slice;
export default enableBatching(reducer);
