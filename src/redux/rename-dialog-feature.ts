import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';

export enum RenameType {
    TRACK,
    DISC,
    GROUP,
    HIMD,
    HIMD_DISC,
    TRACK_CONVERT_DIALOG,
    TRACK_CONVERT_DIALOG_HIMD,
    SONG_RECOGNITION_TITLE,
}

export interface RenameDialogState {
    unicodeTitle: string;
    unicodeSource: string;
    sourceId: string | null;
    reloadOnOpen: boolean;
    sessionId: number;
    unicodeRevision: number;
    tagLoading: boolean;
    tagError: string;
    visible: boolean;
    title: string;
    fullWidthTitle: string;

    renameType: RenameType;
    index: number;

    himdTitle: string;
    himdAlbum: string;
    himdArtist: string;
}

const initialState: RenameDialogState = {
    unicodeTitle: '',
    unicodeSource: '',
    sourceId: null,
    reloadOnOpen: false,
    sessionId: 0,
    unicodeRevision: 0,
    tagLoading: false,
    tagError: '',
    visible: false,
    title: '',
    fullWidthTitle: '',

    renameType: RenameType.DISC,
    index: 0,

    himdTitle: '',
    himdAlbum: '',
    himdArtist: '',
};

export const slice = createSlice({
    name: 'renameDialog',
    initialState,
    reducers: {
        setVisible: (state: RenameDialogState, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
            if (!action.payload) {
                state.sessionId++;
                state.tagLoading = false;
            }
        },
        setCurrentName: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.title = action.payload;
        },
        setCurrentFullWidthName: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.fullWidthTitle = action.payload;
        },

        setRenameType: (state: RenameDialogState, action: PayloadAction<RenameType>) => {
            state.renameType = action.payload;
            state.unicodeTitle = state.fullWidthTitle || state.title;
            state.unicodeSource = state.fullWidthTitle ? 'Existing Full-Width title' : 'Existing title';
            state.sourceId = null;
            state.reloadOnOpen = false;
            state.sessionId++;
            state.unicodeRevision = 0;
            state.tagError = '';
            state.tagLoading = false;
        },
        setUnicodeName: (state, action: PayloadAction<string>) => {
            state.unicodeTitle = action.payload;
            state.unicodeSource = 'Edited Unicode title';
            state.tagError = '';
            state.unicodeRevision++;
            state.tagLoading = false;
        },
        setUnicodeSource: (state, action: PayloadAction<{ title: string; source: string; sourceId: string; reload: boolean }>) => {
            state.unicodeTitle = action.payload.title;
            state.unicodeSource = action.payload.source;
            state.sourceId = action.payload.sourceId;
            state.reloadOnOpen = action.payload.reload;
        },
        startTagRead: (state) => {
            state.tagLoading = true;
            state.tagError = '';
            state.unicodeRevision++;
        },
        finishTagRead: (
            state,
            action: PayloadAction<{ sessionId: number; revision: number; title?: string; source?: string; error?: string }>
        ) => {
            const result = action.payload;
            if (!state.visible || result.sessionId !== state.sessionId || result.revision !== state.unicodeRevision) return;
            state.tagLoading = false;
            state.tagError = result.error || '';
            if (result.title !== undefined) {
                state.unicodeTitle = result.title;
                state.unicodeSource = result.source || '';
            }
        },
        setIndex: (state: RenameDialogState, action: PayloadAction<number>) => {
            state.index = action.payload;
        },

        setHimdTitle: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.himdTitle = action.payload;
        },
        setHimdArtist: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.himdArtist = action.payload;
        },
        setHimdAlbum: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.himdAlbum = action.payload;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
