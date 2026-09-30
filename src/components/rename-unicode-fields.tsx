import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions, RenameType } from '../redux/rename-dialog-feature';
import { actions as appActions } from '../redux/app-feature';
import { store } from '../redux/store';
import { defaultPinyinSettings, normalizePinyinSettings, PinyinSettings, toPinyin, toJIS, normalizeFullWidth } from '../title-conversion';
import { readUnicodeTag, formatUnicodeTag } from '../unicode-tags';
import { useRenameSources } from './rename-sources';
import type { AdaptiveFile } from '../utils';

const preferenceKey = 'renamePinyinSettings.v1';
function loadSettings(): PinyinSettings {
    try {
        return normalizePinyinSettings(JSON.parse(localStorage.getItem(preferenceKey) || 'null'));
    } catch {
        return { ...defaultPinyinSettings };
    }
}

export function UnicodeRenameFields({
    what,
    allowFullWidth,
    supportsFullWidth,
    titleError,
    fullWidthError,
    onKeyDown,
}: {
    what: string;
    allowFullWidth: boolean;
    supportsFullWidth: boolean;
    titleError: string;
    fullWidthError: string;
    onKeyDown: (event: React.KeyboardEvent) => void;
}) {
    const dispatch = useDispatch();
    const state = useShallowEqualSelector((state) => state.renameDialog);
    const sources = useRenameSources();
    const [settings, setSettings] = useState(loadSettings);
    const [draft, setDraft] = useState(settings);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const { title, fullWidthTitle, unicodeTitle, unicodeSource, sourceId, renameType, visible, sessionId, tagLoading, tagError } = state;

    async function reloadTag(file?: File | AdaptiveFile) {
        const current = store.getState().renameDialog;
        dispatch(actions.startTagRead());
        const revision = store.getState().renameDialog.unicodeRevision;
        const token = { sessionId: current.sessionId, revision };
        try {
            const source = file || (current.sourceId ? sources.get(current.sourceId) : undefined);
            if (!source) throw new Error('Source file is no longer available. Select the music file again.');
            const format = current.renameType === RenameType.TRACK_CONVERT_DIALOG ? store.getState().convertDialog.titleFormat : 'title';
            const tag = await readUnicodeTag(source);
            dispatch(actions.finishTagRead({ ...token, title: formatUnicodeTag(tag, format), source: tag.source }));
        } catch (error) {
            dispatch(
                actions.finishTagRead({ ...token, error: `Could not read tag: ${error instanceof Error ? error.message : String(error)}` })
            );
        }
    }

    useEffect(() => {
        setSettingsOpen(false);
        if (visible && state.reloadOnOpen && sourceId) void reloadTag();
        // Each session reads once. Result actions check session AND edit revision.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, sessionId]);

    const canReadTag = renameType === RenameType.TRACK || renameType === RenameType.TRACK_CONVERT_DIALOG;
    const rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', my: 2 } as const;
    return (
        <>
            <TextField
                autoFocus
                id="unicodeTitle"
                label={`Rename ${what} (Unicode)`}
                fullWidth
                margin="normal"
                value={unicodeTitle}
                onChange={(event) => dispatch(actions.setUnicodeName(event.target.value))}
                onKeyDown={onKeyDown}
                helperText={tagError || (tagLoading ? 'Reading tag…' : unicodeSource)}
                error={!!tagError}
            />
            {canReadTag && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {sourceId && (
                        <Button disabled={tagLoading} onClick={() => void reloadTag()}>
                            Reload Tag
                        </Button>
                    )}
                    <Button disabled={tagLoading} onClick={() => fileInput.current?.click()}>
                        Read Tag from File…
                    </Button>
                    <input
                        ref={fileInput}
                        type="file"
                        hidden
                        accept="audio/*,.mp3,.flac,.m4a,.ogg,.opus,.wav,.wma,.oma,.at3,.aea"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file) void reloadTag(file);
                        }}
                    />
                </Box>
            )}
            <Box sx={rowStyle}>
                <TextField
                    id="name"
                    label={`${what} Name`}
                    value={title}
                    onKeyDown={onKeyDown}
                    sx={{ flex: '1 1 240px' }}
                    error={!!titleError}
                    helperText={titleError}
                    onChange={(event) => dispatch(actions.setCurrentName(event.target.value))}
                />
                <Button
                    disabled={!unicodeTitle || tagLoading}
                    onClick={() => dispatch(actions.setCurrentName(toPinyin(unicodeTitle, settings)))}
                >
                    To Pinyin
                </Button>
                <Button
                    onClick={() => {
                        setDraft(settings);
                        setSettingsOpen(true);
                    }}
                >
                    Setting
                </Button>
            </Box>
            {supportsFullWidth && !allowFullWidth && (
                <Button onClick={() => dispatch(appActions.setFullWidthSupport(true))}>Enable full-width title editing</Button>
            )}
            {supportsFullWidth && allowFullWidth && (
                <Box sx={rowStyle}>
                    <TextField
                        id="fullWidthTitle"
                        label={`Full-Width ${what} Name`}
                        value={fullWidthTitle}
                        onKeyDown={onKeyDown}
                        sx={{ flex: '1 1 280px' }}
                        error={!!fullWidthError}
                        helperText={fullWidthError}
                        onChange={(event) => dispatch(actions.setCurrentFullWidthName(event.target.value))}
                        onBlur={() => dispatch(actions.setCurrentFullWidthName(normalizeFullWidth(fullWidthTitle)))}
                    />
                    <Button
                        disabled={!unicodeTitle || tagLoading}
                        onClick={() => dispatch(actions.setCurrentFullWidthName(toJIS(unicodeTitle)))}
                    >
                        To JIS
                    </Button>
                </Box>
            )}
            <Dialog
                open={settingsOpen && visible}
                onClose={() => setSettingsOpen(false)}
                maxWidth="xs"
                fullWidth
                aria-labelledby="pinyin-settings-title"
            >
                <DialogTitle id="pinyin-settings-title">Pinyin Setting</DialogTitle>
                <DialogContent>
                    <TextField
                        select
                        fullWidth
                        margin="normal"
                        label="Separator"
                        value={draft.separator}
                        onChange={(event) => setDraft({ ...draft, separator: event.target.value as PinyinSettings['separator'] })}
                    >
                        <MenuItem value=" ">Space</MenuItem>
                        <MenuItem value="-">Hyphen (-)</MenuItem>
                        <MenuItem value="">None</MenuItem>
                    </TextField>
                    <TextField
                        select
                        fullWidth
                        margin="normal"
                        label="Letter case"
                        value={draft.letterCase}
                        onChange={(event) => setDraft({ ...draft, letterCase: event.target.value as PinyinSettings['letterCase'] })}
                    >
                        <MenuItem value="lower">lowercase</MenuItem>
                        <MenuItem value="title">Capitalize Each Syllable</MenuItem>
                        <MenuItem value="upper">UPPERCASE</MenuItem>
                    </TextField>
                    <Typography variant="body2">No tones; ü is written as v. Applies to generated pinyin only.</Typography>
                    <Typography sx={{ mt: 2, overflowWrap: 'anywhere' }}>
                        Preview: {toPinyin(unicodeTitle || '孙燕姿 女', draft)}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => {
                            setSettings(draft);
                            localStorage.setItem(preferenceKey, JSON.stringify(draft));
                            setSettingsOpen(false);
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
