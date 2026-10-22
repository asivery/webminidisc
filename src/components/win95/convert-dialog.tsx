import React, { useCallback, useContext, useEffect, useMemo } from 'react';
import { Button, WindowHeader, Fieldset, Select, Table, TableBody, TableDataCell, Divider, Toolbar } from 'react95';
import { DialogOverlay, DialogWindow, DialogFooter, DialogWindowContent, WindowCloseIcon, FooterButton, CustomTableRow } from './common';
import { TitleFormatType } from '../../redux/convert-dialog-feature';
import { DropzoneInputProps, DropzoneRootProps } from 'react-dropzone';
import { ThemeContext } from 'styled-components';
import ArrowUpIconUrl from '../../images/win95/arrowup.png';
import ArrowDownIconUrl from '../../images/win95/arrowdown.png';
import DeleteIconUrl from '../../images/win95/delete.png';
import RenameIconUrl from '../../images/win95/rename.png';
import { MinidiscSpec } from '../../services/interfaces/netmd';

const trackTitleOptions = [
    { value: 'filename', label: 'Filename' },
    { value: 'title', label: 'Title' },
    { value: 'album-title', label: 'Album - Title' },
    { value: 'artist-title', label: 'Artist - Title' },
    { value: 'title-artist', label: 'Title - Artist' },
    { value: 'artist-album-title', label: 'Artist - Album - Title' },
];

export const W95ConvertDialog = (props: {
    visible: boolean;
    codecFamilyIndex: number;
    titleFormat: TitleFormatType;
    minidiscSpec: MinidiscSpec,
    titles: { title: string; fullWidthTitle: string }[];
    loadingMetadata: boolean;
    availableCharacters: { halfWidth: number; fullWidth: number };
    availableSeconds: number;
    selectedTrackIndex: number;
    renameTrackManually: (index: number) => void;
    setSelectedTrack: React.Dispatch<React.SetStateAction<number>>;
    moveFileUp: () => void;
    moveFileDown: () => void;
    handleClose: () => void;
    handleChangeFormat: (ev: any, newIndex?: number) => void;
    handleChangeTitleFormat: (
        event: React.ChangeEvent<{
            value: any;
        }>
    ) => void;
    handleConvert: () => void;
    tracksOrderVisible: boolean;
    setTracksOrderVisible: React.Dispatch<React.SetStateAction<boolean>>;
    handleToggleTracksOrder: () => void;
    selectedTrackRef: React.MutableRefObject<HTMLDivElement | null>;
    getRootProps: (props?: DropzoneRootProps | undefined) => DropzoneRootProps;
    getInputProps: (props?: DropzoneInputProps | undefined) => DropzoneInputProps;
    isDragActive: boolean;
    open: () => void;
    disableRemove: boolean;
    handleRemoveSelectedTrack: () => void;
    handleRenameSelectedTrack: () => void;
    dialogVisible: boolean;
}) => {
    const themeContext = useContext(ThemeContext)!;
    const recordModeOptions = useMemo(() => props.minidiscSpec.availableFormats.map((e, i) => ({ label: e.userFriendlyName ?? e.codec, value: i })), [props.minidiscSpec]);

    const renderTracks = useCallback(() => {
        return props.titles.map((file, i) => {
            const isSelected = props.selectedTrackIndex === i;
            const ref = isSelected ? props.selectedTrackRef : null;
            return (
                <CustomTableRow
                    key={`${i}`}
                    onClick={() => props.setSelectedTrack(i)}
                    onDoubleClick={() => props.renameTrackManually(i)}
                    ref={ref}
                    style={isSelected ? (themeContext as any).selectedTableRow : {}}
                >
                    <TableDataCell>{file.title}</TableDataCell>
                </CustomTableRow>
            );
        });
    }, [props, themeContext]);

    if (!props.dialogVisible) {
        return null;
    }

    return (
        <DialogOverlay>
            <DialogWindow>
                <WindowHeader style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: '1 1 auto' }}>Upload Settings</span>
                    <Button onClick={props.handleClose}>
                        <WindowCloseIcon />
                    </Button>
                </WindowHeader>
                <DialogWindowContent>
                    <div style={{ display: 'flex', width: '100%' }}>
                        <Fieldset label="Recording Mode" style={{ display: 'flex', flex: '1 1 auto' }}>
                            <Select
                                defaultValue={props.codecFamilyIndex}
                                options={recordModeOptions}
                                width={90}
                                onChange={(format: any) => {
                                    props.handleChangeFormat(null, format.value);
                                }}
                            />
                        </Fieldset>
                        <Fieldset label="Track title" style={{ flex: '1 1 auto', marginLeft: 16 }}>
                            <Select
                                defaultValue={props.titleFormat}
                                options={trackTitleOptions}
                                width={180}
                                onChange={props.handleChangeTitleFormat}
                            />
                        </Fieldset>
                    </div>
                    <p
                        hidden={props.availableCharacters.halfWidth > 0 && props.availableCharacters.fullWidth > 0}
                        style={{ marginTop: '1em' }}
                    >
                        Warning: You have used up all the available characters. Some titles might get cut off.
                    </p>
                    <p hidden={props.availableSeconds >= 0} style={{ marginTop: '1em' }}>
                        Warning: You have used up all the space available on the disc.
                    </p>
                    <p hidden={!props.loadingMetadata} style={{ marginTop: '1em' }}>
                        Reading Metadata...
                    </p>

                    {props.tracksOrderVisible ? (
                        <div {...props.getRootProps()} style={{ width: '100%', marginTop: 16 }}>
                            <Divider style={{ marginTop: 16 }} />
                            <Toolbar style={{ display: 'flex' }}>
                                <Button variant="menu" onClick={props.open}>
                                    Add...
                                </Button>
                                <Button variant="menu" disabled={props.disableRemove} onClick={props.handleRemoveSelectedTrack}>
                                    <img alt="delete" src={DeleteIconUrl} style={{ marginRight: 4 }} />
                                    Remove
                                </Button>
                                <Button variant="menu" disabled={props.disableRemove} onClick={props.handleRenameSelectedTrack}>
                                    <img alt="rename" src={RenameIconUrl} style={{ marginRight: 4 }} />
                                    Rename
                                </Button>
                                <div style={{ flex: '1 1 auto' }}></div>
                                <Button variant="menu" disabled={props.disableRemove} onClick={props.moveFileDown}>
                                    <img alt="Move Down" src={ArrowDownIconUrl} />
                                </Button>
                                <Button variant="menu" disabled={props.disableRemove} onClick={props.moveFileUp}>
                                    <img alt="Move Up" src={ArrowUpIconUrl} />
                                </Button>
                            </Toolbar>
                            <div style={{ maxHeight: '30vh', overflow: 'scroll' }}>
                                <Table>
                                    <TableBody>{renderTracks()}</TableBody>
                                </Table>
                            </div>
                            <input {...props.getInputProps()} />
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button disabled={props.loadingMetadata} onClick={props.handleToggleTracksOrder}>{`${
                            props.tracksOrderVisible ? 'Hide' : 'Show'
                        } Tracks`}</Button>
                        <div style={{ flex: '1 1 auto' }}></div>
                        <FooterButton disabled={props.loadingMetadata || props.availableSeconds < 0} onClick={props.handleConvert}>
                            OK
                        </FooterButton>
                        <FooterButton disabled={props.loadingMetadata} onClick={props.handleClose}>
                            Cancel
                        </FooterButton>
                    </DialogFooter>
                </DialogWindowContent>
            </DialogWindow>
        </DialogOverlay>
    );
};
