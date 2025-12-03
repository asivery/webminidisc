# Atrac3 OS

This directory contains everything you need to build a Linux image to run on the Web the original Sony's Atrac3 converter (aka `psp_at3tool.exe`).

This means that you won't have to rely on open source encoders like [atracdenc](https://github.com/dcherednik/atracdenc) or an external service like [atrac-api](https://github.com/MiniDisc-wiki/atrac-api) to convert your music for your NetMD device.

It works by embedding `psp_at3tool.exe` (not included) into a custom [buildroot](http://buildroot.org/) Linux image.
The image runs inside a [v86](https://copy.sh/v86) virtual machine that's used to execute `psp_at3tool.exe` thanks to [atrac3-encoder-linux](https://github.com/asivery/atrac3-encoder-linux).


Don't expect this to be fast :) ... But you'll definitely get the original Atrac3 quality!

## How to build

Note: you'll need a working Docker installation

### Steps
1. Use [atrac3-encoder-linux](https://github.com/asivery/atrac3-encoder-linux) to create `psp_at3tool.exe.elf`
1. Copy `psp_at3tool.exe.elf` into `buildroot-v86/board/rootfs_overlay/`
2. Launch `./build.sh`

### Result

In `./dist` you'll find `atrac3os.iso`