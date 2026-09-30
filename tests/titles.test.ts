import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPinyin, toJIS, validateDeviceTitles, normalizePinyinSettings } from '../src/title-conversion';
import { readUnicodeTag, formatUnicodeTag } from '../src/unicode-tags';
import { reducer as rename, actions as renameActions, RenameType } from '../src/redux/rename-dialog-feature';
import { reducer as convert, actions as convertActions } from '../src/redux/convert-dialog-feature';

test('pinyin handles simplified/traditional, umlaut and phrase pronunciation', () => {
    for (const text of ['孙燕姿', '孫燕姿']) assert.equal(toPinyin(text), 'Sun Yan Zi');
    assert.equal(toPinyin('女'), 'Nv');
    assert.equal(toPinyin('重庆音乐'), 'Chong Qing Yin Yue');
    assert.equal(toPinyin('孫燕姿 My Story, CD1!'), 'Sun Yan Zi My Story, CD1!');
    assert.equal(toPinyin(''), '');
});
test('all nine pinyin formats preserve existing Latin text and punctuation', () => {
    for (const separator of [' ', '-', ''] as const) {
        for (const letterCase of ['lower', 'title', 'upper'] as const) {
            const words =
                letterCase === 'lower' ? ['sun', 'yan', 'zi'] : letterCase === 'upper' ? ['SUN', 'YAN', 'ZI'] : ['Sun', 'Yan', 'Zi'];
            assert.equal(toPinyin('孙燕姿 - My CD1', { separator, letterCase }), words.join(separator) + ' - My CD1');
        }
    }
    assert.deepEqual(normalizePinyinSettings({ separator: '?', letterCase: null }), { separator: ' ', letterCase: 'title' });
});
test('Japanese character mapping and strict device round-trip', () => {
    for (const text of ['汉语', '漢語']) assert.equal(toJIS(text), '漢語');
    for (const text of ['音乐', '音樂']) assert.equal(toJIS(text), '音楽');
    assert.equal(toJIS('音乐 CD1'), '音楽　ＣＤ１');
    assert.equal(validateDeviceTitles('Yin Yue', toJIS('音乐')).fullWidthError, '');
    assert.match(validateDeviceTitles('音乐😀', '').titleError, /unsupported/);
    const invalid = validateDeviceTitles('', '音楽😀𠮷');
    assert.match(invalid.fullWidthError, /😀 𠮷/);
    assert.equal(invalid.normalizedFullWidth, '音楽😀𠮷');
    assert.equal(validateDeviceTitles('a'.repeat(120), '音'.repeat(105)).titleError, '');
    assert.match(validateDeviceTitles('a'.repeat(121), '音'.repeat(106)).titleError, /120/);
    assert.match(validateDeviceTitles('', '音'.repeat(106)).fullWidthError, /105/);
});

function openRename(title = 'old', fullWidth = '旧') {
    let state = rename(undefined, { type: 'init' });
    for (const action of [
        renameActions.setVisible(true),
        renameActions.setCurrentName(title),
        renameActions.setCurrentFullWidthName(fullWidth),
        renameActions.setRenameType(RenameType.TRACK),
    ]) {
        state = rename(state, action);
    }
    return state;
}
test('opening a different object resets Unicode source and chooses existing full-width title', () => {
    let state = openRename();
    state = rename(state, renameActions.setUnicodeSource({ sourceId: 'file-1', title: '中文', source: 'tag', reload: true }));
    state = rename(state, renameActions.setCurrentName('disc'));
    state = rename(state, renameActions.setCurrentFullWidthName(''));
    state = rename(state, renameActions.setRenameType(RenameType.DISC));
    assert.equal(state.unicodeTitle, 'disc');
    assert.equal(state.sourceId, null);
    assert.equal(state.reloadOnOpen, false);
});
test('stale tag results cannot overwrite a closed, changed or manually edited session', () => {
    let state = rename(openRename(), renameActions.startTagRead());
    const result = { sessionId: state.sessionId, revision: state.unicodeRevision, title: 'tag', source: 'tag' };
    assert.equal(rename(state, renameActions.finishTagRead(result)).unicodeTitle, 'tag');
    const edited = rename(state, renameActions.setUnicodeName('manual'));
    assert.equal(rename(edited, renameActions.finishTagRead(result)).unicodeTitle, 'manual');
    const closed = rename(state, renameActions.setVisible(false));
    assert.equal(rename(closed, renameActions.finishTagRead(result)).unicodeTitle, '旧');
    const switched = rename(state, renameActions.setRenameType(RenameType.GROUP));
    assert.equal(rename(switched, renameActions.finishTagRead(result)).unicodeTitle, '旧');
    const newRequest = rename(state, renameActions.startTagRead());
    assert.equal(rename(newRequest, renameActions.finishTagRead(result)).tagLoading, true);
    const failed = rename(state, renameActions.finishTagRead({ ...result, title: undefined, error: 'Invalid tag' }));
    assert.equal(failed.unicodeTitle, '旧');
    assert.equal(failed.tagError, 'Invalid tag');
});
test('saved upload edits follow stable source IDs through reorder and insertion', () => {
    const base = {
        title: 'original',
        fullWidthTitle: '',
        duration: 10,
        forcedEncoding: null,
        bytesToSkip: 0,
        generatedFormat: 'title' as const,
    };
    let state = convert(
        undefined,
        convertActions.setTitles([
            { ...base, sourceId: 'a', title: 'edited', unicodeTitle: '原文', unicodeSource: 'edited', unicodeSaved: true },
            { ...base, sourceId: 'b' },
        ])
    );
    state = convert(
        state,
        convertActions.refreshTitles([
            { ...base, sourceId: 'b' },
            { ...base, sourceId: 'c' },
            { ...base, sourceId: 'a' },
        ])
    );
    assert.equal(state.titles[0].title, 'original');
    assert.equal(state.titles[2].title, 'edited');
    assert.equal(state.titles[2].unicodeTitle, '原文');
    state = convert(state, convertActions.refreshTitles([{ ...base, sourceId: 'a', generatedFormat: 'artist-title' }]));
    assert.equal(state.titles[0].title, 'original');
});

// Real ID3 frames followed by valid MPEG audio frames; no parser mocks.
function taggedMP3(title?: string, encoding: 'utf8' | 'utf16le' = 'utf8') {
    let frames = Buffer.alloc(0);
    if (title !== undefined) {
        const text = encoding === 'utf8' ? Buffer.from(title) : Buffer.concat([Buffer.from([255, 254]), Buffer.from(title, 'utf16le')]);
        const value = Buffer.concat([Buffer.from([encoding === 'utf8' ? 3 : 1]), text]);
        const header = Buffer.alloc(10);
        header.write('TIT2');
        header.writeUInt32BE(value.length, 4);
        frames = Buffer.concat([header, value]);
    }
    const id3 = Buffer.alloc(10);
    id3.write('ID3');
    id3[3] = encoding === 'utf8' ? 4 : 3;
    let size = frames.length;
    for (let i = 9; i >= 6; i--) {
        id3[i] = size & 127;
        size >>>= 7;
    }
    const audio = Buffer.alloc(417 * 3);
    for (let i = 0; i < 3; i++) Buffer.from([255, 251, 144, 0]).copy(audio, i * 417);
    return new File([id3, frames, audio], 'fallback.mp3', { type: 'audio/mpeg' });
}
test('real UTF-8 and UTF-16 tags are decoded without device filtering', async () => {
    for (const encoding of ['utf8', 'utf16le'] as const) {
        const result = await readUnicodeTag(taggedMP3('孙燕姿 音樂 😀', encoding));
        assert.equal(result.title, '孙燕姿 音樂 😀');
        assert.equal(result.source, 'Tag: fallback.mp3');
    }
});
test('missing title falls back to filename; malformed input rejects', async () => {
    const result = await readUnicodeTag(taggedMP3());
    assert.equal(result.title, 'fallback');
    assert.match(result.source, /no Title tag/);
    await assert.rejects(readUnicodeTag(new File(['bad'], 'broken.bin')));
    await assert.rejects(readUnicodeTag(new File(['broken metadata'], 'broken.mp3', { type: 'audio/mpeg' })));
});
test('Unicode title combinations and filename mode use the original tag', () => {
    const tag = { title: '音乐', artist: '孙燕姿', album: '经典' };
    assert.equal(formatUnicodeTag(tag, 'filename'), '音乐');
    assert.equal(formatUnicodeTag(tag, 'artist-title'), '孙燕姿 - 音乐');
    assert.equal(formatUnicodeTag(tag, 'title-artist'), '音乐 - 孙燕姿');
    assert.equal(formatUnicodeTag(tag, 'album-title'), '经典 - 音乐');
    assert.equal(formatUnicodeTag(tag, 'artist-album-title'), '孙燕姿 - 经典 - 音乐');
});
