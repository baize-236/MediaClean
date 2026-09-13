# MediaClean

English · [简体中文](README.md)

Local image cleanup with LaMa, batch processing, before/after comparison, and experimental moving-watermark repair for short videos.

> Windows-first. The interface is currently Simplified Chinese. This is a local browser application, not a hosted service or standalone installer.

## Features

| Feature | Images | Videos |
| --- | --- | --- |
| LaMa inpainting | Rectangles, brush, eraser and undo | Experimental frame-by-frame repair |
| Fast fill and adjustable blur | Supported | Supported |
| Moving-watermark tracking | Not applicable | Manually selected template |
| Batch queue, downloads and before/after comparison | Supported | Supported |

Inputs: JPG, PNG, WebP, BMP; MP4, MOV, MKV, AVI, WebM, M4V. Actual decoding depends on FFmpeg. Maximum upload: 2 GB per file. Outputs: PNG images and MP4 videos.

## Quick start

Download and extract this repository, or clone its GitHub URL. Open PowerShell in the project root.

Install Node.js 22 or newer, plus FFmpeg with both `ffmpeg` and `ffprobe` on PATH:

```powershell
node --version
ffmpeg -version
ffprobe -version
npm ci
npm start
```

Visit **http://127.0.0.1:3220**. Alternatively, double-click `启动.cmd`. Press Ctrl+C in the terminal to stop the server.

Fast fill and blur do not need Python or model weights. Select either mode if AI dependencies have not been installed.

## Enable local AI

Install Python 3.11, then run without activating the virtual environment:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-torch.txt
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe scripts/download-model.py
npm start
```

Initial setup downloads dependencies and approximately 206 MB of weights. The downloader verifies SHA-256; see [model details](models/README.md). Subsequent media inference is local. CPU inference does not require NVIDIA hardware. Speed and memory depend on hardware and selection size. Only Windows has been validated.

## Usage

1. Select, drag in, or paste browser-supported media files.
2. Choose a compatible processing mode and mark unwanted regions.
3. For image AI, use rectangles, brush, eraser, zoom and undo as needed.
4. Submit the job, inspect the before/after comparison and download. Check each selection before batch submission.

For video AI, pause on a clear watermark frame, select a template, analyze and inspect its trajectory, then confirm. Repair the first three seconds before trying the full short clip. Low-confidence frames are skipped.

## Limits and privacy

- LaMa estimates missing content; it cannot recover guaranteed original details. Blur conceals rather than reconstructs.
- Video AI uses template matching, LaMa and conditional optical-flow blending. It is not ProPainter or automatic selection-free detection.
- Video AI: at most 30 seconds, constant 1–60 fps. Output is fitted to a maximum long edge of 1920 and short edge of 1080, with even dimensions. Scaling, rotation, transparency and complex backgrounds can cause tracking errors or flicker.
- Sources, outputs and history stay in `data/`. Deleting a task removes associated files. Refreshing loses unsubmitted edits. Closing the page does not stop server jobs; stopping the server interrupts processing.
- This loopback-only service has no login or user isolation. Do not expose it directly to the Internet.
- Use media you own or are authorized to edit.

## Development

```powershell
npm test
```

Tests generate synthetic media with FFmpeg and check basic processing and HTTP upload/download. Model weights are not required. AI and browser checks are separate.

- [Development and tests](docs/DEVELOPMENT.md)
- [FAQ](docs/FAQ.md)
- [Contributing](CONTRIBUTING.md)
- [Release checklist](docs/RELEASING.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Original project code uses the [MIT License](LICENSE). Third-party dependencies and weights retain their own terms. Weights, personal media and promotional assets are not included in source releases.
