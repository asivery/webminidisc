import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { belowDesktop, forAnyDesktop, useDispatch } from '../frontend-utils';
import { useShallowEqualSelector } from '../frontend-utils';

import { actions as localLibraryActions } from '../redux/local-library-feature';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Button from '@mui/material/Button';
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
import { File, FileBrowser } from './file-browser/browser';
import { Add, ArrowUpward } from '@mui/icons-material';
import { dirSorter, FileType } from './file-browser/utils';

const Transition = React.forwardRef(function Transition(props: SlideProps, ref: React.Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles()((theme, _params, classes) => ({
    uploadRow: {
        '&:hover': {
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
            width: '100%',
        },
    },
    internalDiv: {
        [forAnyDesktop(theme)]: {
            width: '49%',
        },
        [belowDesktop(theme)]: {
            height: '49%',
        },
        display: 'flex',
        overflow: 'auto',
        flexDirection: 'column',
        height: '100%',
    },
    uploadHeader: {
        textAlign: 'center',
        margin: 0,
        marginBottom: theme.spacing(2.5),
    },
    trackIndexCol: {
        width: 60,
    },
}));

export const LocalLibraryDialog = ({ setUploadedFiles }: { setUploadedFiles: (files: AdaptiveFile[]) => void }) => {
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const convertToFileArray = (data: LocalDatabase, path: string[] = []): File[] => {
        const originalPath = [...path];
        path = [...path];
        while (path.length) {
            data = data[path.splice(0, 1)[0]] as any;
        }
        return Object.entries(data).map(([key, value]) => {
            const isFolder = !('artist' in value);
            return {
                name: key,
                type: isFolder ? FileType.Directory : FileType.File,
                props: isFolder
                    ? {}
                    : {
                          ...value,
                          id: [...originalPath, key].join('/'),
                      },
            };
        });
    };

    const { classes } = useStyles();
    const dispatch = useDispatch();
    const theme = useTheme();

    const { visible, database, status } = useShallowEqualSelector((state) => state.localLibrary);
    const { visible: convertDialogVisible } = useShallowEqualSelector((state) => state.convertDialog);

    const handleClose = useCallback(() => {
        dispatch(localLibraryActions.setVisible(false));
    }, [dispatch]);

    const [currentFileTree, setCurrentFileTree] = useState<File[]>(convertToFileArray(database ?? {}));
    useEffect(() => {
        setCurrentFileTree(convertToFileArray(database || {}, currentPath));
    }, [database, currentPath, setCurrentFileTree]);

    const [selectedFiles, setSelectedFiles] = useState<
        { path: string; album: string; artist: string; title: string; duration: number; trackIndex?: number }[]
    >([]);

    const resetToRoot = useMemo(
        () => () => {
            setCurrentPath([]);
        },
        [database, setCurrentPath]
    );

    const addFiles = useCallback(
        (files: File[]) => {
            setSelectedFiles((old) => {
                let current = [...old];
                for (let file of files) {
                    const path = file.props!['id'];
                    const album = file.props!['album'];
                    const artist = file.props!['artist'];
                    const title = file.props!['title'];
                    const duration = file.props!['duration'];
                    const trackIndex = file.props!['trackIndex'];
                    const indexFound = current.findIndex((e) => e.path === path);
                    if (indexFound !== -1) {
                        // Delete (unmark)
                        current.splice(indexFound, 1);
                    } else {
                        // Add (mark)
                        current = [...current, { album, artist, path, title, duration, trackIndex }];
                    }
                }
                return current;
            });
        },
        [setSelectedFiles]
    );

    const handleFileAction = useCallback(
        (file: File) => {
            if (file.type === FileType.Directory) {
                setCurrentPath((e) => [...e, file.name]);
            } else {
                addFiles([file]);
            }
        },
        [addFiles, setCurrentPath]
    );

    const handleAddAllSelected = useCallback(
        (files: File[]) => {
            const process = (path: string[], files: File[]): File[] => {
                const finalFiles = [];
                for (let file of files) {
                    if (file.type === FileType.Directory) {
                        const newPath = [...path, file.name];
                        const subFiles = convertToFileArray(database ?? {}, newPath);
                        subFiles.sort((a, b) => {
                            const dirSortResult = dirSorter(a, b, '', false);
                            if (dirSortResult) return dirSortResult;
                            if (a.props?.['trackIndex'] !== undefined && a.props?.['trackIndex'] !== undefined) {
                                return a.props!['trackIndex'] - b.props!['trackIndex'];
                            }
                            return a.name.localeCompare(b.name);
                        });
                        finalFiles.push(...process(newPath, subFiles));
                    } else {
                        finalFiles.push(file);
                    }
                }
                return finalFiles;
            };

            addFiles(process(currentPath, files));
            return true;
        },
        [addFiles, database, currentPath]
    );

    const handleForwardFiles = useCallback(() => {
        const adaptiveFiles: AdaptiveFile[] = selectedFiles.map((file) => {
            const pathTokens = file.path.split('/');
            const adaptiveFile: AdaptiveFile = {
                album: file.album,
                artist: file.artist,
                title: file.title,
                name: pathTokens[pathTokens.length - 1] || 'unknown.unk',
                duration: file.duration,

                getForEncoding: async (params: ExportParams) => {
                    return serviceRegistry.libraryService!.processLocalLibraryFile(file.path, params);
                },
            };
            return adaptiveFile;
        });
        setUploadedFiles(adaptiveFiles);
        dispatch(localLibraryActions.setVisible(false));
        if (!convertDialogVisible && adaptiveFiles.length) dispatch(convertDialogActions.setVisible(true));
        setSelectedFiles([]);
        resetToRoot();
    }, [convertDialogVisible, selectedFiles, dispatch, setUploadedFiles, resetToRoot]);

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
                        {visible && (
                            <FileBrowser
                                fileTree={currentFileTree}
                                onFileDoubleClick={handleFileAction}
                                columnNotFoundPlaceholder=""
                                manualName={true}
                                allowMultifileSelection={true}
                                defaultSorting={{ by: 'name', asc: false }}
                                pathString={currentPath.join('/')}
                                additionalColumns={[
                                    {
                                        name: 'trackIndex',
                                        overrideName: 'Track Index',
                                        sortable: true,
                                        class: classes.trackIndexCol,
                                    },
                                    {
                                        name: 'name',
                                        sortable: true,
                                    },
                                ]}
                                actions={[
                                    {
                                        name: '',
                                        icon: <ArrowUpward />,
                                        actionPossible: () => currentPath.length > 0,
                                        handler: () => setCurrentPath((e) => e.slice(0, -1)),
                                    },
                                    {
                                        name: 'Root',
                                        icon: <ArrowUpward />,
                                        actionPossible: () => currentPath.length > 0,
                                        handler: () => setCurrentPath([]),
                                    },
                                    {
                                        name: 'Add / Remove Selected',
                                        icon: <Add />,
                                        actionPossible: (e) => e.length > 0,
                                        handler: (e) => handleAddAllSelected(e),
                                    },
                                ]}
                            />
                        )}
                    </div>

                    <div className={classes.internalDiv}>
                        <h4 className={classes.uploadHeader}>Files selected:</h4>
                        <Table size="small" style={{ tableLayout: 'fixed' }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Track #</TableCell>
                                    <TableCell>Title</TableCell>
                                    <TableCell>Album</TableCell>
                                    <TableCell>Artist</TableCell>
                                    <TableCell align="right">Duration</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedFiles.map((e) => (
                                    <TableRow
                                        key={e.path}
                                        className={classes.uploadRow}
                                        onClick={() => setSelectedFiles((old) => old.filter((z) => z !== e))}
                                    >
                                        <TableCell>{e.trackIndex}</TableCell>
                                        <TableCell>{e.title}</TableCell>
                                        <TableCell>{e.album}</TableCell>
                                        <TableCell>{e.artist}</TableCell>
                                        <TableCell align="right">{formatTimeFromSeconds(e.duration, false)}</TableCell>
                                    </TableRow>
                                ))}
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
