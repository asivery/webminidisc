import { getCellsForTitle, getRemainingCharactersForTitles, MDTrack } from 'netmd-js';
import { Logger } from 'netmd-js/dist/logger';
import { concatUint8Arrays } from 'netmd-js/dist/utils';
import { makeGetAsyncPacketIteratorOnWorkerThread } from 'netmd-js/dist/web-encrypt-worker';
import { asyncMutex } from '../../utils';
import { Capability, NetMDService, Group, Disc, Track, convertDiscToNJS, convertTrackToNJS, Codec, WireformatDict } from './netmd';
import Worker from 'netmd-js/dist/web-encrypt-worker?worker';

export class NetMDRemoteService extends NetMDService {
    private logger?: Logger;
    private server: string;
    private capabilities: Capability[] | null = null;
    private friendlyName: string;
    private useChunkedTransfersForLP: boolean;

    constructor({
        debug = false,
        serverAddress,
        friendlyName,
        useChunkedTransfersForLP = false,
    }: {
        debug: boolean;
        serverAddress: string;
        friendlyName: string;
        useChunkedTransfersForLP: boolean;
    }) {
        super();
        if (debug) {
            // Logging a few methods that have been causing issues with some units
            const _fn = (...args: any) => {
                if (args && args[0] && args[0].method) {
                    console.log(...args);
                }
            };
            this.logger = {
                debug: _fn,
                info: _fn,
                warn: _fn,
                error: _fn,
                child: () => this.logger!,
            };
        }
        this.server = serverAddress.endsWith('/') ? serverAddress.substring(0, serverAddress.length - 1) : serverAddress;
        this.friendlyName = friendlyName;
        this.useChunkedTransfersForLP = useChunkedTransfersForLP;
    }

    getRemainingCharactersForTitles(disc: Disc) {
        return getRemainingCharactersForTitles(convertDiscToNJS(disc));
    }

    getCharactersForTitle(track: Track) {
        const { halfWidth, fullWidth } = getCellsForTitle(convertTrackToNJS(track));
        return {
            halfWidth: halfWidth * 7,
            fullWidth: fullWidth * 7,
        };
    }

    isDeviceConnected(){
        return false;
    }

    private async fetchServerCapabilities() {
        const serverInfo = await this.getFromServer('');
        if (!serverInfo) throw new Error('Not ready.');
        if (serverInfo.version !== '1.0') {
            this.logger?.error({
                method: 'fetchServerCapabilities',
                info: `Server is on a different version than the service. (1.0 != ${serverInfo.version})`,
            });
            return;
        }
        this.capabilities = serverInfo.capabilities.map((n: any) => Capability[n]);
    }

    async getServiceCapabilities() {
        if (this.capabilities === null) {
            await this.fetchServerCapabilities();
        }
        return this.capabilities!;
    }

    async pair() {
        await this.fetchServerCapabilities();
        return true;
    }

    async connect() {
        return false;
    }

    private async getFromServer(path: string, parameters?: { [key: string]: any }, method: string = 'GET') {
        try {
            const url = new URL(`${this.server}/${path}`);
            let body = undefined;
            let headers = {};
            if (parameters) {
                for (const key in parameters) {
                    if (parameters[key] === undefined) delete parameters[key];
                }
            }
            if (method === 'GET') {
                url.search = new URLSearchParams(parameters).toString();
            } else {
                body = JSON.stringify(parameters);
                headers = {
                    'Content-Type': 'application/json',
                };
            }
            const jsonData = await (await fetch(url.toString(), { method, body, headers })).json();
            if (jsonData.ok) {
                return jsonData.value;
            } else {
                this.logger?.error({ method: path, jsonData });
                return null;
            }
        } catch (ex) {
            this.logger?.error({ method: 'GENERIC', ex });
            return null;
        }
    }

    @asyncMutex
    async listContent(flushCache?: boolean) {
        if(!flushCache) flushCache = false;
        return await this.getFromServer('listContent', { flushCache });
    }

    @asyncMutex
    async getDeviceStatus() {
        return await this.getFromServer('deviceStatus');
    }

    @asyncMutex
    async getDeviceName() {
        return (await this.getFromServer('deviceName')) + (this.friendlyName && ` (${this.friendlyName})`);
    }

    @asyncMutex
    async finalize() {
        window.alert('NOT COMPLETE YET');
    }

    @asyncMutex
    async rewriteGroups(groups: Group[]) {
        return await this.getFromServer('rewriteGroups', { groups }, 'POST');
    }

    @asyncMutex
    async renameTrack(index: number, title: string, fullWidthTitle?: string) {
        return await this.getFromServer('renameTrack', { index, title, fullWidthTitle });
    }

    @asyncMutex
    async renameGroup(groupIndex: number, title: string, fullWidthTitle?: string) {
        return await this.getFromServer('renameGroup', { groupIndex, title, fullWidthTitle });
    }

    @asyncMutex
    async addGroup(groupBegin: number, groupLength: number, title: string, fullWidthTitle: string = '') {
        return await this.getFromServer('addGroup', { groupBegin, groupLength, title, fullWidthTitle });
    }

    @asyncMutex
    async deleteGroup(index: number) {
        return await this.getFromServer('deleteGroup', { index });
    }

    @asyncMutex
    async renameDisc(title: string, fullWidthTitle?: string) {
        return await this.getFromServer('renameDisc', { title, fullWidthTitle });
    }

    @asyncMutex
    async deleteTracks(indexes: number[]) {
        return await this.getFromServer('deleteTracks', { indexes }, 'POST');
    }

    @asyncMutex
    async wipeDisc() {
        return await this.getFromServer('wipeDisc');
    }

    @asyncMutex
    async ejectDisc() {
        await this.getFromServer('eject');
    }

    @asyncMutex
    async wipeDiscTitleInfo() {
        window.alert('Not complete yet');
    }

    @asyncMutex
    async moveTrack(src: number, dst: number, updateGroups?: boolean) {
        return await this.getFromServer('moveTrack', { src, dst });
    }

    async prepareUpload() {
        await this.getFromServer('prepareUpload');
    }
    async finalizeUpload() {
        await this.getFromServer('finalizeUpload');
    }

    @asyncMutex
    upload(
        title: string,
        fullWidthTitle: string,
        data: ArrayBuffer,
        _format: Codec,
        progressCallback: (progress: { written: number; encrypted: number; total: number }) => void
    ) {
        return new Promise<void>((res, rej) => {
            // The direct-USB path (netmd.ts) collapses the SPS/SPM recording codecs
            // to the 'SP' wireformat before looking them up in WireformatDict; the
            // remote path must do the same, otherwise WireformatDict['SPS'] is
            // undefined and the encryption worker produces no packets (upload hangs).
            const format =
                _format.codec === 'AT3'
                    ? { codec: _format.bitrate === 66 ? 'LP4' : 'LP2' }
                    : _format.codec === 'SPS' || _format.codec === 'SPM'
                    ? { codec: 'SP' }
                    : _format;
            const servURL = new URL(this.server);
            const wsURL = new URL(`${servURL.protocol === 'https:' ? 'wss:' : 'ws:'}//${servURL.host}/upload`);
            //Send file

            const total = data.byteLength;
            let encrypted = 0;
            let written = 0;

            const updateProgress = () =>
                progressCallback({
                    written,
                    total,
                    encrypted,
                });

            const w = new Worker();

            const webWorkerAsyncPacketIterator = makeGetAsyncPacketIteratorOnWorkerThread(w, ({ encryptedBytes }) => {
                encrypted = encryptedBytes;
                updateProgress();
            });

            // A dud track used for the encryption
            const track = new MDTrack('', WireformatDict[format.codec], data, 0x400, '', webWorkerAsyncPacketIterator);
            const codec = format.codec.toString();
            wsURL.search = new URLSearchParams({
                title,
                fullWidthTitle,
                format: codec,
                totalLength: total.toString(),
                chunked: (this.useChunkedTransfersForLP && format.codec !== 'SP').toString(),
            }).toString();
            const ws = new WebSocket(wsURL.toString());

            ws.addEventListener('message', async event => {
                const json = JSON.parse(event.data);
                if (json.init) {
                    // Read and encrypt the file
                    // Send the results of the encryption iterator to the server
                    for await (const piece of track.getPacketWorkerIterator()) {
                        // Serialize the piece
                        const combined = concatUint8Arrays(new Uint8Array([0]), piece.iv, piece.key, piece.data);
                        ws.send(combined);
                    }
                    ws.send(new Uint8Array([1]));
                    w.terminate();
                } else if (json.terminate) {
                    ws.close();
                    res();
                } else {
                    written = JSON.parse(event.data).written;
                    updateProgress();
                }
            });

            ws.addEventListener('close', () => res());
        });
    }

    @asyncMutex
    async download(index: number, progressCallback: (progress: { read: number; total: number }) => void) {
        return null;
    }

    @asyncMutex
    async play() {
        return await this.getFromServer('play');
    }
    @asyncMutex
    async pause() {
        return await this.getFromServer('pause');
    }
    @asyncMutex
    async stop() {
        return await this.getFromServer('stop');
    }
    @asyncMutex
    async next() {
        return await this.getFromServer('next');
    }
    @asyncMutex
    async prev() {
        return await this.getFromServer('prev');
    }

    @asyncMutex
    async gotoTrack(index: number) {
        return await this.getFromServer('goto', { index });
    }

    @asyncMutex
    async gotoTime(index: number, h: number, m: number, s: number, f: number) {
        return await this.getFromServer('gotoTime', { index, hour: h, minute: m, second: s, frame: f });
    }

    @asyncMutex
    async getPosition() {
        return await this.getFromServer('getPosition');
    }

    async factory() {
        return null;
    }
}
