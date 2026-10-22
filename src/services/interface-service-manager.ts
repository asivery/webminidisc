import React, { ReactHTMLElement } from 'react';
import { CustomParameterInfo, CustomParameters } from '../custom-parameters';
import { HiMDFullService, HiMDRestrictedService, HiMDSpec } from './interfaces/himd';
import { Codec, DefaultMinidiscSpec, MinidiscSpec, NetMDService, NetMDUSBService, RecordingCodec } from './interfaces/netmd';
import { NetMDMockService } from './interfaces/netmd-mock';
import { NetMDRemoteService } from './interfaces/remote-netmd';
import { DeviceIds } from 'networkwm-js';
import { NetworkWMService } from './interfaces/networkwm-nodrm';
import { bytesToHumanReadable } from '../utils';

interface ServicePrototype {
    create: (parameters?: CustomParameters) => NetMDService | null;
    spec: MinidiscSpec;
    getConnectName: (parameters?: CustomParameters) => string;
    name: string;
    customParameters?: CustomParameterInfo[];
    description?: ReactHTMLElement<any>;
    requiresChrome: boolean;
}

export interface ServiceConstructionInfo {
    name: string;
    parameters?: CustomParameters;
}

// For MockMD-Bytes only:
const BYTES_DEFAULT_SPEC = new DefaultMinidiscSpec();
(BYTES_DEFAULT_SPEC as any).measurementUnits = 'bytes';
BYTES_DEFAULT_SPEC.translateToDefaultMeasuringModeFrom = new HiMDSpec().translateToDefaultMeasuringModeFrom;

const MOCKS: ServicePrototype[] = import.meta.env.PROD ? [] :[
    {
        name: 'MockMD',
        getConnectName: () => 'Connect to MockMD',
        description: React.createElement('p', null, 'Test NetMD interface. It does nothing'),
        create: (parameters) => {
            console.log(`Given parameters: ${JSON.stringify(parameters)}`);
            return new NetMDMockService(parameters, false);
        },
        spec: new DefaultMinidiscSpec(),
        requiresChrome: false,
        customParameters: [
            {
                userFriendlyName: 'Test Number',
                type: 'number',
                varName: 'number',
            },
            {
                userFriendlyName: 'Override disc title',
                type: 'string',
                varName: 'overrideTitle',
            },
            {
                userFriendlyName: 'Override full-width disc title',
                type: 'string',
                varName: 'overrideFWTitle',
            },
            {
                userFriendlyName: 'capabilityContentList',
                type: 'boolean',
                varName: 'capabilityContentList',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityPlaybackControl',
                type: 'boolean',
                varName: 'capabilityPlaybackControl',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityMetadataEdit',
                type: 'boolean',
                varName: 'capabilityMetadataEdit',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackUpload',
                type: 'boolean',
                varName: 'capabilityTrackUpload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackDownload',
                type: 'boolean',
                varName: 'capabilityTrackDownload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityDiscEject',
                type: 'boolean',
                varName: 'capabilityDiscEject',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityFactoryMode',
                type: 'boolean',
                varName: 'capabilityFactoryMode',
                defaultValue: true,
            },
            {
                userFriendlyName: 'Test combobox',
                type: [
                    { name: 'A', value: 'a' },
                    { name: 'Bbb', value: 'b' },
                ],
                varName: 'combobox',
                defaultValue: 'a',
            },
        ],
    },
    {
        name: 'MockMD - Byte-Based',
        getConnectName: () => 'Connect to MockMD (bytes)',
        description: React.createElement('p', null, 'Test NetMD interface. It does nothing'),
        create: (parameters) => {
            console.log(`Given parameters: ${JSON.stringify(parameters)}`);
            return new NetMDMockService(parameters, true);
        },
        spec: BYTES_DEFAULT_SPEC,
        requiresChrome: false,
        customParameters: [
            {
                userFriendlyName: 'capabilityContentList',
                type: 'boolean',
                varName: 'capabilityContentList',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityPlaybackControl',
                type: 'boolean',
                varName: 'capabilityPlaybackControl',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityMetadataEdit',
                type: 'boolean',
                varName: 'capabilityMetadataEdit',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackUpload',
                type: 'boolean',
                varName: 'capabilityTrackUpload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityTrackDownload',
                type: 'boolean',
                varName: 'capabilityTrackDownload',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityDiscEject',
                type: 'boolean',
                varName: 'capabilityDiscEject',
                defaultValue: true,
            },
            {
                userFriendlyName: 'capabilityFactoryMode',
                type: 'boolean',
                varName: 'capabilityFactoryMode',
                defaultValue: true,
            },
        ],
    },
];

// FSA doesn't discern between pids, so walkmans can be grouped easily
const _networkWmSeriesSet = new Set<string>();
for(let device of DeviceIds) {
    if(device.disableDRM)
        _networkWmSeriesSet.add(device.series || device.name);
}

const networkWmSeriesList = Array.from(_networkWmSeriesSet);


export const Services: ServicePrototype[] = [
    {
        name: 'USB NetMD',
        getConnectName: () => 'Connect',
        create: () => window.native?.interface ?? new NetMDUSBService({ debug: true }),
        spec: new DefaultMinidiscSpec(),
        requiresChrome: true,
    },
    {
        name: 'HiMD (Read Only)',
        getConnectName: () => 'Connect to HiMD (Read Only)',
        create: () => new HiMDRestrictedService({ debug: true }),
        spec: new HiMDSpec(),
        requiresChrome: true,
    },
    {
        name: 'HiMD (Full)',
        getConnectName: () => 'Connect to HiMD (Full)',
        create: () => {
            if (window.native?.himdFullInterface) {
                return window.native?.himdFullInterface;
            }
            if (!confirm('Warning: For Full HiMD mode, it is recommended to use ElectronWMD instead! Continue?')) {
                return null;
            }
            return new HiMDFullService({ debug: true });
        },
        spec: new HiMDSpec(),
        requiresChrome: true,
    },
    {
        name: 'DRM-Free Network Walkman',
        getConnectName: (params) => {
            let sizeIndex = parseInt(params!.size as string || '-1');
            const dev = DeviceIds.find(e => e.name === params!.name || e.series === params!.name)!;
            if(dev.knownSizes?.[sizeIndex]) {
                const size = bytesToHumanReadable(Math.pow(2, Math.round(Math.log2(dev.knownSizes[sizeIndex]) + 0.4)));
                return `Connect to ${params!.name} (${size})`;
            } else {
                return `Connect to ${params!.name}`;
            }
        },
        create: (params) => {
            const dev = DeviceIds.find(e => e.name === params!.name || e.series === params!.name)!;
            const capacitySelectedIndex = parseInt(params!.size as string || '-1');
            return new NetworkWMService(dev, capacitySelectedIndex, dev?.series === params!.name);
        },
        requiresChrome: true,
        spec: new HiMDSpec(),
        customParameters: [
            {
                varName: 'name',
                type: networkWmSeriesList.map((e) => ({ name: e, value: e })),
                userFriendlyName: 'Device',
                defaultValue: networkWmSeriesList[0]
            },
            {
                varName: 'size',
                type: (params) => {
                    const devFound = DeviceIds.filter(e => e.name === params!.name || e.series === params!.name)!;
                    const allKnownSizes = devFound.flatMap(e => e.knownSizes ?? []);
                    if(!devFound) return null;
                    if(allKnownSizes.length) {
                        return allKnownSizes.map((e, i) => ({
                            // Align the user-readable names to 'nice' values:
                            name: bytesToHumanReadable(Math.pow(2, Math.round(Math.log2(e) + 0.4))),
                            value: i.toString()
                        }));
                    } else {
                        return null;
                    }
                },
                userFriendlyName: 'Capacity',
            }
        ],
    },
    {
        name: 'Remote NetMD',
        getConnectName: (parameters) => `Connect to ${parameters!.friendlyName || parameters!.serverAddress}`,
        description: React.createElement(
            'p',
            null,
            'Connect to a remote NetMD device with the help of ',
            React.createElement('a', { href: 'https://github.com/asivery/remote-netmd-server' }, 'Remote NetMD')
        ),
        create: (parameters) => new NetMDRemoteService({ debug: true, ...parameters } as any),
        spec: new DefaultMinidiscSpec(),
        requiresChrome: false,
        customParameters: [
            {
                userFriendlyName: 'Server Address',
                varName: 'serverAddress',
                type: 'string',
                validator: (content) => {
                    try {
                        const asURL = new URL(content);
                        return asURL.pathname === '/';
                    } catch (e) {
                        return false;
                    }
                },
            },
            {
                userFriendlyName: 'Friendly Name',
                varName: 'friendlyName',
                type: 'string',
            },
        ],
    },
    ...MOCKS
];

if (window.native?.nwInterface) {
    class NetworkWMSpec extends HiMDSpec {
        public availableFormats: RecordingCodec[] = [
            { codec: 'AT3', availableBitrates: [132, 105, 66], defaultBitrate: 132 },
            { codec: 'A3+', availableBitrates: [352, 256, 192, 64, 48], defaultBitrate: 256 },
            { codec: 'MP3', availableBitrates: [320, 256, 192, 128, 96, 64], defaultBitrate: 192 },
        ];
        public readonly measurementUnits = 'bytes';
        public defaultFormat = [1, 1] as [number, number];
        public specName = 'NetworkWM';

        translateToDefaultMeasuringModeFrom(codec: Codec, defaultMeasuringModeDuration: number): number {
            return super.translateToDefaultMeasuringModeFrom(codec, defaultMeasuringModeDuration) + 32768; // For initial metadata sections!
        }
    }
    Services.push({
        name: 'NetworkWM',
        requiresChrome: true,
        spec: new NetworkWMSpec(),
        getConnectName: () => 'Connect to Network Walkman',
        create: () => window.native?.nwInterface!,
    });
}

export function getSimpleServices() {
    return Services.filter((n) => !n.customParameters).map((n) => ({
        name: n.name,
    }));
}

function getPrototypeByName(name: string) {
    return Services.find((n) => n.name === name) || null;
}

export function filterOutCorrupted(savedCustomServices: ServiceConstructionInfo[]) {
    const legalCustomServices: ServiceConstructionInfo[] = [];
    for (const info of savedCustomServices) {
        const prototype = getPrototypeByName(info.name);
        if (!prototype) continue; // No such service - remove.
        const requiredParameters = prototype.customParameters;
        const parameterKeys = Object.keys(info.parameters!);
        if (!requiredParameters) continue; // The service cannot be a custom service - no props to set.
        if (requiredParameters.length !== parameterKeys.length) continue; // Invalid config.
        const typeValid = (n: CustomParameterInfo, value: CustomParameters extends { [e: string]: infer R } ? R : never) => {
            const type = typeof n.type === 'function' ? n.type(info.parameters!) : n.type;
            return Array.isArray(type) ? type.some((e) => e.value === value) : typeof value === type;
        }

        if (
            requiredParameters.filter((n) => parameterKeys.includes(n.varName) && typeValid(n, info.parameters![n.varName])).length !==
            requiredParameters.length
        ) {
            console.log("Dropping service " + info.name + " from available - params differ");
            continue; // The service's parameters differ from the prototype's declaration.
        }
        legalCustomServices.push(info);
    }
    return legalCustomServices;
}

export function createService(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.create(info.parameters) ?? null;
}

export function getServiceSpec(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.spec;
}

export function getConnectButtonName(service: ServiceConstructionInfo) {
    return getPrototypeByName(service.name)!.getConnectName(service.parameters);
}

export function doesServiceRequireChrome(info: ServiceConstructionInfo) {
    return getPrototypeByName(info.name)?.requiresChrome ?? false;
}
