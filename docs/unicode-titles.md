# Unicode title conversion

Standard NetMD Rename Disc, Track, Group and upload-track dialogs have an editable
Unicode source above the two device titles. To Pinyin and To JIS replace only their
respective target field; Rename submits the compatible device titles. Unicode is
not an additional on-disc title and is not recovered after eject/restart.

Pinyin Setting is shared across these dialogs and saved in localStorage under
`renamePinyinSettings.v1`. Defaults: spaces, capitalize each syllable, no tones,
ü rendered as v. Existing Latin text and punctuation are preserved. The phrase
pronunciation can be corrected manually in the target field.

To JIS maps simplified/traditional Chinese to Japanese character forms, normalizes
full-width characters and checks the existing SJIS codec with a round trip.
OpenCC's Japanese mapping is experimental and is not a translation engine.
Unsupported characters remain editable, with an error that prevents saving until
corrected or the full-width field is cleared. Names over the existing 120/105
character limits are rejected without truncation.

Upload files retain a stable source ID and a File/AdaptiveFile reference in React
context (never Redux). Unicode is reread from tags on the first rename. Explicit
Reload Tag overwrites only the Unicode draft; Cancel discards the draft. Saving a
rename preserves Unicode and both device titles within the current queue, even
when reordered or extended. Changing the upload title-format regenerates titles.
Filename mode uses the tag title for Unicode, falling back to the filename when
there is no Title tag. Device tracks can select an original music file to read.
Read failures preserve the draft. Session and revision checks reject stale reads.

The existing tag parser decodes the declared encoding; malformed legacy tags are
not guessed or repaired. Source music files are never modified. HiMD, Win95 and
song-recognition dialogs retain their existing interfaces.

## Dependencies and references

Both conversion dictionaries are bundled; no title is sent to a conversion site.

- pinyin-pro 3.29.4: https://github.com/zh-lx/pinyin-pro (MIT)
- opencc-js 1.4.2: https://github.com/nk2028/opencc-js (MIT and Apache-2.0)
- UI references: https://www.jcinfo.net/zh-hans/tools/kanji and
  https://zhongwenzhuanpinyin.bmcx.com/

License texts and third-party notices ship in `public/title-conversion-licenses.txt`.

## Verification and building

From this submodule run `npm run test:titles` and `npx tsc --noEmit`.
Tests cover conversion, all nine pinyin formats, strict device validation, actual
UTF-8/UTF-16 ID3 frames, absent/invalid tags, stale read protection and queue IDs.

From ElectronWMD run `bash build-renderer.sh --force` to build and replace an
existing renderer. The normal build keeps its existing reuse behavior. Use this
explicit rebuild before packaging title changes. Physical-device read-back remains
a separate check from MockMD validation.
