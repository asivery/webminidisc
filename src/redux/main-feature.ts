import { DeviceStatus } from 'netmd-js';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { Capability, DeviceInfo, Disc } from '../services/interfaces/netmd';

export interface MainState {
    disc: Disc | null;
    deviceName: string;
    deviceInfo: DeviceInfo | null;
    deviceStatus: DeviceStatus | null;
    deviceCapabilities: Capability[];
    flushable: boolean;
}

const initialState: MainState = {
    disc: null,
    deviceName: '',
    deviceInfo: null,
    deviceStatus: null,
    deviceCapabilities: [Capability.contentList], // Prevent the UI from collapsing when loading.
    flushable: false,
};

export const slice = createSlice({
    name: 'main',
    initialState,
    reducers: {
        setDisc: (state, action: PayloadAction<Disc | null>) => {
            state.disc = action.payload;
        },
        setDeviceName: (state, action: PayloadAction<string>) => {
            state.deviceName = action.payload;
        },
        setDeviceInfo: (state, action: PayloadAction<DeviceInfo | null>) => {
            state.deviceInfo = action.payload;
        },
        setDeviceStatus: (state, action: PayloadAction<DeviceStatus | null>) => {
            state.deviceStatus = action.payload;
        },
        setDeviceCapabilities: (state, action: PayloadAction<Capability[]>) => {
            state.deviceCapabilities = action.payload;
        },
        setFlushable: (state, action: PayloadAction<boolean>) => {
            state.flushable = action.payload;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
