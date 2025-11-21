import { ChangelogVersion } from "./bridge-types";

export const CHANGELOG: ChangelogVersion[] = [
    {
        name: "Version 1.5.3",
        contents: [
            "Added the ability to see used time / bytes on the current disc",
            "Fixed HiMD workers",
            "Fixed incorrect extension being applied to ripped files",
        ],
    },
    {
        name: "Version 1.5.2",
        contents: [
            "Added the ability to format MDs to HiMD on supported devices",
            "Fixed song recognition",
            "Fixed issues with codec recognition",
        ],
    },
    {
        name: "Version 1.5.1",
        contents: [
            "Switched to byte-based storage space calculations in HiMD",
            "Updated HiMD support libraries",
            "Fixed some stability issues related to the remote encoder",
            "Fixed some issues regarding track recognition",
            "Fixed full-width title support",
        ]
    },
    {
        name: "Version 1.5.0",
        contents: [
            "Overhauled UI - updated all outdated dependencies",
            ["I now have a ", { type: 'link', url: 'https://ko-fi.com/asivery', content: "Ko-Fi" }, " - if you're enjoying this software, please send me a tip :)"],
            "Unlocked mono upload for some non-exploitable devices (Sony decks and some Panasonic portables)",
            "Added a device name field in homebrew mode",
            "Added unrecoverable error handling",
            "Added support for remote libraries",
            {
                type: 'sublist',
                name: "Updated to himd-js 0.2.0",
                content: [
                    ["Switched from ", { type: 'code', content: "fatfs" }, " to ", { type: 'code', content: "nufatfs" }],
                    "Added support for track deletion in HiMD mode"
                ]
            },
            {
                type: 'sublist',
                name: "Updated to netmd-exploits 0.5.8",
                content: ["Increased RH1 exploits compatibility"]
            },
            "Fixed UI inconsistencies",
            "Fixed numerous bugs regarding communication with Sharp and some Sony devices"
        ]
    },
    {
        name: "Version 1.4.2",
        contents: [
            {
                type: 'sublist',
                name: "Updated to netmd-exploits 0.5.4",
                content: ["Added support for SP MONO upload"]
            },
            {
                type: 'sublist',
                name: "Updated to himd-js 0.1.10",
                content: ["Added support for HiMD disc wiping"]
            },
            "Added a disc-protected warning window",
            "Added a shortcut to SP Speedup in Homebrew Shortcuts menu"
        ]
    },
    {
        name: "Version 1.4.1",
        contents: [
            {
                type: 'sublist',
                name: "Updated to netmd-exploits 0.5.3",
                content: [
                    "Added support for Full HiMD mode for Hn1.10A and Hn1.000",
                    "Added support for ATRAC download for Hn1.10A and Hn1.000"
                ]
            },
            "Added support for uploading MKA files",
            "Fixed MP3 files uploaded to HiMD always being 128kbps"
        ]
    },
    {
        name: "Version 1.4.0",
        contents: [
            {
                type: 'sublist',
                name: "Added full HiMD support",
                content: [
                    "Added support for HiMD metadata editing",
                    "Added support for HiMD ATRAC3 / ATRAC3+ / LPCM / MP3 download",
                    "Added support for HiMD MP3 upload"
                ]
            },
            {
                type: 'sublist',
                name: "Updated to netmd-exploits 0.5.1",
                content: [
                    "Added the ability to download ATRAC data from standard MDs using HiMD portables",
                    "Added the ability to upload AEA files back to MDs on supported devices",
                    "Fixed Tetris on normal Sony portables",
                    "(Hopefully) Fixed the L/R channel mismatch bug"
                ]
            },
            "Added homebrew mode shortcuts in the main UI",
            "Added progress indicator in tab title for uploading",
            "Added an option to archive discs as ZIPs",
            "Added an option to auto-convert ripped tracks to WAV",
            "Added an option to strip TrProtect from all files via the homebrew mode",
            "Added CSV export as part of the archive disc command",
            "Added full width title to the upload progress dialog",
            "Added a warning for when a mediocre encoder is used",
            "Added an option to rename tracks in the song recognition dialog",
            "Merged all settings into one dialog",
            "Fixed timestamps table in homebrew mode",
            "Fixed CSV export missing the first group if all tracks are grouped",
            "Fixed disc title editing being available even if disc was write protected",
            "Fixed incorrect order when uploading pre-encoded LP2 and LP4 tracks",
            "Fixed original title of a song not displaying in the song recognition dialog, if it was sanitized away"
        ]
    },
    {
        name: "Version 1.3.2",
        contents: [
            "Reverted version 1.3.1",
            "Made Type-R ripping a lot more stable, removed Type-R warnings, re-enabled exploit-based song recognition for Type-R devices",
            [
                "Fixed external encoders requiring root path in URL (Issue ", 
                { type: 'link', url: "https://github.com/asivery/webminidisc/issues/11", content: "#11" },
                ")"
            ],
            [
                "Fixed stripping SCMS information (Issue ",
                { type: 'link', url: "https://github.com/cybercase/webminidisc/issues/110", content: "#110" },
                ")"
            ]
        ]
    },
    {
        name: "Version 1.3.1",
        contents: [
            "Disabled EEPROM writing routines when entering the homebrew mode for Type-R units",
            "[Temporary] Disabled exploits-based track recognition for Type-R units"
        ]
    },
    {
        name: "Version 1.3.0",
        contents: [
            "Renamed 'Factory Mode' to 'Homebrew Mode'",
            "Added track normalization",
            [
                "Added the ability to use a ",
                { type: 'link', clickHandler: 'openSettings', content: "high quality LP encoder" }
            ],
            "Added song recognition",
            "Added CSV track list import and export",
            "Added support for ReplayGain",
            "Added remaining time display in the convert dialog",
            "Added the ability to export and import track lists from discs to CSV files",
            "Fixed line-in track recording",
            {
                type: 'sublist',
                name: "Updated to netmd-exploits 0.4.0",
                content: [
                    "Added bulk ATRAC transfer via USB (Speedup from ~1.1x SP transfer to ~3x SP transfer)",
                    "Added support for IRQ-based ATRAC transfer for Type-R devices",
                    "Added support for direct TOC editing and cloning for Type-R devices",
                    [
                        "Disabled tetris because of a suspected bug (If you tried running tetris, and can no longer upload tracks, please contact me)"
                    ],
                    "Added the ability to force a 2x speed device to record SP in 4x"
                ]
            },
            {
                type: 'sublist',
                name: "Updated to netmd-js 4.1.0",
                content: ["Sped up encryption"]
            }
        ]
    },
    {
        name: "Version 1.2.2",
        contents: [
            "Added a button to enable ATRAC ripping in the main UI.",
            "ATRAC ripping bugfixes and better compatibility."
        ]
    },
    {
        name: "Version 1.2.1",
        contents: [
            "Labelled the factory mode better",
            "Fixed a bug in ATRAC autodetection"
        ]
    },
    {
        name: "Version 1.2.0",
        contents: [
            {
                type: 'sublist',
                name: "Added factory mode support for Sony portables. It's available from the ellipsis menu",
                content: [
                    "Added the ability to transfer music from NetMD to PC via USB",
                    "Added the ability to edit the ToC byte-by-byte",
                    "Added the ability to download and upload the ToC",
                    "Added the ability to dump the devices' RAM and ROM",
                    "Added the ability to load and play Tetris (thanks Sir68k!)"
                ]
            },
            "Added ATRAC3 autodetection (for both WAVs and OMAs)",
            "Added better support for bookshelf systems",
            "Fixed incorrect title limits",
            "Fixed the title corruption bug"
        ]
    },
    {
        name: "Version 1.1.1",
        contents: [
            "Prevented entering sleep mode when uploading tracks",
            "Fixed some small bugs"
        ]
    },
    {
        name: "Version 1.1.0",
        contents: [
            "Added better support for Kenwood NetMD devices",
            "Added the ability to eject and change the disc",
            "Fixed some bugs regarding upload stalling"
        ]
    },
    {
        name: "Version 0.3.0",
        contents: [
            [
                "Added support for ",
                { type: 'link', url: "https://github.com/asivery/remote-netmd-server", content: "Remote NetMD" }
            ],
            "Fixed numerous bugs regarding NetMD upload and Sony LAMs",
            "Added support for downloading tracks via NetMD from the Sony MZ-RH1 recorder",
            "Numerous programming changes"
        ]
    },
    {
        name: "Version 0.2.4",
        contents: [
            "Added the changelog dialog",
            "Added a basic self-test",
            [
                "Added full support for Sony LAM-Series devices (Issue ", 
                { type: 'link', url: "https://github.com/cybercase/webminidisc/issues/29", content: "#29" }, 
                ", ", 
                { type: 'link', url: "https://github.com/cybercase/webminidisc/issues/60", content: "#60" },
                ")"
            ],
            {
                type: 'sublist',
                name: 'Overhauled the convert dialog',
                content: [
                    "Added the ability to rename tracks before sending them to the recorder",
                    "Added a live preview of how the tracks are going to be titled when selecting different formats",
                    ["Added a warning about using too many characters (Issue ", { type: 'link', url: "https://github.com/cybercase/webminidisc/issues/66", content: "#66"}, ")"]
                ]
            }
        ]
    }
];
