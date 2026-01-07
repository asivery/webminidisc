function getPublicPathFor(script: string) {
    return `${import.meta.env.BASE_URL}${script}`;
}

type MemImage = { start: number, fill?: { value: number, length: number }, data?: Uint8Array}[];

function parseImage(data: Uint8Array) {
    const dv = new DataView(data.buffer);
    const image: MemImage = [];
    let cursor = 24;
    while(cursor < dv.byteLength) {
        const blockType = dv.getUint8(cursor++);
        const start = dv.getUint32(cursor, true);
        cursor += 4;
        const length = dv.getUint32(cursor, true);
        cursor += 4;
        if(blockType === 0) {
            // Fill zero
            image.push({ start, fill: { value: 0, length }})
        } else if(blockType === 1) {
            const block = data.subarray(cursor, cursor + length);
            cursor += length;
            image.push({ start, data: block });
        }
    }
    return image;
}

function applyImage(data: Uint8Array, image: MemImage) {
    for(const section of image) {
        if(section.data) data.set(section.data, section.start);
        else data.subarray(section.start, section.fill!.length).fill(section.fill!.value);
    }
}

class CDAatracproject {
    initialRAM: MemImage | null = null;
    data: Uint8Array | null = null;
    dataOut: Uint8Array[] = [];
    inputCursor: number = 0;
    progress?: (v: number) => void;
    constructor(private emulator: any) {}
    async init() {
        this.initialRAM = parseImage(new Uint8Array(await (await fetch(getPublicPathFor("atrac3vm/system.cmi"))).arrayBuffer()));

        this.emulator.v86.cpu.io.register_write(0xFF, this.emulator.v86.cpu, function(this: any, data: number) {
            let line = "", char;
            data = this.reg32[0];
            while((char = this.mem8[data++]) !== 0) {
                line += String.fromCharCode(char);
            }
            console.log("ATRACVM:", line);
        });

        const _atrac = this;
        this.emulator.v86.cpu.io.register_write(0xFE, this.emulator.v86.cpu, function(this: any) {
            const hi = this.reg32[0];
            const lo = this.reg32[3];
            const value = ((hi << 32) | lo) >>> 0;
            _atrac.progress?.(value);
        });
        this.emulator.v86.cpu.io.register_write(0xfc, this.emulator.v86.cpu, function(this: any, data: number) {
            const destination = this.reg32[0],
                source = this.reg32[3],
                length = this.reg32[1];
            // console.log("XFER called!", destination, source, length);
            if(source >= 0x50000000) {
                const sourceOffset = _atrac.inputCursor;
                this.mem8.set(_atrac.data!.subarray(sourceOffset, sourceOffset + length), destination);
                _atrac.inputCursor += length;
                return;
            }
            if(destination >= 0x60000000) {
                _atrac.dataOut.push(new Uint8Array(this.mem8.subarray(source, source + length)));
                return;
            }
            throw new Error("Illegal context transfer!");
        });


        this.reset();
        this.emulator.run();
        await this._cpuStop();
    }

    reset() {
        applyImage(this.emulator.v86.cpu.mem8, this.initialRAM!);
    }

    _cpuStop() {
        return new Promise<void>(res => {
            const interval = setInterval(() => {
                if(this.emulator.v86.cpu.in_hlt.valueOf()[0] == 1) {
                    clearInterval(interval);
                    res();
                }
            }, 1000);
        });
    }

    async globalInit(){
        this.emulator.v86.cpu.mem32s[0x210000] = 0x840009;
        this.emulator.v86.cpu.reset_cpu();
        await this._cpuStop();
        return this.emulator.v86.cpu.reg32.valueOf()[0];
    }


    async _process(){
        this.emulator.v86.cpu.mem32s[0x210000] = 0x840018;
        this.emulator.v86.cpu.reset_cpu();
        await this._cpuStop();
        return this.emulator.v86.cpu.reg32.valueOf()[0];
    }


    async sayHello(){
        this.emulator.v86.cpu.mem32s[0x210000] = 0x840027;
        this.emulator.v86.cpu.reset_cpu();
        await this._cpuStop();
        return this.emulator.v86.cpu.reg32.valueOf()[0];
    }


    async process(inputData: Uint8Array, bitrate: number, lastInBatch: boolean, callback: (progress: number) => void) {
        this.data = inputData;
        this.dataOut = [];
        this.inputCursor = 0;
        this.progress = callback;
        /// TODO: Make this work on BigInts:
        this.emulator.v86.cpu.mem32s[0x850000 / 4] = (inputData.length & 0xFFFFFFFF) >>> 0;
        this.emulator.v86.cpu.mem32s[0x850000 / 4 + 1] = 0;
        this.emulator.v86.cpu.mem32s[0x850000 / 4 + 2] = bitrate;
        this.emulator.v86.cpu.mem32s[0x850000 / 4 + 3] = lastInBatch ? 1 : 0;
        await this._process();
        const totalOutLength = this.dataOut.reduce((a, b) => b.length + a, 0);
        const final = new Uint8Array(totalOutLength);
        let pointer = 0;
        for(const arr of this.dataOut) {
            final.set(arr, pointer);
            pointer += arr.length;
        }
        return final;
    }

}

class VM {
    emulator: any = null;
    linker?: CDAatracproject;

    async init() {
        self.importScripts(getPublicPathFor("atrac3vm/libv86.js"));
        // @ts-ignore
        this.emulator = new V86({
            wasm_path: getPublicPathFor("atrac3vm/v86-patched.wasm"),
            memory_size: 32 * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            disable_keyboard: true,
            disable_mouse: true,
            bios: {
                url: getPublicPathFor("atrac3vm/seabios.bin"),
            },
            multiboot: {
                async: false,
                url: getPublicPathFor("atrac3vm/kernel.bin"),
            },
            autostart: false,
        });
        await new Promise(res => this.emulator.add_listener('emulator-loaded', res));
        this.linker = new CDAatracproject(this.emulator);
        await this.linker.init();
        console.log("ATRACVM: Init ok.");
        await this.linker.globalInit();
        console.log("ATRACVM: Global init ok.");
    }
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    // Worker
    const atrac3vm = new VM();
    onmessage = async (ev) => {
        const { action, ...others } = ev.data;
        console.log("Message", ev);
        if (action === 'init') {
            await atrac3vm.init();
            self.postMessage({ action: 'init' });
        } else if (action === 'encode') {
            const result = (await atrac3vm.linker!.process(
                new Uint8Array(others.data as ArrayBuffer),
                others.bitrate as number,
                others.lastInBatch,
                progress => self.postMessage({ progress })
            )).buffer;
            self.postMessage({ result });
        }
    };
} else {
    // Main
}
