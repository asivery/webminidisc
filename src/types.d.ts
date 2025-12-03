declare module '@ffmpeg/ffmpeg';
declare module '@ffmpeg/ffmpeg/src/index';
declare module 'recorderjs';
declare module 'v86'; // v86 types are available in the repo but not published to npm
declare module '*.svg' {
    const content: string;
    export default content;
}
declare module 'react95';
declare module 'react95/dist/themes/original';
declare module 'react95/dist/fonts/ms_sans_serif.woff2';
declare module 'react95/dist/fonts/ms_sans_serif_bold.woff2';
declare module 'jconv';

interface ArrayBuffer {
    /**
     * A fake property to make TypeScript distinguish between ArrayBuffer and (U)int*Array
     */
    notTypedArray: undefined;
}

interface SharedArrayBuffer {
    /**
     * A fake property to make TypeScript distinguish between SharedArrayBuffer and (U)int*Array
     */
    notTypedArray: undefined;
}
