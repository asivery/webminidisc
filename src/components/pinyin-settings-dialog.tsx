import React, { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { PinyinSettings, savePinyinSettings, toPinyin } from '../title-conversion';

export function PinyinSettingsDialog({
    open,
    settings,
    source,
    onSave,
    onClose,
}: {
    open: boolean;
    settings: PinyinSettings;
    source: string;
    onSave: (settings: PinyinSettings) => void;
    onClose: () => void;
}) {
    const [draft, setDraft] = useState(settings);
    return (
        <Dialog open={open} onClose={() => onClose()} maxWidth="xs" fullWidth aria-labelledby="pinyin-settings-title">
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
                <Typography sx={{ mt: 2, overflowWrap: 'anywhere' }}>Preview: {toPinyin(source || '孙燕姿 女', draft)}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose()}>Cancel</Button>
                <Button
                    onClick={() => {
                        savePinyinSettings(draft);
                        onSave(draft);
                        onClose();
                    }}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
