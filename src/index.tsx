import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import * as serviceWorker from './serviceWorker';
import serviceRegistry from './services/registry';

import { store } from './redux/store';
import { actions as appActions } from './redux/app-feature';
import { actions as mainActions } from './redux/main-feature';

import App from './components/app';

import { MediaRecorderService } from './services/browserintegration/mediarecorder';
import { BrowserMediaSessionService } from './services/browserintegration/media-session';
import { listContent } from './redux/actions';
import { sleep } from './utils';
serviceRegistry.mediaRecorderService = new MediaRecorderService();
serviceRegistry.mediaSessionService = new BrowserMediaSessionService(store);

Object.defineProperty(window, 'wmdVersion', {
    value: '1.4.2',
    writable: false,
});

const originalApplicationTitle = document.title;

if (localStorage.getItem('version') !== (window as any).wmdVersion) {
    store.dispatch(appActions.showChangelogDialog(true));
}

(function setupEventHandlers() {
    window.addEventListener('beforeunload', ev => {
        const state = store.getState();
        const isUploading = state.uploadDialog.visible;
        const isDownloading = state.factoryProgressDialog.visible || state.recordDialog.visible;
        if (!(isUploading || isDownloading)) {
            return;
        }
        ev.preventDefault();
        ev.returnValue = `Warning! Recording will be interrupted`;
    });

    if (navigator && navigator.usb) {
        navigator.usb.ondisconnect = function(event) {
            if(serviceRegistry.netmdService!.isDeviceConnected(event.device)){
                store.dispatch(appActions.setMainView('WELCOME'));
                document.title = originalApplicationTitle;
            } else {
                console.log("The device disconnected isn't connected to this webapp");
            }
        };
    } else {
        store.dispatch(appActions.setBrowserSupported(false));
        store.dispatch(appActions.setRunningChrome(false));
    }

    Object.defineProperty(window, 'reload', {
        value: window.native?.reload ?? window.location.reload.bind(window.location),
        writable: false,
        configurable: false
    });

    if (!('Notification' in window) || Notification.permission === 'denied') {
        store.dispatch(appActions.setNotificationSupport(false));
        store.dispatch(appActions.setNotifyWhenFinished(false));
    }

    let deferredPrompt: any;
    window.addEventListener('beforeinstallprompt', (e: any) => {
        e.preventDefault();
        deferredPrompt = e;
    });
})();

(function statusMonitorManager() {
    // Polls the device for its state while playing tracks
    let exceptionOccurred: boolean = false;

    function shouldMonitorBeRunning(state: ReturnType<typeof store.getState>): boolean {
        return (
            !exceptionOccurred &&
            // App ready
            state.appState.mainView === 'MAIN' &&
            state.appState.loading === false &&
            // Disc playing
            // (state.main.deviceStatus?.state === 'playing' || state.main.disc === null) &&
            // No operational dialogs running
            state.convertDialog.visible === false &&
            state.uploadDialog.visible === false &&
            state.recordDialog.visible === false &&
            state.panicDialog.visible === false &&
            state.errorDialog.visible === false &&
            state.dumpDialog.visible === false &&
            state.songRecognitionProgressDialog.visible === false &&
            state.factoryProgressDialog.visible === false
        );
    }

    async function monitor() {
        const state = store.getState();
        if (shouldMonitorBeRunning(state)) {
            try {
                await sleep(250);
                let deviceStatus;
                try {
                    deviceStatus = await serviceRegistry.netmdService!.getDeviceStatus();
                } catch (ex) {
                    // In invalid state - wait it out.
                    setTimeout(monitor, 5000);
                    return;
                }
                if (!deviceStatus.discPresent && state.main.disc !== null) store.dispatch(mainActions.setDisc(null));
                if (deviceStatus.discPresent && state.main.disc === null) await listContent(true)(store.dispatch);
                if (JSON.stringify(deviceStatus) !== JSON.stringify(state.main.deviceStatus)) {
                    store.dispatch(mainActions.setDeviceStatus(deviceStatus));
                }
                const currentFlushability = store.getState().main.flushable;
                const serviceFlushability = await serviceRegistry.netmdService!.canBeFlushed();
                if (currentFlushability !== serviceFlushability) {
                    store.dispatch(mainActions.setFlushable(serviceFlushability));
                }
                // Since this function doesn't execute if there's any operational dialog on screen
                // (including the track upload dialog), this won't conflict with anything.
                if(document.title !== originalApplicationTitle) {
                    document.title = originalApplicationTitle;
                }
                await sleep(250);
            } catch (e) {
                console.error(e);
                exceptionOccurred = true; // Stop monitor on exception
            }
        }
        setTimeout(monitor, 500);
    }
    monitor();
})();

const root = createRoot(document.getElementById('root')!);
root.render(
    <Provider store={store}>
        <App />
    </Provider>
);

if (process.env.REACT_APP_NO_GA_RELEASE !== 'true') {
    serviceWorker.register();
    // serviceWorker.unregister();
}
