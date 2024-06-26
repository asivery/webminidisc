/* eslint no-restricted-globals: 0 */
function getPublicPathFor(script: string) {
    return `${import.meta.env.BASE_URL}/${script}`;
}
export class AtracdencProcess {
    private messageCallback?: (ev: MessageEvent) => void;

    constructor(public worker: Worker) {
        worker.onmessage = this.handleMessage.bind(this);
    }

    async init() {
        await new Promise<MessageEvent>(resolve => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'init' });
        });
    }

    async encode(data: ArrayBuffer, bitrate: string) {
        const eventData = await new Promise<MessageEvent>(resolve => {
            this.messageCallback = resolve;
            this.worker.postMessage({ action: 'encode', bitrate, data }, [data]);
        });
        return eventData.data.result as ArrayBuffer;
    }

    terminate() {
        this.worker.terminate();
    }

    handleMessage(ev: MessageEvent) {
        this.messageCallback!(ev);
        this.messageCallback = undefined;
    }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    // Worker
    let Module: any;
    onmessage = async (ev: MessageEvent) => {
        const { action, ...others } = ev.data;
        if (action === 'init') {
            self.importScripts(getPublicPathFor(`atracdenc.js`));
            (self as any).Module().then((m: any) => {
                Module = m;
                self.postMessage({ action: 'init' });
                Module.setLogger && Module.setLogger((msg: string, stream: string) => console.log(`${stream}: ${msg}`));
            });
        } else if (action === 'encode') {
            const { bitrate, data } = others;
            const inWavFile = `inWavFile.wav`;
            const outAt3File = `outAt3File.aea`;
            const dataArray = new Uint8Array(data);
            Module.FS.writeFile(`${inWavFile}`, dataArray);
            Module.callMain([`-e`, `atrac3`, `-i`, inWavFile, `-o`, outAt3File, `--bitrate`, bitrate]);

            // Read file and trim header (96 bytes)
            const fileStat = Module.FS.stat(outAt3File);
            const size = fileStat.size;
            const tmp = new Uint8Array(size - 96);
            const outAt3FileStream = Module.FS.open(outAt3File, 'r');
            Module.FS.read(outAt3FileStream, tmp, 0, tmp.length, 96);
            Module.FS.close(outAt3FileStream);

            const result = tmp.buffer;

            self.postMessage(
                {
                    action: 'encode',
                    result,
                },
                [result]
            );
        }
    };
} else {
    // Main
}
