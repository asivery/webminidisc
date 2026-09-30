import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvHeader, createTitleCSV, parseTitleCSV } from '../src/csv-titles';
import { validateCsvTitle, writeTitleCSV } from '../src/csv-title-import';
import { toChinese, toJIS, toPinyin } from '../src/title-conversion';
import { actions, reducer } from '../src/redux/csv-dialog-feature';
import type { Disc, NetMDService } from '../src/services/interfaces/netmd';

const disc: Disc = {
    title: 'Music',
    fullWidthTitle: '音楽 ＣＤ１',
    used: 360,
    left: 4440,
    total: 4800,
    writable: true,
    writeProtected: false,
    trackCount: 2,
    groups: [
        {
            index: 0,
            title: 'Group',
            fullWidthTitle: '図書',
            tracks: [
                {
                    index: 0,
                    title: 'First, Track',
                    fullWidthTitle: '漢語',
                    duration: 180,
                    channel: 2,
                    protected: 0,
                    encoding: { codec: 'SPS', bitrate: 292 },
                    album: '音楽',
                    artist: '広島',
                },
                {
                    index: 1,
                    title: 'Second',
                    fullWidthTitle: '音楽',
                    duration: 180,
                    channel: 2,
                    protected: 0,
                    encoding: { codec: 'SPS', bitrate: 292 },
                },
            ],
        },
    ],
};
const options = { usesHiMDTitles: false, supportsFullWidth: true, allowFullWidth: true };
const csv = () => createTitleCSV(disc).document;
const draft = () => parseTitleCSV(csv());

function mock(currentDisc = disc) {
    const calls: unknown[][] = [];
    const service = {
        listContent: async () => {
            calls.push(['list']);
            return currentDisc;
        },
        wipeDiscTitleInfo: async () => {
            calls.push(['wipe']);
        },
        renameDisc: async (...args: unknown[]) => {
            calls.push(['disc', ...args]);
        },
        addGroup: async (...args: unknown[]) => {
            calls.push(['group', ...args]);
        },
        renameTrack: async (...args: unknown[]) => {
            calls.push(['track', ...args]);
        },
    };
    return { calls, service: service as unknown as NetMDService };
}

test('CSV export modes preserve metadata, width, kana and the source disc', () => {
    const before = JSON.stringify(disc);
    for (const [mode, expected] of [
        ['none', '音楽'],
        ['simplified', '音乐'],
        ['traditional', '音樂'],
    ] as const) {
        const output = createTitleCSV(disc, mode);
        const parsed = parseTitleCSV(output.document);
        assert.equal(parsed.titles[0].fullWidthTitle, `${expected} ＣＤ１`);
        assert.equal(parsed.records[1].album, expected);
        assert.equal(parsed.records[1].artist, mode === 'none' ? '広島' : mode === 'simplified' ? '广岛' : '廣島');
        assert.equal(parsed.records[1].codec, 'SPS');
        assert.equal(parsed.records[1].bitrate, '292');
        assert.equal(parsed.records[1].duration, 180);
        assert.equal(parsed.titles.find((row) => row.id === 'track:1')!.title, 'First, Track');
        assert.equal(output.filename, `Music (${expected} ＣＤ１).csv`);
    }
    assert.equal(JSON.stringify(disc), before);
    assert.equal(toChinese('音楽 かな カナ, CD1! 😀', 'simplified'), '音乐 かな カナ, CD1! 😀');
    assert.equal(toChinese('', 'traditional'), '');
});

test('current aliases, BOM/CRLF, legacy format and empty discs remain importable', () => {
    const input = csv().replace('HIMD ALBUM,HIMD ARTIST', 'ALBUM,ARTIST');
    assert.equal(parseTitleCSV('\uFEFF' + input.replace(/\n/g, '\r\n') + '\r\n').records.length, 3);
    const legacy = csv()
        .split('\n')
        .map((row) =>
            row
                .split(/(?<!\\),/g)
                .filter((_, i) => i !== 6 && i !== 7 && i !== 10)
                .join(',')
        )
        .join('\n');
    const parsed = parseTitleCSV(legacy);
    assert.equal(parsed.records[1].bitrate, '');
    assert.equal(parsed.records[1].album, '');
    assert.equal(parsed.titles.filter((row) => row.id.startsWith('group:')).length, 1);
    assert.equal(parseTitleCSV(createTitleCSV({ ...disc, trackCount: 0, groups: [], used: 0 }).document).records.length, 1);
});

test('malformed headers, columns, indices, durations and ranges fail before preview', () => {
    assert.throws(() => parseTitleCSV(''), /Empty/);
    assert.throws(() => parseTitleCSV(csvHeader.join(',')), /missing its disc row/);
    assert.throws(() => parseTitleCSV(csv().replace('INDEX', 'OTHER')), /header/);
    assert.throws(() => parseTitleCSV(csv().replace('BITRATE', 'BITRATE,EXTRA')), /header/);
    assert.throws(() => parseTitleCSV(csv().replace('2,0-1', '2,0-1,extra')), /columns/);
    assert.throws(() => parseTitleCSV(csv().replace('2,0-1', '1,0-1')), /duplicate/);
    assert.throws(() => parseTitleCSV(csv().replace('2,0-1', '-2,0-1')), /index/);
    assert.throws(() => parseTitleCSV(csv().replace('180,SPS', 'bad,SPS')), /duration/);
    assert.throws(() => parseTitleCSV(csv().replaceAll('0-1', '0-9')), /outside/);
    assert.throws(() => parseTitleCSV(csv().replace('2,0-1,Group', '2,0-1,Different')), /conflicting/);
    assert.throws(() => parseTitleCSV(csv().replace('2,0-1,Group', '2,,Group')), /inconsistent/);
});

test('draft row edits keep Unicode and independent targets; cancel drops the draft', () => {
    let state = reducer(undefined, actions.open(draft()));
    state = reducer(state, actions.edit({ id: 'track:1', field: 'unicodeTitle', value: '孙燕姿' }));
    state = reducer(state, actions.edit({ id: 'track:1', field: 'title', value: toPinyin('孙燕姿') }));
    state = reducer(state, actions.edit({ id: 'track:1', field: 'fullWidthTitle', value: toJIS('孙燕姿') }));
    const row = state.draft!.titles.find((row) => row.id === 'track:1')!;
    assert.deepEqual([row.unicodeTitle, row.title, row.fullWidthTitle], ['孙燕姿', 'Sun Yan Zi', '孫燕姿']);
    assert.equal(state.draft!.titles.find((row) => row.id === 'track:2')!.title, 'Second');
    state = reducer(state, actions.edit({ id: row.id, field: 'title', value: 'Manual' }));
    assert.equal(state.draft!.titles.find((entry) => entry.id === 'track:1')!.title, 'Manual');
    assert.equal(reducer(state, actions.close()).draft, null);
});

test('unsupported characters and limits block writing without sanitizing away input', async () => {
    const data = draft();
    data.titles[0].fullWidthTitle = '音楽😀';
    const { calls, service } = mock();
    await assert.rejects(
        writeTitleCSV(
            data,
            service,
            options,
            () => true,
            () => {}
        ),
        /😀/
    );
    assert.deepEqual(calls, []);
    assert.equal(data.titles[0].fullWidthTitle, '音楽😀');
    assert.match(validateCsvTitle({ ...data.titles[0], title: 'x'.repeat(121) }, options).titleError, /120/);
    assert.match(validateCsvTitle({ ...data.titles[0], fullWidthTitle: '音'.repeat(106) }, options).fullWidthError, /105/);
    assert.match(validateCsvTitle(data.titles[0], { ...options, allowFullWidth: false }).fullWidthError, /Enable/);
    assert.match(validateCsvTitle(data.titles[0], { ...options, supportsFullWidth: false }).fullWidthError, /does not support/);
});

test('count cancellation and declined mismatches never prompt after mutation', async () => {
    const cancelled = mock({ ...disc, trackCount: 3 });
    assert.equal(
        await writeTitleCSV(
            draft(),
            cancelled.service,
            options,
            () => false,
            () => assert.fail('no writes')
        ),
        false
    );
    assert.deepEqual(cancelled.calls, [['list']]);
    const data = draft();
    data.records[1].duration = 999;
    data.records[2].codec = 'SPM';
    const { calls, service } = mock();
    let prompts = 0;
    await writeTitleCSV(
        data,
        service,
        options,
        () => {
            assert.equal(
                calls.some((call) => call[0] === 'wipe'),
                false
            );
            return ++prompts === 1;
        },
        () => {
            calls.push(['beforeWrite']);
        }
    );
    assert.equal(prompts, 2);
    assert.deepEqual(
        calls.filter((call) => call[0] === 'track').map((call) => call[1]),
        [0]
    );
    assert.deepEqual(calls.slice(0, 3), [['list'], ['beforeWrite'], ['wipe']]);
});

test('group drafts write once and HiMD retains album/artist title objects', async () => {
    const data = draft();
    data.titles.find((row) => row.id.startsWith('group:'))!.title = 'Edited group';
    const { calls, service } = mock();
    await writeTitleCSV(
        data,
        service,
        options,
        () => true,
        () => {}
    );
    assert.deepEqual(
        calls.filter((call) => call[0] === 'group'),
        [['group', 0, 2, 'Edited group', '図書']]
    );
    const hi = mock();
    data.titles.find((row) => row.id === 'track:1')!.title = '中文标题';
    await writeTitleCSV(
        data,
        hi.service,
        { ...options, usesHiMDTitles: true },
        () => true,
        () => {}
    );
    assert.deepEqual(
        hi.calls.find((call) => call[0] === 'track'),
        ['track', 0, { title: '中文标题', album: '音楽', artist: '広島' }]
    );
});

test('a device write failure stops later writes and propagates the error', async () => {
    const { calls, service } = mock();
    service.renameTrack = async () => {
        calls.push(['failed track']);
        throw new Error('Device disconnected');
    };
    await assert.rejects(
        writeTitleCSV(
            draft(),
            service,
            options,
            () => true,
            () => {}
        ),
        /Device disconnected/
    );
    assert.equal(calls.filter((call) => call[0] === 'failed track').length, 1);
});
