function getPublicPathFor(script: string) {
    return `/${script}`;
}

class Atrac3VM {
    lines: string[] = [];
    currentLine: string = '';

    v86: any;

    async init() {
        self.importScripts(getPublicPathFor(`atrac3vm/libv86.js`));
        // The V86 constructor is loadded by the script above
        // @ts-ignore
        this.v86 = new V86({
            wasm_path: getPublicPathFor(`atrac3vm/v86-patched.wasm`),
            memory_size: 256 * 1024 * 1024, // CAVEAT: Needs to be big enough to run the VM + ATRAC3/ATRAC3+ encoder and hold files in memory
            vga_memory_size: 2 * 1024 * 1024,
            bios: {
                url: getPublicPathFor('atrac3vm/seabios.bin'),
            },
            cdrom: {
                url: getPublicPathFor('atrac3vm/atrac3os.iso'),
            },
            filesystem: {},
            autostart: true,
            disable_keyboard: true,
            disable_mouse: true,
        });

        // Wait for the console to be ready
        await new Promise<void>((resolve) => {
            const consoleReadyCb = (byte: number) => {
                const chr = String.fromCharCode(byte);
                if (chr === '#') {
                    this.v86.remove_listener('serial0-output-byte', consoleReadyCb);
                    resolve();
                }
            };
            this.v86.add_listener('serial0-output-byte', consoleReadyCb);
        });

        // Wait for the 9p filesystem to be ready
        await new Promise<void>((resolve) => {
            let execPromise: Promise<string[]> | undefined;
            const filesystemReadyCb = () => {
                this.v86.remove_listener('9p-attach', filesystemReadyCb);
                execPromise?.then(() => {
                    resolve();
                }); // CAVEAT: Wait for the exec to finish
            };
            this.v86.add_listener('9p-attach', filesystemReadyCb);
            execPromise = this.exec('echo ready > /mnt/ready.txt'); // Initialize the 9p filesystem
        });
    }

    async exec(command: string): Promise<string[]> {
        const output: string[] = [];
        let currentLine = '';
        return await new Promise<string[]>((resolve) => {
            this.v86.add_listener('serial0-output-byte', (byte: number) => {
                const chr = String.fromCharCode(byte);
                if (chr === '\n') {
                    output.push(currentLine);
                    currentLine = '';
                } else if (chr === '#') {
                    resolve(output); // CAVEAT: this assumes that the prompt is just '#' and that no other '#' appears in the output
                } else if (chr !== '\r') {
                    currentLine += chr;
                }
            });
            this.v86.serial0_send(command + '\n');
        });
    }

    async uploadFile(path: string, data: Uint8Array) {
        await this.v86.create_file(path, data);
    }

    async dowwnloadFile(path: string): Promise<Uint8Array> {
        return await this.v86.read_file(path);
    }

    async finalize() {
        await this.v86.stop();
        await this.v86.destroy();
    }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    // Worker
    const atrac3vm = new Atrac3VM();
    onmessage = async (ev: MessageEvent) => {
        const { action, ...others } = ev.data;
        if (action === 'init') {
            await atrac3vm.init();
            self.postMessage({ action: 'init' });
        } else if (action === 'encode') {
            try {
                console.log('Encoding ATRAC3/ATRAC3+ via Atrac3OS VM...');
                const { bitrate, data } = others;
                const inWavFile = `inWavFile.wav`;
                const outAt3File = `outAt3File.at3`;

                await atrac3vm.uploadFile(inWavFile, new Uint8Array(data));
                await atrac3vm.exec(`cp /mnt/${inWavFile} /tmp/${inWavFile}`); // Copy to /tmp to avoid 9p fs overhead
                const cmdOutput = await atrac3vm.exec(`time ./psp_at3tool.exe.elf -e -br ${bitrate} /tmp/${inWavFile} /tmp/${outAt3File}`);
                await atrac3vm.exec(`cp /tmp/${outAt3File} /mnt/${outAt3File}`);
                console.log(cmdOutput);

                const resultData: Uint8Array = await atrac3vm.dowwnloadFile(outAt3File);

                // Ensure we transfer only the bytes that belong to the encoded file.
                const resultBuffer =
                    resultData.byteOffset === 0 && resultData.byteLength === resultData.buffer.byteLength
                        ? resultData.buffer
                        : resultData.buffer.slice(resultData.byteOffset, resultData.byteOffset + resultData.byteLength);

                self.postMessage(
                    {
                        action: 'encode',
                        result: resultBuffer,
                    },
                    [resultBuffer]
                );

                await atrac3vm.finalize();
            } catch (e) {
                console.error('Error during ATRAC3/ATRAC3+ encoding:', e);
            }
        }
    };
} else {
    // Main
}
