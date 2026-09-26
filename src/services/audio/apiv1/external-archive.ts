// Simple ARchive - rudimentary linear archive format.
const MAX_SAR_FILE_LENGTH = 50 * 1024 * 1024;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const MAGIC = "SARFile";

export class SARFile {
    private _buffer: ArrayBuffer;
    private _files: Record<string, [number, number]> = {};
    // subMagic = null
    constructor(private _subMagic: string | null, data?: Uint8Array) {
        if(data) {
            this._buffer = new ArrayBuffer(data.length, { maxByteLength: MAX_SAR_FILE_LENGTH });
            new Uint8Array(this._buffer).set(data);
            this._cacheFiles();
        } else {
            if(!_subMagic) throw new Error("Cannot provide subMagic = null when creating an archive.");
            const encodedSubMagic = TEXT_ENCODER.encode(_subMagic);
            this._buffer = new ArrayBuffer(MAGIC.length + 2 + encodedSubMagic.byteLength, { maxByteLength: MAX_SAR_FILE_LENGTH });
            
            const asUint = new Uint8Array(this._buffer);
            const asDv = new DataView(this._buffer);
            asUint.set(TEXT_ENCODER.encode(MAGIC), 0);
            asDv.setUint16(MAGIC.length, encodedSubMagic.length);
            asUint.set(encodedSubMagic, MAGIC.length + 2);
        }
    }

    static readSubMagicOfArchve(rawBuffer: Uint8Array): string | null {
        let cursor = 0;
        const dataView = new DataView(rawBuffer.buffer);
        const magicField = rawBuffer.slice(0, MAGIC.length);
        try {
            if(TEXT_DECODER.decode(magicField) != MAGIC) {
                return null;
            } else {
                cursor += MAGIC.length;
            }
        } catch(_ex) {
            return null;
        }
        const subMagicLength = dataView.getUint16(cursor);
        cursor += 2;
        const subMagic = TEXT_DECODER.decode(rawBuffer.slice(cursor, cursor + subMagicLength));
        return subMagic;
    }

    get buffer() {
        return this._buffer;
    }

    get subMagic() {
        return this._subMagic;
    }

    _cacheFiles() {
        let cursor = 0;
        const rawBuffer = new Uint8Array(this._buffer);
        const dataView = new DataView(this._buffer);
        const subMagic = SARFile.readSubMagicOfArchve(rawBuffer);

        if(!subMagic) throw new Error("Not a SAR file");
        if(!this.subMagic) this._subMagic = subMagic;
        else if(subMagic !== this.subMagic) {
            throw new Error(`Expected submagic ${this.subMagic}, got ${subMagic}`);
        }
        cursor += subMagic.length + 2 + MAGIC.length;

        while(cursor < this._buffer.byteLength) {
            const nameLength = dataView.getUint16(cursor);
            cursor += 2;
            const nameEncoded = rawBuffer.slice(cursor, cursor + nameLength);
            cursor += nameLength;
            const name = TEXT_DECODER.decode(nameEncoded);
            const length = dataView.getUint32(cursor);
            cursor += 4;
            this._files[name] = [cursor, length];
            cursor += length;
        }
    }

    addFile(name: string, contents: Uint8Array) {
        // 2 bytes for length of name, name, 4 bytes for length of contents, contents
        const encodedName = TEXT_ENCODER.encode(name).slice(0, 0x10000);
        const totalEntry = 2 + 4 + encodedName.length + contents.length;
        const cursor = this._buffer.byteLength;

        // Add to cache:
        this._files[name] = [cursor + 2 + 4 + encodedName.length, contents.length];

        this._buffer.resize(cursor + totalEntry);
        const rawBuffer = new Uint8Array(this._buffer, cursor, totalEntry);
        const dataView = new DataView(this._buffer, cursor, totalEntry);
        dataView.setUint16(0, encodedName.length);
        rawBuffer.set(encodedName, 2);
        dataView.setUint32(2 + encodedName.length, contents.length);
        rawBuffer.set(contents, 2 + encodedName.length + 4);
    }

    listFiles() {
        return Object.keys(this._files);
    }

    listFilesWithMetadata(): [string, number, number][] {
        return Object.entries(this._files).map(e => [e[0], ...e[1]]);
    }

    getFile(fileName: string): Uint8Array<ArrayBuffer> {
        const ref = this._files[fileName];
        if(!ref) throw new Error("No such file: " + fileName);
        return new Uint8Array(this._buffer.slice(ref[0], ref[0] + ref[1]).transferToFixedLength());
    }
}
