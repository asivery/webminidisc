import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions } from '../redux/csv-dialog-feature';
import { actions as appActions } from '../redux/app-feature';
import { submitCSVImport } from '../redux/actions';
import { Capability } from '../services/interfaces/netmd';
import { validateCsvTitle } from '../csv-title-import';
import { ChineseConversion, loadPinyinSettings, normalizeFullWidth, toJIS, toPinyin } from '../title-conversion';
import { PinyinSettingsDialog } from './pinyin-settings-dialog';

export function CsvImportDialog() {
    const dispatch = useDispatch();
    const { draft, busy, error } = useShallowEqualSelector((state) => state.csvDialog);
    const capabilities = useShallowEqualSelector((state) => state.main.deviceCapabilities);
    const allowFullWidth = useShallowEqualSelector((state) => state.appState.fullWidthSupport);
    const [settings, setSettings] = useState(loadPinyinSettings);
    const [settingsOpen, setSettingsOpen] = useState(false);
    if (!draft) return null;
    const options = {
        usesHiMDTitles: capabilities.includes(Capability.himdTitles),
        supportsFullWidth: capabilities.includes(Capability.fullWidthSupport),
        allowFullWidth,
    };
    const canConvertFullWidth = !options.usesHiMDTitles && options.supportsFullWidth && allowFullWidth;
    const validated = draft.titles.map((row) => ({ row, validation: validateCsvTitle(row, options) }));
    const invalid = validated.some(({ validation }) => validation.titleError || validation.fullWidthError);
    const edit = (id: string, field: 'title' | 'fullWidthTitle' | 'unicodeTitle', value: string) =>
        dispatch(actions.edit({ id, field, value }));
    return (
        <Dialog
            open
            onClose={() => {
                if (!busy) dispatch(actions.close());
            }}
            maxWidth="lg"
            fullWidth
            aria-labelledby="csv-import-title"
        >
            <DialogTitle id="csv-import-title">Import titles from CSV</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {draft.filename}
                </Typography>
                <Typography variant="body2" sx={{ my: 1 }}>
                    Review titles before importing. To Pinyin fills Name; To JIS fills Full-Width Name. Unicode is your conversion source
                    and is not written to the disc.
                </Typography>
                <Typography variant="body2">Character conversion is not translation. Review the result before importing.</Typography>
                <Button
                    disabled={busy}
                    onClick={() => {
                        setSettings(loadPinyinSettings());
                        setSettingsOpen(true);
                    }}
                >
                    Pinyin Setting
                </Button>
                {!options.usesHiMDTitles && options.supportsFullWidth && !allowFullWidth && (
                    <Button disabled={busy} onClick={() => dispatch(appActions.setFullWidthSupport(true))}>
                        Enable full-width title editing
                    </Button>
                )}
                {error && (
                    <Alert severity="error" sx={{ my: 1 }}>
                        {error}
                    </Alert>
                )}
                {validated.map(({ row, validation }) => (
                    <Box key={row.id} component="section" aria-label={row.label} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle2">{row.label}</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2, mt: 1 }}>
                            <TextField
                                label="Unicode source"
                                value={row.unicodeTitle}
                                disabled={busy}
                                sx={{ flex: '1 1 180px' }}
                                onChange={(event) => edit(row.id, 'unicodeTitle', event.target.value)}
                            />
                            <TextField
                                label="Name"
                                value={row.title}
                                disabled={busy}
                                sx={{ flex: '1 1 180px' }}
                                error={!!validation.titleError}
                                helperText={validation.titleError}
                                onChange={(event) => edit(row.id, 'title', event.target.value)}
                            />
                            {!options.usesHiMDTitles && (
                                <Box sx={{ flex: '1 1 180px' }}>
                                    <TextField
                                        label="Full-Width Name"
                                        fullWidth
                                        value={row.fullWidthTitle}
                                        disabled={busy || !canConvertFullWidth}
                                        error={!!validation.fullWidthError}
                                        helperText={validation.fullWidthError}
                                        onBlur={() => {
                                            if (canConvertFullWidth) edit(row.id, 'fullWidthTitle', normalizeFullWidth(row.fullWidthTitle));
                                        }}
                                        onChange={(event) => edit(row.id, 'fullWidthTitle', event.target.value)}
                                    />
                                    {!canConvertFullWidth && row.fullWidthTitle && (
                                        <Button disabled={busy} onClick={() => edit(row.id, 'fullWidthTitle', '')}>
                                            Clear full-width title
                                        </Button>
                                    )}
                                </Box>
                            )}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pt: 1 }}>
                                <Button
                                    disabled={busy || !row.unicodeTitle}
                                    onClick={() => edit(row.id, 'title', toPinyin(row.unicodeTitle, settings))}
                                >
                                    To Pinyin
                                </Button>
                                <Button
                                    disabled={busy || !row.unicodeTitle || !canConvertFullWidth}
                                    onClick={() => edit(row.id, 'fullWidthTitle', toJIS(row.unicodeTitle))}
                                >
                                    To JIS
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button disabled={busy} onClick={() => dispatch(actions.close())}>
                    Cancel
                </Button>
                <Button variant="contained" disabled={busy || invalid} onClick={() => dispatch(submitCSVImport())}>
                    {busy ? 'Importing…' : 'Import'}
                </Button>
            </DialogActions>
            {settingsOpen && (
                <PinyinSettingsDialog
                    open
                    settings={settings}
                    source={draft.titles[0]?.unicodeTitle ?? ''}
                    onSave={setSettings}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
        </Dialog>
    );
}

export function CsvExportDialog({ onClose, onExport }: { onClose: () => void; onExport: (conversion: ChineseConversion) => void }) {
    const [conversion, setConversion] = useState<ChineseConversion>('none');
    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="csv-export-title">
            <DialogTitle id="csv-export-title">Export titles to CSV</DialogTitle>
            <DialogContent>
                <TextField
                    select
                    fullWidth
                    margin="normal"
                    label="Character conversion"
                    value={conversion}
                    onChange={(event) => setConversion(event.target.value as ChineseConversion)}
                >
                    <MenuItem value="none">No conversion</MenuItem>
                    <MenuItem value="simplified">Simplified Chinese</MenuItem>
                    <MenuItem value="traditional">Traditional Chinese</MenuItem>
                </TextField>
                <Typography variant="body2">
                    Converts Japanese character forms in titles, album, artist and the filename. This is not translation. Disc titles are
                    not changed.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={() => onExport(conversion)}>
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}
