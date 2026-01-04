# Atrac3 OS

This directory contains everything you need to build a the system image for the high-quality built in ATRAC encoder.

This means that you won't have to rely on open source encoders like [atracdenc](https://github.com/dcherednik/atracdenc) or an external service like [atrac-api](https://github.com/MiniDisc-wiki/atrac-api) to convert your music for your NetMD device.

It works by building a custom kernel thanks to the [Calderalinker project](https://github.com/asivery/calderalinker) with the "libatrac.so" Sony encoder embedded into it, with additional wrappers which manage the transfer of data between Javascript and i386 machine code. That system image is later executed by a patched copy of [v86](https://github.com/copy/v86) within the browser.


Don't expect this to be fast :) ... But you'll definitely get the original Atrac3 quality!

## How to build

Note: you'll need a working Docker installation

### Steps
1. Make sure you have submodules cloned (`git submodule update --init`)
2. Setup a python3 venv, and install the packages defined in `calderalinker/requirements.txt`
3. Copy `libatrac.so.1` into the `atracproject` folder
4. Build the wrapper - run `make` in `atracproject` (Make sure you have a 32-bit x86 toolchain installed!)
5. Link the system image - run `python3 atracproject.py`

### Result

In `./output` you'll find the `kernel.bin` and `system.cmi` files


## Credits:

- The system image uses the [tiny](https://github.com/andsmedeiros/tiny) memory allocator.
