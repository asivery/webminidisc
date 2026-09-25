import { join } from 'path';
import { SARFile } from './external-archive';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

function listFiles(files: string[]) {
    for(const sarFileName of files) {
        const sarFileContents = new Uint8Array(readFileSync(sarFileName));
        console.log(`==== ${sarFileName} ====`);
        const sarFile = new SARFile(sarFileContents);
        for(const [name, offset, length] of sarFile.listFilesWithMetadata()) {
            console.log(`- ${name} @ 0x${offset.toString(16)} - ${length} bytes`);
        }
    }
}

function appendToFile(sarFileName: string, files: string[]) {
    let data = undefined;
    if(existsSync(sarFileName)) {
        data = new Uint8Array(readFileSync(sarFileName));
    }

    const sarFile = new SARFile(data);
    for(let file of files) {
        let inFileName;
        if(file.includes(':')) {
            [file, inFileName] = file.split(':') as [string, string];
        } else {
            inFileName = file;
        }
        let x = inFileName.match(/^(\.?\/)+/);
        if(x) {
            inFileName = inFileName.slice(x[0].length);
        }
        sarFile.addFile(inFileName, new Uint8Array(readFileSync(file)));
    }

    writeFileSync(sarFileName, new Uint8Array(sarFile.buffer));
}

function extractFile(sarFileName: string, destination: string) {
    const sarFile = new SARFile(new Uint8Array(readFileSync(sarFileName)));
    for(const sarFileName of sarFile.listFiles()) {
        console.log(`Extracting ${sarFileName}...`);
        let outFileName = sarFileName;
        let x = outFileName.match(/^((\.\.)?\/)+/);
        if(x) {
            outFileName = outFileName.slice(x[0].length);
        }

        writeFileSync(join(destination, outFileName), sarFile.getFile(sarFileName));
    }
}


function main() {
    const action = process.argv[2];
    const files = process.argv.slice(3);
    switch(action){
        case 'list': {
            listFiles(files);
            break;
        }
        case 'append': {
            if(files.length < 2) {
                console.log("Syntax: sar-packager append <sarfile> <files...>");
                process.exit(-1);
            }
            const sarFile = files[0]!;
            const filesToAdd = files.slice(1);
            appendToFile(sarFile, filesToAdd);
            break;
        }
        case 'create':
            if(files.length < 2) {
                console.log("Syntax: sar-packager create <sarfile> <files...>");
                process.exit(-1);
            }
            const sarFile = files[0]!;
            const filesToAdd = files.slice(1);
            try { unlinkSync(sarFile); } catch(_){}
            appendToFile(sarFile, filesToAdd);
            break;
        case 'extract': {
            const sarFile = files[0]!;
            const destination = files[1]!;
            if(!sarFile || !destination) {
                console.log("Syntax: sar-packager extract <sarfile> <destination>");
            }
            extractFile(sarFile, destination);
            break;
        }

        default: console.log("Syntax: sar-packager <extract / list / append / create> <sarfile> ...")
    }
}

main();
