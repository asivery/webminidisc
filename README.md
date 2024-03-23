# Web MiniDisc Pro

*Brings NetMD Devices to the Web* - just with more features this time

Live @ [https://web.minidisc.wiki/](https://web.minidisc.wiki/).

## Requirements

Requires *Chrome* or any other browser that supports both **WASM** and **WebUSB**

## Installation

### macOS
_it just works ®_ ... no need to download or install any software.

For macOS developers, see [this](#development-on-macos)

### Linux
Follow the instructions here [https://github.com/glaubitz/linux-minidisc/tree/master/netmd/etc](https://github.com/glaubitz/linux-minidisc/tree/master/netmd/etc) to grant your user access to the device. If you skip this step you'll likely get an *Access denied* message when trying to connect.

*Ubuntu users* - Avoid using browsers installed via Snap as Snap's permission structure is different from traditionally installed applications and will lead to access denied errors. 

### Windows
The Windows USB stack requires a driver to be installed to communicate with any USB device. The bad news is that there are no official Windows 10 drivers for NetMD devices. The good news is that we don't need it!
We can just use a generic driver like *WinUSB* to access the device.

You can find installation instruction [here](https://docs.microsoft.com/en-us/windows-hardware/drivers/usbcon/winusb-installation), but the easiest way to install is to use [Zadig](https://zadig.akeo.ie/).<br/> Note: you'll need to restart your browser after installation.

### Chrome OS
Works without any addtional set up - tested with 91 stable (91.0.4472.102). If your user account or device is managed (by your school or company) you may run into some issues. If you are using a personal google account on a personal chromebook you should be good to go.

-----
## Differences between [Web Minidisc](https://github.com/cybercase/webminidisc) and Web Minidisc Pro
Web MiniDisc Pro was forked from the original Web MiniDisc to provide a more advanced workflow for interacting with NetMD devices. 

In addition to the standard NetMD features that Web MiniDisc provides, Web MiniDisc Pro also features:
- The ability to connect to NetMD units available on the local network with the help of [Remote NetMD](https://github.com/asivery/remote-netmd-server)
- Downloading tracks from the player via standard NetMD commands (Sony MZ-RH1 only)
- Improved handling of pre-encoded ATRAC3 tracks
- Song Recognition
- The ability to use an external ATRAC3 encoder for better audio quality when using LP modes

*The following features depend on Factory mode commands. See [netmd-exploits](https://github.com/asivery/netmd-exploits/) for a list of supported devices*
- Downloading tracks from any Sony (or Aiwa) NetMD device
- Firmware and RAM dumping 
- TOC manipulation
- Tetris

-----
## Development

Development discussion and coordination happens through the [MiniDisc.wiki Discord](https://minidisc.wiki/discord) in the #research channel

### How to build

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app), so you can run:
- `npm i` to install the required node modules (`--legacy-peer-deps` might be required for newer node.js versions)
- `npm start` to start the development server
- `npm build` to build for production

WASM modules are provided in the `public/` directory. However, if you wish to build those binaries yourself, instructions are provided in the `extra/` directory.

-----
### Development on macOS

#### Install Xcode Build Tools CLI & Homebrew
In macOS Terminal run:
- `xcode-select install` - to install XCode Command Line Tools
- `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` - to install Homebrew

After homebrew is finished installing,

#### Install gcc & libvips

In macOS Terminal: `brew install --build-from-source gcc`, wait for it to finish then run `brew install vips` (this command may install gcc again from an available pre-built binary, if one exists for your current macOS version, this is normal behaviour as gcc is needed for vips to work).

#### Proceeding with installation

With the above prerequisites done, you can continue the build process as described in the [How to Build](#how-to-build) section

-----
### How to Contribute
If there's a feature you'd like to see implemented in Web MiniDisc Pro, feel free to submit a pull request.

### Bugs and Issues
Feel free to submit any issues as a GitHub issue. Web MiniDisc Pro is a hobby project and the developers cannot make guarantees about timeliness of bugfixes. If you have the skills to implement fixes yourself, we're more than happy to review pull requests.

## Credits
- [FFmpeg](https://www.ffmpeg.org/) *and* [ffmpegjs](https://github.com/ffmpegjs/FFmpeg) *to read audio files (wav, mp3, ogg, mp4, etc...).*
- [Atracdenc](https://github.com/dcherednik/atracdenc/) *to support atrac3 encoding (lp2, lp4 audio formats).*
- [Emscripten](https://emscripten.org/) *to run both FFmpeg and Atracdenc in the browser.*
- [netmd-js](https://github.com/cybercase/netmd-js) *to send commands to NetMD devices using Javascript*
- [material-ui](https://material-ui.com/) *to build the user interface.*
- [linux-minidisc](https://github.com/linux-minidisc/linux-minidisc) *to build the netmd-js library.*
- [netmd-exploits](https://github.com/asivery/netmd-exploits/) *For factory mode commands and track dumping*
