const fs = require("fs");
const path = require("path");
// Duplicate the simple SAR logic - metadata.json has to be the first file anyway, so simply assert if it is
// and if so, read the file and retrieve it.

function readMetadata(file) {
    const fd = fs.openSync(file);
    const buffer = Buffer.alloc(19);
    fs.readSync(fd, buffer, 0, 19);
    if(buffer.subarray(0, 15).toString('base64') !== 'AA1tZXRhZGF0YS5qc29u') {
        throw new Error("Invalid WME file!");
    }

    const length = buffer.readInt32BE(15);
    const contentsBuffer = Buffer.alloc(length);
    fs.readSync(fd, contentsBuffer, 0, length);

    fs.closeSync(fd);

    return JSON.parse(contentsBuffer.toString('ascii'));
}

const output = [];
for(const encoderFile of fs.readdirSync('dist/encoders')) {
    if(encoderFile.endsWith('.wme')) {
        const metadataContents = readMetadata(path.join('dist', 'encoders', encoderFile));
        output.push({
            path: `encoders/${encoderFile}`,
            version: metadataContents.version,
            id: metadataContents.encoderId
        })
    }
}

fs.writeFileSync('dist/encoders.json', JSON.stringify(output));
