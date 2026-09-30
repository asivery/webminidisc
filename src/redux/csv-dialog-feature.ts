import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import type { CsvTitle, CsvTitleDraft } from '../csv-titles';

const slice = createSlice({
    name: 'csvDialog',
    initialState: { draft: null as CsvTitleDraft | null, busy: false, error: '' },
    reducers: {
        open: (state, action: PayloadAction<CsvTitleDraft>) => {
            state.draft = action.payload;
            state.error = '';
        },
        close: (state) => {
            if (!state.busy) {
                state.draft = null;
                state.error = '';
            }
        },
        edit: (state, action: PayloadAction<{ id: string; field: 'title' | 'fullWidthTitle' | 'unicodeTitle'; value: string }>) => {
            if (state.busy) return;
            const row = state.draft?.titles.find((title: CsvTitle) => title.id === action.payload.id);
            if (row) row[action.payload.field] = action.payload.value;
        },
        setBusy: (state, action: PayloadAction<boolean>) => {
            state.busy = action.payload;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
    },
});
export const { actions, reducer } = slice;
export default enableBatching(reducer);
