import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { belowDesktop, forAnyDesktop, useDispatch } from '../frontend-utils';
import { useShallowEqualSelector } from "../frontend-utils";

import { actions as localLibraryActions } from '../redux/local-library-feature';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
import { ChonkyActions, FileArray, FileData, FileHelper, FullFileBrowser } from 'chonky';
import { useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { AdaptiveFile, formatTimeFromSeconds } from '../utils';
import { makeStyles } from 'tss-react/mui';
import serviceRegistry from '../services/registry';
import { ExportParams } from '../services/audio/audio-export';
import { LocalDatabase } from '../services/library/library';
import { ChonkyIconFA } from 'chonky-icon-fontawesome';

const Transition = React.forwardRef(function Transition(
    props: SlideProps,
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});
  
const convertToChonkyFiles = (data: LocalDatabase, path: string[] = [], previousRoots: FileData[] = []): FileArray => {
    return Object.entries(data).map(([key, value]) => {
        const isFolder = !('artist' in value);

        const file: FileData = {
            id: [...path, key].join('/'),
            name: key,
            isDir: isFolder,
        };

        if (isFolder) {
            let roots = [...previousRoots, file];
            file.children = convertToChonkyFiles(value as LocalDatabase, [...path, key], roots);
            file.chain = [{ id: 'root', name: "<root>", isDir: true, getSelf: () => null }, ...[...path, key].map((e, i, a) => ({ getSelf: () => roots[i], id: a.slice(0, i+1).join('/'), name: e, isDir: true }))]
        } else {
            file.artist = (value as { artist: string; album: string; title: string }).artist;
            file.album = (value as { artist: string; album: string; title: string }).album;
            file.title = (value as { artist: string; album: string; title: string }).title;
            file.duration = (value as { duration: number }).duration;
        }

        return file;
    });
};

const useStyles = makeStyles()((theme, _params, classes) => ({
    uploadRow: {
        "&:hover": {
            textDecoration: 'line-through',
        },
    },
    wrapperDiv: {
        display: 'flex',
        [forAnyDesktop(theme)]: {
            flexDirection: 'row',
            height: '100%',
        },
        [belowDesktop(theme)]: {
            flexDirection: 'column',
            width: '100%'

        }
    },
    internalDiv: {
        [forAnyDesktop(theme)]: {
            width: '49%',
        },
        [belowDesktop(theme)]: {
            height: '49%',
        },
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    uploadHeader: {
        textAlign: 'center',
        margin: 0,
        marginBottom: theme.spacing(2.5),
    }
}));

export const LocalLibraryDialog = ({ setUploadedFiles }: { setUploadedFiles: (files: AdaptiveFile[]) => void }) => {
    const {classes} = useStyles();
    const dispatch = useDispatch();
    const theme = useTheme();

    const { visible, database, status } = useShallowEqualSelector(state => state.localLibrary);
    const { visible: convertDialogVisible } = useShallowEqualSelector(state => state.convertDialog);

    const handleClose = useCallback(() => {
        dispatch(localLibraryActions.setVisible(false));
    }, [dispatch]);

    const [currentFolderId, setCurrentFolderId] = useState<string>('');
    const [files, setFiles] = useState<FileArray>(convertToChonkyFiles(database || {}));
    const [folderChain, setFolderChain] = useState<FileArray>([{ id: 'root', name: "<root>", isDir: true, getSelf: () => null }]);
    const [selectedFiles, setSelectedFiles] = useState<{path: string, album: string, artist: string, title: string, duration: number}[]>([]);

    const resetToRoot = useMemo(() => () => {
        setFiles(convertToChonkyFiles(database || {}));
        setFolderChain([{ id: 'root', name: "<root>", isDir: true, getSelf: () => null }]);
        setCurrentFolderId("root");
    }, [database]);

    useEffect(() => setFiles(convertToChonkyFiles(database || {})), [database]);

    const handleFileAction = (data: any) => {
        if (data.id === ChonkyActions.OpenFiles.id) {
            let targetFile = data.payload.targetFile;
            if (targetFile.getSelf) targetFile = targetFile.getSelf();
            if (targetFile === null) {
                resetToRoot();
            }
            if (FileHelper.isDirectory(targetFile)) {
                setCurrentFolderId(targetFile.id);
                setFolderChain(targetFile.chain);
                setFiles(targetFile.children || []);
            } else {
                const path = targetFile.id;
                const album = targetFile.album;
                const artist = targetFile.artist;
                const title = targetFile.title;
                const duration = targetFile.duration;
    
                setSelectedFiles(old => {
                    const indexFound = old.findIndex(e => e.path === path);
                    if(indexFound !== -1) {
                        // Delete (unmark)
                        old = [...old];
                        old.splice(indexFound, 1);
                        return old;
                    } else{
                        // Add (mark)
                        return [...old, { album, artist, path, title, duration }];
                    }
                })
    
            }
        }
    };

    const handleForwardFiles = useCallback(() => {
        const adaptiveFiles: AdaptiveFile[] = selectedFiles.map(file => {
            const pathTokens = file.path.split("/");
            const adaptiveFile: AdaptiveFile = {
                album: file.album,
                artist: file.artist,
                title: file.title,
                name: pathTokens[pathTokens.length - 1] || 'unknown.unk',
                duration: file.duration,

                getForEncoding: async (params: ExportParams) => {
                    return serviceRegistry.libraryService!.processLocalLibraryFile(file.path, params);
                }
            }
            return adaptiveFile;
        });
        setUploadedFiles(adaptiveFiles);
        dispatch(localLibraryActions.setVisible(false));
        if(!convertDialogVisible && adaptiveFiles.length) dispatch(convertDialogActions.setVisible(true));
        setSelectedFiles([]);
        resetToRoot();
    }, [convertDialogVisible, selectedFiles, dispatch, setUploadedFiles, resetToRoot]);

    const TypescriptHackFullFileBrowser = FullFileBrowser as any;
    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            fullScreen={true}
            TransitionComponent={Transition as any}
            aria-labelledby="library-dialog-slide-title"
        >
            <DialogTitle id="library-dialog-slide-title">Library</DialogTitle>
            <DialogContent>
                <div className={classes.wrapperDiv}>
                    <div className={classes.internalDiv}>
                        <DialogContentText>{status}&nbsp;</DialogContentText>
                        {visible && <TypescriptHackFullFileBrowser
                            files={files}
                            folderChain={folderChain}
                            onFileAction={handleFileAction}
                            darkMode={theme.palette.mode === 'dark'}
                            iconComponent={ChonkyIconFA}
                            disableSelection={true}
                            disableDragAndDrop={true}
                            defaultFileViewActionId={ChonkyActions.EnableListView.id}
                        />}

                    </div>

                    <div className={classes.internalDiv}>
                        <h4 className={classes.uploadHeader}>Files selected:</h4>
                        <Table size="small" style={{tableLayout: 'fixed'}}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Title</TableCell>
                                    <TableCell>Album</TableCell>
                                    <TableCell>Artist</TableCell>
                                    <TableCell align="right">Duration</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedFiles.map(e => 
                                    (
                                        <TableRow key={e.path} className={classes.uploadRow} onClick={() => setSelectedFiles(old => old.filter(z => z !== e))}>
                                            <TableCell>{e.title}</TableCell>
                                            <TableCell>{e.album}</TableCell>
                                            <TableCell>{e.artist}</TableCell>
                                            <TableCell align="right">{formatTimeFromSeconds(e.duration, false)}</TableCell>
                                        </TableRow>
                                    )
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleForwardFiles}>OK</Button>
            </DialogActions>
        </Dialog>
    );
};
