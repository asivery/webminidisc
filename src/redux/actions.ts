import { batchActions } from '../frontend-utils';
import { AppDispatch, RootState } from './store';
import { actions as localLibraryActions } from './local-library-feature';
import { actions as uploadDialogActions } from './upload-dialog-feature';
import { actions as renameDialogActions } from './rename-dialog-feature';
import { actions as errorDialogAction } from './error-dialog-feature';
import { actions as recordDialogAction } from './record-dialog-feature';
import { actions as appStateActions } from './app-feature';
import { actions as mainActions } from './main-feature';
import { actions as convertDialogActions } from './convert-dialog-feature';
import { actions as songRecognitionDialogActions, TitleEntry } from './song-recognition-dialog-feature';
import { actions as songRecognitionProgressDialogActions } from './song-recognition-progress-dialog-feature';
import serviceRegistry from '../services/registry';
import { UnknownAction } from '@reduxjs/toolkit';
import {
    sleepWithProgressCallback,
    sleep,
    askNotificationPermission,
    getGroupedTracks,
    timeToSeekArgs,
    TitledFile,
    downloadBlob,
    createDownloadTrackName,
    secondsToNormal,
    getTracks,
    convertToWAV,
    ffmpegTranscode,
    getTrackExtension,
    AdaptiveFile,
} from '../utils';
import NotificationCompleteIconUrl from '../images/record-complete-notification-icon.png';
import { assertNumber, getHalfWidthTitleLength } from 'netmd-js/dist/utils';
import { Capability, NetMDService, Disc, Codec, MinidiscSpec, ExploitCapability } from '../services/interfaces/netmd';
import { getSimpleServices, ServiceConstructionInfo } from '../services/interface-service-manager';
import { AudioServices } from '../services/audio-export-service-manager';
import { checkFactoryCapability, initializeFactoryMode } from './factory/factory-actions';
import { Shazam } from 'shazam-api/dist/api';
import { ExportParams } from '../services/audio/audio-export';
import { LibraryServices } from '../services/library-services';

export function control(action: 'play' | 'stop' | 'next' | 'prev' | 'goto' | 'pause' | 'seek', params?: unknown) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const state = getState();
        switch (action) {
            case 'play':
                await serviceRegistry.netmdService!.play();
                break;
            case 'stop':
                await serviceRegistry.netmdService!.stop();
                break;
            case 'next':
                try {
                    await serviceRegistry.netmdService!.next();
                } catch (e) {
                    // Some devices don't support next() and prev()
                    if (state.main.deviceStatus?.track === state.main.disc!.trackCount - 1 || !state.main.deviceStatus) return;
                    await serviceRegistry.netmdService!.stop();
                    await serviceRegistry.netmdService!.gotoTrack(state.main.deviceStatus.track! + 1);
                    await serviceRegistry.netmdService!.play();
                }
                break;
            case 'prev':
                try {
                    await serviceRegistry.netmdService!.prev();
                } catch (e) {
                    // Some devices don't support next() and prev()
                    if (state.main.deviceStatus?.track === 0 || !state.main.deviceStatus) return;
                    await serviceRegistry.netmdService!.stop();
                    await serviceRegistry.netmdService!.gotoTrack(state.main.deviceStatus.track! - 1);
                    await serviceRegistry.netmdService!.play();
                }
                break;
            case 'pause':
                await serviceRegistry.netmdService!.pause();
                break;
            case 'goto': {
                const trackNumber = assertNumber(params, 'Invalid track number for "goto" command');
                await serviceRegistry.netmdService!.gotoTrack(trackNumber);
                break;
            }
            case 'seek': {
                if (!(params instanceof Object)) {
                    throw new Error('"seek" command has wrong params');
                }
                const typedParams: { trackNumber: number; time: number } = params as any;
                const trackNumber = assertNumber(typedParams.trackNumber, 'Invalid track number for "seek" command');
                const time = assertNumber(typedParams.time, 'Invalid time for "seek" command');
                const timeArgs = timeToSeekArgs(time);
                await serviceRegistry.netmdService!.gotoTime(trackNumber, timeArgs[0], timeArgs[1], timeArgs[2], timeArgs[3]);
                break;
            }
        }
        // CAVEAT: change-track might take a up to a few seconds to complete.
        // We wait 500ms and let the monitor do further updates
        await sleep(500);
        try {
            const deviceStatus = await serviceRegistry.netmdService!.getDeviceStatus();
            dispatch(mainActions.setDeviceStatus(deviceStatus));
        } catch (e) {
            console.log('control: Cannot get device status');
        }
    };
}

export function renameGroup({ groupIndex, newName, newFullWidthName }: { groupIndex: number; newName: string; newFullWidthName?: string }) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        await serviceRegistry!.netmdService?.renameGroup(groupIndex, newName, newFullWidthName);
        listContent()(dispatch);
    };
}

export function groupTracks(indexes: number[]) {
    return async function(dispatch: AppDispatch) {
        const begin = indexes[0];
        const length = indexes[indexes.length - 1] - begin + 1;
        const { netmdService } = serviceRegistry;

        netmdService!.addGroup(begin, length, '');
        listContent()(dispatch);
    };
}

export function deleteGroups(indexes: number[]) {
    return async function(dispatch: AppDispatch) {
        dispatch(appStateActions.setLoading(true));
        const { netmdService } = serviceRegistry;
        const sorted = [...indexes].sort((a, b) => b - a);
        for (const index of sorted) {
            await netmdService!.deleteGroup(index);
        }
        listContent()(dispatch);
    };
}

export function dragDropTrack(sourceList: number, sourceIndex: number, targetList: number, targetIndex: number) {
    // This code is here, because it would need to be duplicated in both netmd and netmd-mock.
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if (sourceList === targetList && sourceIndex === targetIndex) return;
        dispatch(appStateActions.setLoading(true));
        const groupedTracks = getGroupedTracks(await serviceRegistry.netmdService!.listContent());
        // Remove the moved item from its current list
        const movedItem = groupedTracks[sourceList].tracks.splice(sourceIndex, 1)[0];
        let newIndex: number;

        // Calculate bounds
        let boundsStartList, boundsEndList, boundsStartIndex, boundsEndIndex, offset;

        if (sourceList < targetList) {
            boundsStartList = sourceList;
            boundsStartIndex = sourceIndex;
            boundsEndList = targetList;
            boundsEndIndex = targetIndex;
            offset = -1;
        } else if (sourceList > targetList) {
            boundsStartList = targetList;
            boundsStartIndex = targetIndex;
            boundsEndList = sourceList;
            boundsEndIndex = sourceIndex;
            offset = 1;
        } else {
            if (sourceIndex < targetIndex) {
                boundsStartList = boundsEndList = sourceList;
                boundsStartIndex = sourceIndex;
                boundsEndIndex = targetIndex;
                offset = -1;
            } else {
                boundsStartList = boundsEndList = targetList;
                boundsStartIndex = targetIndex;
                boundsEndIndex = sourceIndex;
                offset = 1;
            }
        }

        // Shift indices
        for (let i = boundsStartList; i <= boundsEndList; i++) {
            const startingIndex = i === boundsStartList ? boundsStartIndex : 0;
            const endingIndex = i === boundsEndList ? boundsEndIndex : groupedTracks[i].tracks.length;
            for (let j = startingIndex; j < endingIndex; j++) {
                groupedTracks[i].tracks[j].index += offset;
            }
        }

        // Calculate the moved track's destination index
        if (targetList === 0) {
            newIndex = targetIndex;
        } else {
            if (targetIndex === 0) {
                let prevList = groupedTracks[targetList - 1];
                let i = 2;
                while (prevList && prevList.tracks.length === 0) {
                    // Skip past all the empty lists
                    prevList = groupedTracks[targetList - i++];
                }
                if (prevList) {
                    // If there's a previous list, make this tracks's index previous list's last item's index + 1
                    const lastIndexOfPrevList = prevList.tracks[prevList.tracks.length - 1].index;
                    newIndex = lastIndexOfPrevList + 1;
                } else newIndex = 0; // Else default to index 0
            } else {
                newIndex = groupedTracks[targetList].tracks[0].index + targetIndex;
            }
        }

        if (movedItem.index !== newIndex) {
            await serviceRegistry!.netmdService!.moveTrack(movedItem.index, newIndex, false);
        }

        movedItem.index = newIndex;
        groupedTracks[targetList].tracks.splice(targetIndex, 0, movedItem);
        const ungrouped = [];

        // Recompile the groups and update them on the player
        const normalGroups = [];
        for (const group of groupedTracks) {
            if (group.tracks.length === 0) continue;
            if (group.index === -1) ungrouped.push(...group.tracks);
            else normalGroups.push(group);
        }
        if (ungrouped.length)
            normalGroups.unshift({
                index: 0,
                title: null,
                fullWidthTitle: null,
                tracks: ungrouped,
            });
        await serviceRegistry.netmdService!.rewriteGroups(normalGroups);
        listContent()(dispatch);
    };
}

export function addService(info: ServiceConstructionInfo) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const { availableServices } = getState().appState;
        dispatch(appStateActions.setAvailableServices([...availableServices, info]));
    };
}

export function deleteService(index: number) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if (index < getSimpleServices().length) return;
        const availableServices = [...getState().appState.availableServices];
        availableServices.splice(index, 1);
        dispatch(appStateActions.setLastSelectedService(0));
        dispatch(appStateActions.setAvailableServices(availableServices));
    };
}

export function pair(serviceInstance: NetMDService, spec: MinidiscSpec) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(batchActions([appStateActions.setPairingFailed(false), appStateActions.setFactoryModeRippingInMainUi(false)]));

        serviceRegistry.mediaSessionService?.init(); // no need to await

        serviceRegistry.audioExportService = new AudioServices[getState().appState.audioExportService].create(
            getState().appState.audioExportServiceConfig
        );
        await serviceRegistry.audioExportService!.init();

        let libraryServiceIndex = getState().appState.libraryService;
        if(libraryServiceIndex !== -1) {
            serviceRegistry.libraryService = new LibraryServices[libraryServiceIndex].create(
                getState().appState.libraryServiceConfig
            );
        }

        serviceRegistry.netmdService = serviceInstance;
        serviceRegistry.netmdSpec = spec;
        serviceRegistry.netmdFactoryService = undefined;

        try {
            const connected = await serviceRegistry.netmdService!.connect();
            if (connected) {
                dispatch(appStateActions.setMainView('MAIN'));
                return;
            }
        } catch (err) {
            console.error(err);
            // In case of error, just log and try to pair
        }

        try {
            const paired = await serviceRegistry.netmdService!.pair();
            if (paired) {
                dispatch(
                    batchActions([
                        appStateActions.setMainView('MAIN'),
                        errorDialogAction.setErrorMessage(''),
                        errorDialogAction.setVisible(false),
                    ])
                );
                return;
            }
            dispatch(batchActions([appStateActions.setPairingMessage(`Connection Failed`), appStateActions.setPairingFailed(true)]));
        } catch (err) {
            console.error(err);
            const message = (err as Error).message;
            dispatch(batchActions([appStateActions.setPairingMessage(message), appStateActions.setPairingFailed(true)]));
        }
    };
}

export function listContent(dropCache: boolean = false) {
    return async function(dispatch: AppDispatch) {
        // Issue loading
        dispatch(appStateActions.setLoading(true));
        let disc = null;
        let deviceStatus = null;
        try {
            deviceStatus = await serviceRegistry.netmdService!.getDeviceStatus();
        } catch (e) {
            console.log('listContent: Cannot get device status');
            console.log(e);
        }
        const deviceName = await serviceRegistry.netmdService!.getDeviceName();
        const deviceCapabilities = await serviceRegistry.netmdService!.getServiceCapabilities();

        if (deviceStatus?.discPresent) {
            try {
                disc = await serviceRegistry.netmdService!.listContent(dropCache);
            } catch (err) {
                console.log(err);
                if (!(err as any).message.startsWith('Rejected')) {
                    if (
                        window.confirm(
                            "This disc's title seems to be corrupted, do you wish to erase it?\nNone of the tracks will be deleted."
                        )
                    ) {
                        await serviceRegistry.netmdService!.wipeDiscTitleInfo();
                        disc = await serviceRegistry.netmdService!.listContent(true);
                    } else throw err;
                }
            }
        }
        dispatch(
            batchActions([
                mainActions.setDisc(disc),
                mainActions.setDeviceName(deviceName),
                mainActions.setDeviceStatus(deviceStatus),
                mainActions.setDeviceCapabilities(deviceCapabilities),
                appStateActions.setLoading(false),
            ])
        );
    };
}

export function renameTrack(...entries: { index: number; newName: string; newFullWidthName?: string }[]) {
    return async function(dispatch: AppDispatch) {
        const { netmdService } = serviceRegistry;
        dispatch(batchActions([renameDialogActions.setVisible(false), appStateActions.setLoading(true)]));
        try {
            for (const { index, newName, newFullWidthName } of entries) {
                await netmdService!.renameTrack(index, newName, newFullWidthName);
            }
        } catch (err) {
            console.error(err);
            dispatch(
                batchActions([
                    errorDialogAction.setVisible(true),
                    errorDialogAction.setErrorMessage(`Rename failed.`),
                    appStateActions.setLoading(false),
                ])
            );
        }
        listContent()(dispatch);
    };
}

export function himdRenameTrack(...entries: { index: number; title?: string; album?: string; artist?: string }[]) {
    return async function(dispatch: AppDispatch) {
        const { netmdService } = serviceRegistry;
        dispatch(batchActions([renameDialogActions.setVisible(false), appStateActions.setLoading(true)]));
        try {
            for (const { index, title, album, artist } of entries) {
                netmdService!.renameTrack(index, { title, album, artist });
            }
        } catch (err) {
            console.error(err);
            dispatch(
                batchActions([
                    errorDialogAction.setVisible(true),
                    errorDialogAction.setErrorMessage(`Rename failed.`),
                    appStateActions.setLoading(false),
                ])
            );
        }
        listContent()(dispatch);
    };
}

export function renameDisc({ newName, newFullWidthName }: { newName: string; newFullWidthName?: string }) {
    return async function(dispatch: AppDispatch) {
        const { netmdService } = serviceRegistry;
        await netmdService!.renameDisc(
            newName.replace(/\/\//g, ' /'), // Make sure the title doesn't interfere with the groups
            newFullWidthName?.replace(/／／/g, '／')
        );
        dispatch(renameDialogActions.setVisible(false));
        listContent()(dispatch);
    };
}

export function deleteTracks(indexes: number[]) {
    return async function(dispatch: AppDispatch) {
        const confirmation = window.confirm(
            `Proceed with Delete Track${indexes.length !== 1 ? 's' : ''}? This operation cannot be undone.`
        );
        if (!confirmation) {
            return;
        }
        const { netmdService } = serviceRegistry;
        dispatch(appStateActions.setLoading(true));
        await netmdService!.deleteTracks(indexes);
        listContent()(dispatch);
    };
}

export function wipeDisc() {
    return async function(dispatch: AppDispatch) {
        const confirmation = window.confirm(`Proceed with Wipe Disc? This operation cannot be undone.`);
        if (!confirmation) {
            return;
        }
        const { netmdService } = serviceRegistry;
        dispatch(appStateActions.setLoading(true));
        await netmdService!.wipeDisc();
        listContent()(dispatch);
    };
}

export function ejectDisc() {
    return async function(dispatch: AppDispatch) {
        const { netmdService } = serviceRegistry;
        netmdService!.ejectDisc();
        dispatch(mainActions.setDisc(null));
    };
}

export function moveTrack(srcIndex: number, destIndex: number) {
    return async function(dispatch: AppDispatch) {
        const { netmdService } = serviceRegistry;
        await netmdService!.moveTrack(srcIndex, destIndex);
        listContent()(dispatch);
    };
}

export function downloadTracks(
    indexes: number[],
    convertOutputToWav: boolean,
    callback: (blob: Blob, name: string) => void = downloadBlob
) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(
            batchActions([
                recordDialogAction.setVisible(true),
                recordDialogAction.setProgress({ trackTotal: indexes.length, trackDone: 0, trackCurrent: 0, titleCurrent: '' }),
            ])
        );

        const disc = getState().main.disc;
        const tracks = getTracks(disc!).filter(t => indexes.indexOf(t.index) >= 0);

        const { netmdService } = serviceRegistry;

        for (const [i, track] of tracks.entries()) {
            dispatch(
                recordDialogAction.setProgress({
                    trackTotal: tracks.length,
                    trackDone: i,
                    trackCurrent: -1,
                    titleCurrent: track.title ?? '',
                })
            );
            try {
                let { data } = (await netmdService!.download(track.index, ({ read, total }) => {
                    dispatch(
                        recordDialogAction.setProgress({
                            trackTotal: tracks.length,
                            trackDone: i,
                            trackCurrent: (100 * read) / total,
                            titleCurrent: track.title ?? '',
                        })
                    );
                }))!;
                let fileName = createDownloadTrackName(track);
                if (convertOutputToWav) {
                    data = await convertToWAV(data, track);
                    fileName = fileName.slice(0, -3) + 'wav';
                }
                callback(new Blob([data], { type: 'application/octet-stream' }), fileName);
            } catch (err) {
                console.error(err);
                dispatch(
                    batchActions([
                        recordDialogAction.setVisible(false),
                        errorDialogAction.setVisible(true),
                        errorDialogAction.setErrorMessage(`Download failed. Are you using a disc recorded by SonicStage?`),
                    ])
                );
            }
        }

        dispatch(recordDialogAction.setVisible(false));
    };
}

export function recordTracks(indexes: number[], deviceId: string) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(
            batchActions([
                recordDialogAction.setVisible(true),
                recordDialogAction.setProgress({ trackTotal: indexes.length, trackDone: 0, trackCurrent: 0, titleCurrent: '' }),
            ])
        );

        const disc = getState().main.disc;
        const tracks = getTracks(disc!).filter(t => indexes.indexOf(t.index) >= 0);

        const { netmdService, mediaRecorderService } = serviceRegistry;
        await serviceRegistry.netmdService!.stop();

        for (const [i, track] of tracks.entries()) {
            dispatch(
                recordDialogAction.setProgress({
                    trackTotal: tracks.length,
                    trackDone: i,
                    trackCurrent: -1,
                    titleCurrent: track.title ?? '',
                })
            );

            // Wait for the track to be ready to play from 0:00
            await netmdService!.gotoTrack(track.index);
            await netmdService!.play();
            console.log('Waiting for track to be ready to play');
            let position = await netmdService!.getPosition();
            const expected = [track.index, 0, 0, 1];
             
            while (position === null || !expected.every((_, i) => expected[i] === position![i])) {
                await sleep(250);
                position = await netmdService!.getPosition();
            }
            await netmdService!.pause();
            await netmdService?.gotoTrack(track.index);
            console.log('Track is ready to play');

            // Start recording and play track
            await mediaRecorderService?.initStream(deviceId);
            await mediaRecorderService?.startRecording();
            await netmdService!.play();

            // Wait until track is finished
            // await sleep(durationInSec * 1000);
            await sleepWithProgressCallback(track.duration * 1000, (perc: number) => {
                dispatch(
                    recordDialogAction.setProgress({
                        trackTotal: tracks.length,
                        trackDone: i,
                        trackCurrent: perc,
                        titleCurrent: track.title ?? '',
                    })
                );
            });

            // Stop recording and download the wav
            await mediaRecorderService?.stopRecording();
            let title;
            if (track.title) {
                title = `${track.index + 1}. ${track.title}`;
                if (track.fullWidthTitle) {
                    title += ` (${track.fullWidthTitle})`;
                }
            } else if (track.fullWidthTitle) {
                title = `${track.index + 1}. ${track.fullWidthTitle}`;
            } else {
                title = `Track ${track.index + 1}`;
            }
            mediaRecorderService?.downloadRecorded(`${title}`);

            await mediaRecorderService?.closeStream();
        }

        await netmdService!.stop();
        dispatch(recordDialogAction.setVisible(false));
    };
}

export function renameInConvertDialog({ index, newName, newFullWidthName }: { index: number; newName: string; newFullWidthName: string }) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const newTitles = [...getState().convertDialog.titles];
        newTitles.splice(index, 1, {
            ...newTitles[index],
            title: newName,
            fullWidthTitle: newFullWidthName,
        });
        dispatch(convertDialogActions.setTitles(newTitles));
    };
}

export function renameInConvertDialogHiMD({
    index,
    title,
    album,
    artist,
}: {
    index: number;
    title: string;
    album: string;
    artist: string;
}) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const newTitles = [...getState().convertDialog.titles];
        newTitles.splice(index, 1, {
            ...newTitles[index],
            title,
            artist,
            album,
        });
        dispatch(convertDialogActions.setTitles(newTitles));
    };
}

export function renameInSongRecognitionDialog({
    index,
    newName,
    newFullWidthName,
}: {
    index: number;
    newName: string;
    newFullWidthName: string;
}) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const newTitles = [...getState().songRecognitionDialog.titles];
        newTitles.splice(index, 1, {
            ...newTitles[index],
            manualOverrideNewTitle: newName,
            manualOverrideNewFullWidthTitle: newFullWidthName,

            selectedToRecognize: true,
            recognizeFail: false,
            alreadyRecognized: true,
        });
        dispatch(songRecognitionDialogActions.setTitles(newTitles));
    };
}

export function selfTest() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if (!window.confirm('Warning - This is a destructive self test. THE DISC WILL BE ERASED! Continue?')) return;

        const { netmdService } = serviceRegistry;

        const allTracks = (disc: Disc) => disc.groups.sort((a, b) => a.tracks[0].index - b.tracks[0].index).flatMap(n => n.tracks);

        const compareOrThrow = (a: any, b: any) => {
            if (a === b) return true;
            throw new Error(`Compare: ${a} and ${b} is not the same.`);
        };

        const tests = [
            {
                name: 'Reload TOC',
                func: async () => {
                    await netmdService!.listContent();
                    return true;
                },
            },
            {
                name: 'Rename Disc',
                func: async () => {
                    const titleToSet = 'Self-Test Half-Width';
                    await netmdService!.renameDisc(titleToSet);
                    return compareOrThrow((await netmdService!.listContent()).title, titleToSet);
                },
            },
            {
                name: 'Full-Width Rename Disc',
                func: async () => {
                    const titleToSet = 'Ｓｅｌｆ－Ｔｅｓｔ\u3000Ｆｕｌｌ－Ｗｉｄｔｈ';
                    await netmdService!.renameDisc('1', titleToSet);
                    return compareOrThrow((await netmdService!.listContent()).fullWidthTitle, titleToSet);
                },
            },
            {
                name: 'Rename Track 1, 2',
                func: async () => {
                    await netmdService!.renameTrack(0, '1');
                    await netmdService!.renameTrack(1, '2');
                    const content = allTracks(await netmdService!.listContent());
                    return compareOrThrow(content[0].title, '1') && compareOrThrow(content[1].title, '2');
                },
            },
            {
                name: 'Full-Width Rename Track 1',
                func: async () => {
                    const titleToSet = 'Ｓｅｌｆ－Ｔｅｓｔ\u3000Ｔｒａｃｋ\u3000Ｆｕｌｌ－Ｗｉｄｔｈ';
                    await netmdService!.renameTrack(1, '2', titleToSet);
                    return compareOrThrow(allTracks(await netmdService!.listContent())[1].fullWidthTitle, titleToSet);
                },
            },
            {
                name: 'Move Track 1 to 2',
                func: async () => {
                    await netmdService!.moveTrack(0, 1, false);
                    const content = allTracks(await netmdService!.listContent());
                    return compareOrThrow(content[0].title, '2') && compareOrThrow(content[1].title, '1');
                },
            },
            {
                name: 'Play Track 1',
                func: async () => {
                    await netmdService!.gotoTrack(0);
                    await netmdService!.play();
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Next Track',
                func: async () => {
                    await netmdService!.next();
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Previous Track',
                func: async () => {
                    await netmdService!.prev();
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Go To Track 2',
                func: async () => {
                    await netmdService!.gotoTrack(1);
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Pause',
                func: async () => {
                    await netmdService!.pause();
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Stop',
                func: async () => {
                    await netmdService!.stop();
                    await sleep(1000);
                    return true;
                },
            },
            {
                name: 'Delete Track 1',
                func: async () => {
                    const beforeDelete = allTracks(await netmdService!.listContent()).length;
                    await netmdService!.deleteTracks([0]);
                    const afterDelete = allTracks(await netmdService!.listContent()).length;
                    return compareOrThrow(beforeDelete, afterDelete + 1);
                },
            },
            {
                name: 'Erase Disc',
                func: async () => {
                    await netmdService!.wipeDisc();
                    return compareOrThrow(allTracks(await netmdService!.listContent()).length, 0);
                },
            },
        ];

        const progress = { trackTotal: tests.length, trackDone: 0, trackCurrent: 0, titleCurrent: '' };

        // As this isn't a feature that's going to be used a lot, I decided to just use the recording dialog for it
        // And not define a new one.
        dispatch(batchActions([recordDialogAction.setVisible(true), recordDialogAction.setProgress(progress)]));

        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            progress.trackCurrent = (i / (tests.length - 1)) * 100;
            progress.trackDone = i;
            progress.titleCurrent = `Self-Test: ${test.name}`;
            dispatch(recordDialogAction.setProgress(progress));
            console.group(`Test: ${test.name}`);
            let success = false;
            try {
                success = await test.func();
            } catch (ex) {
                console.log(ex);
            }
            if (!success) {
                console.log('FAIL');
                console.groupEnd();
                progress.titleCurrent = `Self-Test: ${test.name} - FAILED`;
                dispatch(recordDialogAction.setProgress(progress));
                if (!window.confirm(`Test '${test.name}' has failed. There's more info in the console. Continue?`)) {
                    return;
                }
            } else {
                console.log('PASS');
                console.groupEnd();
                progress.titleCurrent = `Self-Test: ${test.name} - PASSED`;
            }
            dispatch(recordDialogAction.setProgress(progress));
            await sleep(250); //Just to see what's happening
        }
        alert('All tests have passed. The page will now reload');
        await sleep(1000);
        window.reload();
        dispatch(recordDialogAction.setVisible(false));
    };
}
export function setNotifyWhenFinished(value: boolean) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if (Notification.permission !== 'granted') {
            const confirmation = window.confirm(`Enable Notification on recording completed?`);
            if (!confirmation) {
                return;
            }
            const result = await askNotificationPermission();
            if (result !== 'granted') {
                dispatch(appStateActions.setNotificationSupport(false));
                dispatch(appStateActions.setNotifyWhenFinished(false));
                return;
            }
        }
        dispatch(appStateActions.setNotifyWhenFinished(value));
    };
}

const csvHeaderOld = ['INDEX', 'GROUP RANGE', 'GROUP NAME', 'GROUP FULL WIDTH NAME', 'NAME', 'FULL WIDTH NAME', 'DURATION', 'ENCODING'];
const csvHeader = [
    'INDEX',
    'GROUP RANGE',
    'GROUP NAME',
    'GROUP FULL WIDTH NAME',
    'NAME',
    'FULL WIDTH NAME',
    'ALBUM',
    'ARTIST',
    'DURATION',
    'ENCODING',
    'BITRATE',
];

export function exportCSV(callback: (blob: Blob, name: string) => void = downloadBlob) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(appStateActions.setLoading(true));
        const disc = await serviceRegistry.netmdService!.listContent();
        const rows: string[][] = [];
        rows.push([
            '0', // track index - 0 is disc title
            '0-0', // No group range
            '', // No group name
            '', // No group fw name
            disc.title ?? '',
            disc.fullWidthTitle ?? '',
            '', // no album
            '', // no artist
            '' + disc.used,
            '',
            '',
        ]);
        for (const group of disc.groups) {
            const groupStart = Math.min(...group.tracks.map(e => e.index));
            const groupEnd = Math.max(...group.tracks.map(e => e.index));
            const groupRange = group.title === null ? '' : `${groupStart}-${groupEnd}`;
            for (const track of group.tracks) {
                rows.push([
                    '' + (track.index + 1),
                    groupRange,
                    group.title ?? '',
                    group.fullWidthTitle ?? '',
                    track.title ?? '',
                    track.fullWidthTitle ?? '',
                    track.album ?? '',
                    track.artist ?? '',
                    '' + track.duration,
                    track.encoding.codec,
                    track.encoding.bitrate?.toString() ?? '',
                ]);
            }
        }
        const csvDocument = [csvHeader, ...rows].map(e => e.map(q => q.toString().replace(/,/g, '\\,')).join(',')).join('\n');

        let title;
        if (disc.title) {
            title = disc.title;
            if (disc.fullWidthTitle) {
                title += ` (${disc.fullWidthTitle})`;
            }
        } else if (disc.fullWidthTitle) {
            title = disc.fullWidthTitle;
        } else {
            title = 'Disc';
        }

        callback(new Blob([csvDocument]), title + '.csv');
        dispatch(appStateActions.setLoading(false));
    };
}

export function importCSV(file: File) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const text = new TextDecoder('utf-8').decode(await file.arrayBuffer());
        const usesHiMDTitles = getState().main.deviceCapabilities.includes(Capability.himdTitles);
        const records = text
            .split('\n')
            .map(e => e.trim())
            .filter(e => e.length !== 0)
            .map(e => e.split(/(?<!\\),/g).map(x => x.replace(/\\,/g, ',')));

        if (records.length === 0) {
            alert('Empty CSV file');
            return;
        }

        // Backwards-compatibility
        if (records[0].every((e, i) => e === csvHeaderOld[i])) {
            // It's using the old format
            records[0] = [...csvHeader];
            for (let i = 1; i < records.length; i++) {
                records[i].splice(6, 0, '', ''); // ALBUM, ARTIST
                records[i].push(''); // BITRATE
            }
        }

        if (records[0].some((e, i) => e !== csvHeader[i])) {
            alert('Malformed CSV file');
            return;
        }

        const addedGroupRanges = new Set<string>();

        const isTimeDifferenceAcceptable = (a: number, b: number) => Math.abs(a - b) < 2;

        // Make sure the CSV matches the disc
        dispatch(appStateActions.setLoading(true));
        const disc = await serviceRegistry.netmdService!.listContent();
        const ungroupedTracks = getTracks(disc).sort((a, b) => a.index - b.index);
        if (disc.trackCount !== records.length - 2) {
            // - 2 - one for the header, second for the disc title / info
            if (
                !window.confirm(
                    `The CSV file describes a disc with ${records.length - 2} tracks.\nThe disc inserted has ${
                        disc.trackCount
                    } tracks.\nContinue importing?`
                )
            ) {
                dispatch(appStateActions.setLoading(false));
                return;
            }
        }

        await serviceRegistry.netmdService!.wipeDiscTitleInfo();

        for (const [sIndex, grRange, groupName, groupFullWidthName, name, fwName, album, artist, sDuration, codec, bitrate] of records.slice(
            1
        )) {
            const index = parseInt(sIndex),
                duration = parseInt(sDuration),
                gRange = grRange.replace(/ /g, '');
            if (index === 0) {
                // Disc title info
                await serviceRegistry.netmdService!.renameDisc(name, fwName);
                continue;
            }
            if (!ungroupedTracks[index - 1]) {
                // Editing track that's not part of the disc.
                // Skip.
                continue;
            }

            const currentTrackEncoding = ungroupedTracks[index - 1].encoding;
            if (
                !isTimeDifferenceAcceptable(ungroupedTracks[index - 1].duration, duration) ||
                currentTrackEncoding.codec.toLowerCase() !== codec.toLowerCase() ||
                (bitrate !== '' && currentTrackEncoding.bitrate !== parseInt(bitrate))
            ) {
                const bitrateDescription = bitrate === '' ? '' : ` (${bitrate} kbps)`;
                const actualBitrateDescription =
                    currentTrackEncoding.bitrate === undefined ? '' : ` (${currentTrackEncoding.bitrate} kbps)`;
                if (
                    !window.confirm(
                        `
                    The CSV file describes track ${index} as a ${secondsToNormal(
                            duration
                        )} ${codec}${bitrateDescription} track. The actual track ${index} is a ${secondsToNormal(
                            ungroupedTracks[index - 1].duration
                        )} ${currentTrackEncoding.codec}${actualBitrateDescription} track. Label it according to the file?
                        `.trim()
                    )
                ) {
                    continue;
                }
            }

            if (gRange !== '') {
                // Is part of group
                if (!addedGroupRanges.has(gRange)) {
                    addedGroupRanges.add(gRange);
                    const [startS, endS] = gRange.split('-');
                    const start = parseInt(startS),
                        end = parseInt(endS),
                        length = end - start + 1;
                    await serviceRegistry.netmdService!.addGroup(start, length, groupName, groupFullWidthName);
                }
            }

            if (usesHiMDTitles) {
                await serviceRegistry.netmdService!.renameTrack(index - 1, { title: name, album, artist });
            } else {
                await serviceRegistry.netmdService!.renameTrack(index - 1, name, fwName);
            }
        }

        listContent()(dispatch);
    };
}

export function openRecognizeTrackDialog(selectedTracks: number[]) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const { deviceCapabilities } = getState().main;
        if (deviceCapabilities.length > 0 && !deviceCapabilities.includes(Capability.factoryMode)) {
            dispatch(songRecognitionDialogActions.setImportMethod('line-in'));
        }

        dispatch(
            batchActions([
                songRecognitionDialogActions.setTitles(
                    getTracks(getState().main.disc!)
                        .sort((a, b) => a.index - b.index)
                        .map(track => ({
                            originalTitle: track.title ?? '',
                            originalFullWidthTitle: track.fullWidthTitle ?? '',
                            index: track.index,

                            newTitle: '',
                            newFullWidthTitle: '',
                            manualOverrideNewTitle: '',
                            manualOverrideNewFullWidthTitle: '',

                            unsanitizedTitle: null,

                            songAlbum: '',
                            songArtist: '',
                            songTitle: '',

                            selectedToRecognize: selectedTracks.includes(track.index),
                            alreadyRecognized: false,
                            recognizeFail: false,
                        }))
                ),
                songRecognitionDialogActions.setVisible(true),
            ])
        );
    };
}

export function recognizeTracks(_trackEntries: TitleEntry[], mode: 'exploits' | 'line-in', inputModeConfiguration?: { deviceId?: string }) {
    const trackEntries = [..._trackEntries];
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const shazam = new Shazam();

        // Bypass CORS
        shazam.endpoint.sendRecognizeRequest = async (url: string, body: string) => {
            return await window.native!.unrestrictedFetchJSON(url, {
                method: 'POST',
                body,
                headers: shazam.endpoint.headers(),
            });
        };

        const toRecognize = trackEntries.filter(n => n.selectedToRecognize && !n.alreadyRecognized);

        dispatch(
            batchActions([
                songRecognitionProgressDialogActions.setCancelled(false),
                songRecognitionProgressDialogActions.setVisible(true),
                songRecognitionProgressDialogActions.setCurrentTrack(0),
                songRecognitionProgressDialogActions.setTotalTracks(toRecognize.length),
            ])
        );

        if (mode === 'exploits') {
            if (!(await checkFactoryCapability(dispatch, ExploitCapability.downloadAtrac))) {
                window.alert(
                    'Cannot enable homebrew mode ripping in main UI.\nThis device is not supported yet.\nStay tuned for future updates.'
                );
                dispatch(songRecognitionProgressDialogActions.setVisible(false));
                return;
            }
            await serviceRegistry.netmdFactoryService!.prepareDownload(getState().appState.factoryModeUseSlowerExploit);
        }

        let i = 0;
        let toRecognizeI = 0;
        for (const trackEntry of trackEntries) {
            if (!trackEntry.selectedToRecognize || trackEntry.alreadyRecognized) {
                i++;
                continue;
            }
            const SECONDS_TO_OFFSET = 10;
            const TRY_COUNT = 2;
            const SECONDS_TO_READ = 16;
            const MIN_DURATION = 2*(SECONDS_TO_OFFSET*TRY_COUNT + SECONDS_TO_READ);

            // TRY_COUNT tries to get the song right:
            const track = getTracks(getState().main.disc!).find(e => e.index === trackEntry.index)!;
            dispatch(songRecognitionProgressDialogActions.setCurrentTrack(toRecognizeI));

            if (track.duration < MIN_DURATION){
                trackEntries[i] = {
                    ...trackEntries[i],
                    recognizeFail: true,
                };
                continue;
            }

            for (let offset = 0; offset < SECONDS_TO_OFFSET*TRY_COUNT; offset += SECONDS_TO_OFFSET) {
                let rawSamples: Uint8Array;
                dispatch(
                    batchActions([
                        songRecognitionProgressDialogActions.setCurrentStep(0),
                        songRecognitionProgressDialogActions.setCurrentStepProgress(0),
                        songRecognitionProgressDialogActions.setCurrentStepTotal(1),
                    ])
                );

                const optimalStartSeconds = track.duration / 2 + offset;

                if (mode === 'exploits') {
                    // Download the track

                    const atracData = await serviceRegistry.netmdFactoryService!.exploitDownloadTrack(
                        trackEntry.index,
                        false,
                        e =>
                            dispatch(
                                batchActions([
                                    songRecognitionProgressDialogActions.setCurrentStepProgress(e.read),
                                    songRecognitionProgressDialogActions.setCurrentStepTotal(e.total),
                                ])
                            ),
                        {
                            secondsToRead: SECONDS_TO_READ,
                            startSeconds: optimalStartSeconds,
                            writeHeader: true,
                        }
                    );

                    dispatch(
                        batchActions([
                            songRecognitionProgressDialogActions.setCurrentStepProgress(-1),
                            songRecognitionProgressDialogActions.setCurrentStepTotal(0),
                            songRecognitionProgressDialogActions.setCurrentStep(1),
                        ])
                    );

                    rawSamples = await ffmpegTranscode(atracData, getTrackExtension(track), '-ar 16000 -ac 1 -f s16le');
                } else {
                    const deviceId = inputModeConfiguration!.deviceId!;
                    dispatch(songRecognitionProgressDialogActions.setCurrentStepTotal(100));

                    const { mediaRecorderService, netmdService } = serviceRegistry;
                    await netmdService?.stop();
                    await netmdService?.gotoTrack(track.index);
                    await netmdService?.gotoTime(
                        track.index,
                        Math.floor(optimalStartSeconds / 3600),
                        Math.floor((optimalStartSeconds % 3600) / 60),
                        optimalStartSeconds % 60,
                        0
                    );
                    await netmdService?.play();
                    await mediaRecorderService?.initStream(deviceId);
                    await mediaRecorderService?.startRecording();
                    await sleepWithProgressCallback(SECONDS_TO_READ * 1000, (perc: number) => {
                        dispatch(songRecognitionProgressDialogActions.setCurrentStepProgress(perc));
                    });
                    await mediaRecorderService?.stopRecording();
                    await netmdService?.stop();
                    dispatch(
                        batchActions([
                            songRecognitionProgressDialogActions.setCurrentStepProgress(-1),
                            songRecognitionProgressDialogActions.setCurrentStepTotal(0),
                            songRecognitionProgressDialogActions.setCurrentStep(1),
                        ])
                    );
                    const rawWav = await new Promise<Uint8Array>(res =>
                        mediaRecorderService!.recorder.exportWAV(async (blob: Blob) => res(new Uint8Array(await blob.arrayBuffer())))
                    );
                    rawSamples = await ffmpegTranscode(rawWav, 'wav', '-ar 16000 -ac 1 -f s16le');
                    await mediaRecorderService?.closeStream();
                }
                dispatch(batchActions([songRecognitionProgressDialogActions.setCurrentStepProgress(-1)]));

                const samplesArray = [];
                for (let i = 0; i < rawSamples.length / 2; i++) {
                    samplesArray.push(rawSamples[2 * i] | (rawSamples[2 * i + 1] << 8));
                }
                const songData = await shazam.recognizeSong(samplesArray, state =>
                    dispatch(songRecognitionProgressDialogActions.setCurrentStep(state === 'generating' ? 1 : 2))
                );
                if (songData !== null) {
                    trackEntries[i] = {
                        ...trackEntries[i],
                        alreadyRecognized: true,
                        recognizeFail: false,

                        songTitle: songData.title,
                        songArtist: songData.artist,
                        songAlbum: songData.album ?? 'Unknown',
                    };
                    break;
                } else {
                    trackEntries[i] = {
                        ...trackEntries[i],
                        recognizeFail: true,
                    };
                }
                if (getState().songRecognitionProgressDialog.cancelled) break;
            }
            if (getState().songRecognitionProgressDialog.cancelled) break;
            i++;
            toRecognizeI++;
        }
        if (mode === 'exploits') await serviceRegistry.netmdFactoryService!.finalizeDownload();
        dispatch(
            batchActions([songRecognitionDialogActions.setTitles(trackEntries), songRecognitionProgressDialogActions.setVisible(false)])
        );
    };
}

export function flushDevice() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const { netmdService } = serviceRegistry;
        if (await netmdService!.canBeFlushed()) {
            dispatch(appStateActions.setLoading(true));
            await netmdService!.flush();
            dispatch(batchActions([appStateActions.setLoading(false), mainActions.setFlushable(false)]));
        }
    };
}

export function convertAndUpload(
    files: TitledFile[],
    format: Codec,
    additionalParameters?: { enableReplayGain: boolean }
) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const deviceCapabilities = getState().main.deviceCapabilities;
        if (files.some(e => e.forcedEncoding?.codec === 'SPS' || e.forcedEncoding?.codec === 'SPM')) {
            const removeSPFiles = () => (files = files.filter(e => e.forcedEncoding?.codec !== 'SPS' && e.forcedEncoding?.codec !== 'SPM'));
            if (!deviceCapabilities.includes(Capability.factoryMode)) {
                window.alert('Sorry! Your device cannot enter the factory mode. SP upload is not possible');
                removeSPFiles();
            } else if (!window.confirm("To upload ATRAC1 files back onto the MD, you're required to enter the homebrew mode.\nDo you want to continue?")) {
                window.alert("SP Files won't be transferred");
                removeSPFiles();
            } else if (!(await checkFactoryCapability(dispatch, ExploitCapability.uploadAtrac1))) {
                window.alert("Sorry! Your device doesn't support the SP upload exploit.");
                removeSPFiles();
            }
        }
        if (files.length === 0) return;

        const { audioExportService, netmdService, netmdSpec } = serviceRegistry;
        let { netmdFactoryService } = serviceRegistry;
        if(format.codec === "MONO"){
            // SP MONO is a homebrew feature
            if (!deviceCapabilities.includes(Capability.factoryMode)) {
                window.alert('Sorry! Your device cannot enter the factory mode. SP MONO upload is not possible');
                dispatch(convertDialogActions.setVisible(true));
                return;
            } else if (!window.confirm("To upload MONO ATRAC files onto the MD, you're required to enter the homebrew mode.\nDo you want to continue?")) {
                window.alert("Transfer cancelled");
                dispatch(convertDialogActions.setVisible(true));
                return
            } else if (!(await checkFactoryCapability(dispatch, ExploitCapability.uploadMonoSP))) {
                window.alert("Sorry! Your device doesn't support the SP MONO upload exploit.");
                dispatch(convertDialogActions.setVisible(true));
                return;
            }

            // Reload the factory service from registry
            await initializeFactoryMode()(dispatch);
            netmdFactoryService = serviceRegistry.netmdFactoryService;
            
            // All good - load the exploit
            await netmdFactoryService!.enableMonoUpload(true);
        }

        console.log(await netmdService?.getDeviceStatus());

        let screenWakeLock: any = null;
        if ('wakeLock' in navigator) {
            try {
                screenWakeLock = await (navigator as any).wakeLock.request('screen');
            } catch (ex) {
                console.log(ex);
            }
        }

        await netmdService?.stop();
        dispatch(
            batchActions([
                uploadDialogActions.setVisible(true),
                uploadDialogActions.setCancelUpload(false),
                uploadDialogActions.setWriteProgress({ written: 0, encrypted: 0, total: 1 }),
            ])
        );

        let lastProgress = new Date().getTime();
        const originalTitle = document.title;
        let totalBytesAllTracks = 0,
            totalBytesCalc = 0,
            bytesSentFromPrevTracks = 0,
            bytesSentFromThisTrack = 0;

        const updateProgressCallback = ({ written, encrypted, total }: { written: number; encrypted: number; total: number }) => {
            const now = new Date().getTime();
            if (now - lastProgress > 200) {
                queueMicrotask(() => dispatch(uploadDialogActions.setWriteProgress({ written, encrypted, total })));
                lastProgress = now;
                bytesSentFromThisTrack = written;
                updateTitle();
            }
        };

        const updateTitle = () => {
            if (totalBytesAllTracks === 0) {
                document.title = `Converting | ${originalTitle}`;
                return;
            }

            const percentage = Math.floor((100 * (bytesSentFromThisTrack + bytesSentFromPrevTracks)) / totalBytesAllTracks);
            document.title = `${percentage}% complete | Upload | ${originalTitle}`;
        };

        const hasUploadBeenCancelled = () => {
            return getState().uploadDialog.cancelled;
        };

        const releaseScreenLockIfPresent = () => {
            if (screenWakeLock) {
                screenWakeLock.release();
            }
        };

        function showFinishedNotificationIfNeeded() {
            const { notifyWhenFinished, hasNotificationSupport } = getState().appState;
            if (!hasNotificationSupport || !notifyWhenFinished) {
                return;
            }
            const notification = new Notification('MiniDisc recording completed', {
                icon: NotificationCompleteIconUrl,
            });
            notification.onclick = function() {
                window.focus();
                this.close();
            };
        }

        const trackUpdate: {
            current: number;
            converting: number;
            total: number;
            titleCurrent: string;
            titleConverting: string;
        } = {
            current: 0,
            converting: 0,
            total: files.length,
            titleCurrent: '',
            titleConverting: '',
        };
        const updateTrack = () => {
            dispatch(uploadDialogActions.setTrackProgress(trackUpdate));
            updateTitle();
        };
        updateTrack();

        const conversionIterator = async function*(files: TitledFile[]) {
            const converted: Promise<{ file: TitledFile; data: ArrayBuffer }>[] = [];

            let i = 0;
            function convertNext() {
                if (i === files.length || hasUploadBeenCancelled()) {
                    trackUpdate.converting = i;
                    trackUpdate.titleConverting = ``;
                    totalBytesAllTracks = totalBytesCalc;
                    updateTrack();
                    return;
                }

                const f = files[i];
                trackUpdate.converting = i;
                trackUpdate.titleConverting = f.title;
                const j = i;
                updateTrack();
                i++;

                if (f.forcedEncoding === null) {
                    // This is not an ATRAC file
                    converted[j] = new Promise(async (resolve, reject) => {
                        let audioExportFormat: ExportParams['format'];
                        switch (format.codec) {
                            case 'LP2':
                                audioExportFormat = {
                                    codec: 'AT3',
                                    bitrate: 132,
                                };
                                break;
                            case 'LP4':
                                audioExportFormat = {
                                    codec: 'AT3',
                                    bitrate: 66,
                                };
                                break;
                            case 'SP':
                            case 'MONO':
                                audioExportFormat = {
                                    codec: 'PCM',
                                };
                                break;
                            default:
                                audioExportFormat = {
                                    codec: format.codec,
                                    bitrate: format.bitrate,
                                };
                                break;
                        }

                        const exportParams: ExportParams = {
                            format: audioExportFormat,
                            enableReplayGain: additionalParameters?.enableReplayGain,
                        }

                        let data: ArrayBuffer;
                        if((f.file as any).getForEncoding){
                            // It's an adaptive file
                            const file = f.file as AdaptiveFile;
                            data = await file.getForEncoding(exportParams);
                            convertNext();
                            resolve({ file: f, data: data });
                        } else {
                            const file = f.file as File;
                            try {
                                await audioExportService!.prepare(file);

                                data = await audioExportService!.export(exportParams);
                                totalBytesCalc += data.byteLength;
                                convertNext();
                                resolve({ file: f, data: data });
                            } catch (err) {
                                error = err;
                                errorMessage = `${f.file.name}: Unsupported or unrecognized format`;
                                reject(err);
                            }
                        }
                    });
                } else {
                    // TODO: FIXME - This should be supported!
                    if((f.file as any).getForEncoding) throw new Error("Adaptive files cannot be preencoded!");
                    // This is already an ATRAC file - don't reencode.
                    converted[j] = new Promise(async resolve => {
                        // Remove the WAV header.
                        const file = f.file as File;
                        const data = (await file.arrayBuffer()).slice(f.bytesToSkip);
                        totalBytesCalc += data.byteLength;
                        convertNext();
                        resolve({ file: f, data });
                    });
                }
            }
            convertNext();

            let j = 0;
            while (j < converted.length) {
                yield await converted[j];
                delete converted[j];
                j++;
            }
        };

        const disc = getState().main.disc;
        const usesHiMDTitles = getState().main.deviceCapabilities.includes(Capability.himdTitles);
        const useFullWidth = getState().appState.fullWidthSupport;
        let {
            halfWidth: availableHalfWidthCharacters,
            fullWidth: availableFullWidthCharacters,
        } = netmdSpec!.getRemainingCharactersForTitles(disc!);

        let error: any;
        let errorMessage = ``;
        let i = 1;
        await netmdService?.prepareUpload();

        for await (const item of conversionIterator(files)) {
            if (hasUploadBeenCancelled()) {
                break;
            }

            const { file, data } = item;

            const title = file.title;

            const fixLength = (l: number) => Math.max(Math.ceil(l / 7) * 7, 7);
            const halfWidthTitle = title.substring(0, Math.min(getHalfWidthTitleLength(title), availableHalfWidthCharacters));
            availableHalfWidthCharacters -= fixLength(getHalfWidthTitleLength(halfWidthTitle));

            let fullWidthTitle = file.fullWidthTitle;
            if (useFullWidth) {
                fullWidthTitle = fullWidthTitle.substring(
                    0,
                    Math.min(fullWidthTitle.length * 2, availableFullWidthCharacters, 210 /* limit is 105 */) / 2
                );
                availableFullWidthCharacters -= fixLength(fullWidthTitle.length * 2);
            }

            trackUpdate.current = i++;
            trackUpdate.titleCurrent = halfWidthTitle;
            if (fullWidthTitle) {
                if (trackUpdate.titleCurrent) {
                    trackUpdate.titleCurrent += ' / ';
                }
                trackUpdate.titleCurrent += fullWidthTitle;
            }
            bytesSentFromPrevTracks += bytesSentFromThisTrack;
            bytesSentFromThisTrack = 0;
            updateTrack();
            updateProgressCallback({ written: 0, encrypted: 0, total: 100 });
            if (file.forcedEncoding?.codec === 'SPS' || file.forcedEncoding?.codec === 'SPM') {
                // Uploading an AEA file.
                await netmdFactoryService!.uploadSP(
                    halfWidthTitle,
                    fullWidthTitle,
                    file.forcedEncoding.codec === 'SPM',
                    data,
                    updateProgressCallback
                );
            } else {
                try {
                    // SPS / SPM was filtered out before
                    const formatOverride: Codec = (file.forcedEncoding as Codec | null) ?? format;
                    await netmdService?.upload(
                        usesHiMDTitles ? { title, artist: file.artist, album: file.album } : halfWidthTitle,
                        fullWidthTitle,
                        data,
                        formatOverride,
                        updateProgressCallback
                    );
                } catch (err) {
                    error = err;
                    errorMessage = `${file.file.name}: Error uploading to device. There might not be enough space left, or an unknown error occurred.`;
                    break;
                }
            }
        }
        await netmdService?.finalizeUpload();

        if(format.codec === "MONO"){
            netmdFactoryService!.enableMonoUpload(false);
        }

        document.title = originalTitle;

        let actionToDispatch: UnknownAction[] = [uploadDialogActions.setVisible(false)];

        if (error) {
            console.error(error);
            actionToDispatch = actionToDispatch.concat([
                errorDialogAction.setVisible(true),
                errorDialogAction.setErrorMessage(errorMessage),
            ]);
        }

        dispatch(batchActions(actionToDispatch));
        showFinishedNotificationIfNeeded();
        releaseScreenLockIfPresent();
        listContent()(dispatch);
    };
}

export function openLocalLibrary() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if(!serviceRegistry.libraryService) {
            throw new Error("No library service has been registered!");
        }

        dispatch(localLibraryActions.setVisible(true));
        if(!getState().localLibrary.database) {
            dispatch(localLibraryActions.setStatus("Loading database..."));
            const database = await serviceRegistry.libraryService!.getDatabase();
            dispatch(batchActions([
                localLibraryActions.setStatus(null),
                localLibraryActions.setDatabase(database),
            ]));
        }
    }
}
