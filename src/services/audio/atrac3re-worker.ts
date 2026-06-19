/* eslint no-restricted-globals: 0 */
function getPublicPathFor(script: string) {
    return `${import.meta.env.BASE_URL}${script}`;
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    // Worker
    let Module: any;
    let setupBitrate: number | undefined = undefined;
    onmessage = async (ev: MessageEvent) => {
        const { action, ...others } = ev.data;
        if (action === 'init') {
            self.importScripts(getPublicPathFor(`at3re-harness.js`));
            (self as any).Module({ locateFile: getPublicPathFor }).then((m: any) => {
                Module = m;
                self.postMessage({ action: 'init' });
                Module.setLogger && Module.setLogger((msg: string, stream: string) => console.log(`${stream}: ${msg}`));
            });
        } else if (action === 'encode') {
            const { bitrate, data, lastInBatch } = others;
            if (setupBitrate === undefined) {
                // Initialize the encoder.
            } else if (setupBitrate !== bitrate) {
                // Redefining the bitrate without finishing the previous batch - error
                self.postMessage({ action: 'encode', error: -1, func: '<harness>' });
                return;
            }
            // Allocate the buffer and copy PCM:
            let addr = Module._malloc(data.byteLength);
            Module.HEAPU8.set(new Uint8Array(data), addr);

            let res = Module.ccall('initialize', 'number', ['number'], [bitrate]);
            if (res != 1) {
                self.postMessage({ action: 'encode', error: res, func: 'initialize' });
                return;
            }

            let expectedSize = Module.ccall('calculate_atrac_buf_size', 'number', ['number'], [data.byteLength]);
            let atracAddr = Module._malloc(expectedSize);

            let encodedBytes = Module.ccall(
                'encode',
                'number',
                ['number', 'number', 'number', 'number'],
                [addr, atracAddr, data.byteLength, expectedSize]
            );

            if (lastInBatch) {
                // Finish everything and clean up the env
                setupBitrate = undefined;
                encodedBytes = Module.ccall('finish', 'number', ['number', 'number'], [atracAddr, encodedBytes]);
            }

            let result = new Uint8Array<ArrayBuffer>(Module.HEAPU8.subarray(atracAddr, atracAddr + encodedBytes)).buffer;

            Module._free(addr);
            Module._free(atracAddr);

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
