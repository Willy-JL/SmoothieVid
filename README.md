# SmoothieVid
Smoothen and stabilize videos in your browser!

<video src="https://user-images.githubusercontent.com/49810075/187991683-68170208-a3dc-4730-9546-22c0b7a728c9.mp4"></video>

## How it works:

Thanks to the possibilities of Web Assembly (WASM) it is possible to run desktop level applications from within the browser. In particular SmoothieVid makes use of [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) to run FFmpeg (an industry standard multimedia manipulation framework) inside your browser. This means that **all the processing is done locally on your machine**, **your video files are not sent anywhere**, the web server isn't overloaded, and you save bandwith by not having to upload and download the videos (only data needed is the visual interface and the ffmpeg.wasm binary, which amounts to a total of about 25mb that is only downloaded the first time you use SmoothieVid). FFmpeg by itself, however, does not support video stabilization, for that it has to be extended with [vid.stab](https://github.com/georgmartius/vid.stab), which is why SmoothieVid uses a [custom ffmpeg.wasm-core](https://github.com/Willy-JL/ffmpeg.wasm-core-vidstab/) with that built in.

## Thanks:

- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) for making this possible
- [jeromewu](https://github.com/jeromewu) for helping me integrate vid.stab into ffmpeg.wasm
- [vid.stab](https://github.com/georgmartius/vid.stab) for the unparalleled stabilization performance it offers
- [FFmpeg](https://ffmpeg.org/) for existing
