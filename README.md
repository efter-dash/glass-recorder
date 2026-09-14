# Glass Recorder

A private, local video recorder for macOS with flexible aspect ratios, MP4 output, and direct saving to Downloads.

Built with Codex to solve a small but frustrating problem.

## The Story

I was struggling to record videos using Photo Booth, the recording app included with macOS. It didn’t offer the aspect ratios I needed, and saving or locating recordings took more effort than it should have.

A simple recording task was wasting too much time, so I thought:

> What if I made an app that records in different aspect ratios and saves videos directly to Downloads?

That is exactly what Glass Recorder does.

I originally created it for myself—and for anyone else who appreciates this tiny bit of convenience.

## Features

- Uses the Mac’s FaceTime camera by default
- Records microphone audio
- Supports four aspect ratios:
  - **9:16** — Reels and Shorts
  - **3:4** — Portrait posts
  - **1:1** — Square posts
  - **16:9** — Landscape video
- Produces MP4 recordings using H.264/AAC when supported
- Saves videos directly to the browser’s Downloads location
- Provides a live, mirrored camera preview
- Crops the actual recorded output—not only the preview
- Includes recording, playback, and download controls
- Runs locally without uploading recordings
- Includes a native macOS menu-bar companion
- Uses a macOS-inspired Liquid Glass interface
- Supports light and dark appearances
- Adapts to different screen sizes

## How It Works

Glass Recorder captures the camera and microphone using the browser’s `MediaDevices.getUserMedia()` API.

After camera permission is granted, the app examines the available video-input devices and selects the Mac’s FaceTime camera when it is available.

The live camera feed is drawn onto an HTML `<canvas>` at the dimensions required for the selected aspect ratio:

| Ratio | Output resolution | Intended use |
|---|---:|---|
| 9:16 | 1080 × 1920 | Reels and Shorts |
| 3:4 | 1080 × 1440 | Portrait posts |
| 1:1 | 1080 × 1080 | Square posts |
| 16:9 | 1920 × 1080 | Landscape video |

The canvas uses center-cropping calculations to preserve the camera feed’s proportions while filling the selected frame. It is then converted into a 30 FPS `MediaStream` using `HTMLCanvasElement.captureStream()`.

The microphone track is added to this output stream, and the browser’s `MediaRecorder` API records the combined video and audio.

The completed recording is converted into a local Blob URL for previewing and downloading. Nothing is uploaded to an external server.

## Technical Stack

- **Next.js**
- **React**
- **TypeScript**
- **Vinext**
- **Vite**
- **Tailwind CSS**
- **Lucide icons**
- **HTML Canvas API**
- **MediaDevices API**
- **MediaRecorder API**
- **MediaStream API**
- **WebMCP**
- **AppKit**
- **Objective-C**
- **macOS `NSStatusItem`**
- **Codex**

## Native Menu-Bar Companion

Glass Recorder includes a lightweight native macOS companion built with Objective-C and AppKit.

It uses `NSStatusItem` to display a persistent camera icon in the macOS menu bar. The companion starts the local application server without displaying a Terminal window and opens the recorder in Safari for MP4/H.264 compatibility.

The menu-bar controls include:

- Open Recorder
- Restart Recorder
- Quit Glass Recorder

## Liquid Glass Interface

The interface is inspired by the Liquid Glass design language used in modern macOS.

It uses:

- Layered translucent surfaces
- Background blur and saturation
- Specular borders
- Soft ambient color
- Adaptive light and dark themes
- Native macOS typography
- Responsive aspect-ratio transitions

The design is implemented with CSS gradients, `backdrop-filter`, shadows, transparency, and responsive layout rules.

[Watch the Demo on YouTube](https://youtu.be/WTAsm1nJCpY)

## Privacy

Glass Recorder runs locally on your Mac.

- Camera processing happens on the device
- Recordings are held in browser memory
- Videos are not uploaded
- No account is required
- No analytics or tracking is included
- A file is created only when you choose to save it

## Running the App

### Menu-bar application

Open:

```text
Glass Recorder.app
