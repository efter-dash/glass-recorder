# Glass Recorder

A private, offline camera recorder for Windows and macOS. Built with Codex.

## Desktop downloads

Desktop builds are being introduced in this branch. There is no published desktop release yet.

The build workflow produces:

- Windows x64: `Glass-Recorder-<version>-win-x64.exe` installer.
- Apple Silicon Mac: `Glass-Recorder-<version>-mac-arm64.dmg` and ZIP.
- Intel Mac: `Glass-Recorder-<version>-mac-x64.dmg` and ZIP.

Find successful preview builds under [Actions](https://github.com/efter-dash/glass-recorder/actions), open **Desktop builds**, and download the appropriate artifact (GitHub login required). Published builds will appear under [Releases](https://github.com/efter-dash/glass-recorder/releases). End users do not need Node.js, a terminal, or a browser server.

On Windows, run the installer. On macOS, open the DMG and drag Glass Recorder into Applications. Launch the app and allow camera/microphone access. Preview builds are unsigned and not notarized: Windows SmartScreen and macOS Gatekeeper may warn or block launch. Only install builds you trust; do not disable system security globally. These previews are not yet a signed public release.

## Recording

1. Choose an aspect ratio and turn on the camera.
2. Enable or mute the microphone, then start recording.
3. Stop, preview, and choose **Save**. The native save dialog starts in Downloads.

| Ratio | Output size |
|---|---|
| 9:16 | 1080 × 1920 |
| 3:4 | 1080 × 1440 |
| 1:1 | 1080 × 1080 |
| 16:9 | 1920 × 1080 |

The app center-crops and mirrors the recorded image to match the preview. It prefers a FaceTime camera when available, otherwise the system default. MP4 is preferred when the runtime supports it; otherwise recordings are saved as WebM with the correct extension. Format availability is detected at runtime, not promised for every device.

Recordings stay in memory until saved. Closing the app discards unsaved recordings; a confirmation appears before closing. Long recordings can consume substantial memory. Camera and microphone tracks are released when recording stops. No account, analytics, remote server, or upload is required.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm start
```

The original local React recorder has been restored into `src/`. Vite produces static assets and Electron bundles the runtime. The legacy Mac launcher that depended on a developer-specific path and a development server is not needed.

```sh
npm run build
npm test
npm run pack                 # unpacked app for the current platform
npm run dist -- --mac --arm64
npm run dist -- --mac --x64
npm run dist -- --win --x64   # run on Windows
```

Output is written to `release/`. Electron runs with renderer sandboxing and context isolation, without Node.js access in the UI. Permissions are restricted to media requests from the bundled app. A restrictive content security policy blocks network connections and external navigation is disabled.

## Releases and verification

`.github/workflows/desktop.yml` builds on macOS and Windows runners. Pushes and pull requests produce downloadable workflow artifacts. A `v*` tag builds all three targets and creates a **draft** GitHub release; it does not publish automatically. Match the tag to the version in `package.json`.

Before public release:

- Test installation and real camera/microphone capture on Windows, Intel Mac, and Apple Silicon Mac.
- Check all four ratios, audio/mute, replay, save cancellation, repeated recordings, denied permissions, and quitting with unsaved work.
- Configure Apple Developer ID signing and notarization and Windows code signing using protected CI secrets. The preview workflow currently disables automatic signing identity discovery.
- Publish the draft release only after checking its installers and limitations.

## The Story

I was struggling to record videos using Photo Booth, the recording app included with macOS. It didn’t offer the aspect ratios I needed, and saving or locating recordings took more effort than it should have.

A simple recording task was wasting too much time, so I thought:

> What if I made an app that records in different aspect ratios and saves videos directly to Downloads?

That is exactly what Glass Recorder does.

I originally created it for myself—and for anyone else who appreciates this tiny bit of convenience.


[Watch the original demo](https://youtu.be/WTAsm1nJCpY)
