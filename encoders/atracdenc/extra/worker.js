if (typeof (WorkerGlobalScope) !== 'undefined' && self instanceof WorkerGlobalScope) {
    // Worker
    let Module;
    onmessage = async (ev) => {
        const { action, ...others } = ev.data;
        if (action === 'init') {
            self.importScripts(others.atracdencJsURL);
            self.Module().then(m => {
                Module = m;
                self.postMessage({ action: 'init' });
                Module.setLogger && Module.setLogger((msg, stream) => console.log(`${stream}: ${msg}`));
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
