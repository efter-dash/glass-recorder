# Glass Recorder

<p align="center"><img src="public/app-icon.png" alt="Glowing Glass Recorder camera" width="128" /></p>

## Open the recorder — no installation

### [Launch Glass Recorder](https://efter-dash.github.io/glass-recorder/)

A free-to-access browser camera recorder with a glowing cyan identity and light/dark glass interface. Open the website, grant camera and microphone permission, record, and download your video. No app installer, Apple Developer account, or GitHub sign-in is needed to use it.

**Hosted interface, local recording:** GitHub Pages serves the website files. Camera, microphone, cropping, and encoding run in your browser. Recordings are not uploaded to GitHub or any application server. The app contains no analytics or recording upload endpoint. Hosting providers still receive ordinary requests for the website itself.

## How to use

1. Open the link in a current desktop browser.
2. Select an aspect ratio, then choose **Turn on camera**.
3. Allow camera and microphone permissions. You can mute the microphone before recording.
4. Choose **Start recording**, then **Stop recording**.
5. Preview and choose **Save MP4** or **Save WEBM**, depending on browser support.

Your browser controls the download location and whether it asks where to save. Keep the tab open and visible while recording. Save before closing, refreshing, or choosing **Record another**: recordings remain in memory and are not recovered later. Long recordings may use substantial memory. This version needs an internet connection to load; offline installation is not implemented.

| Aspect ratio | Output dimensions |
|---|---|
| 9:16 | 1080 × 1920 |
| 3:4 | 1080 × 1440 |
| 1:1 | 1080 × 1080 |
| 16:9 | 1920 × 1080 |

The recorder center-crops and mirrors the output to match the preview. It prefers a FaceTime camera if available, otherwise the system default. Camera and microphone tracks are stopped when recording finishes.

## Browser compatibility

The website requires HTTPS, camera/microphone access, canvas capture, and MediaRecorder support. It checks recording formats at runtime and prefers MP4, with WebM fallback. Format and encoding support vary by browser and device; an MP4-only guarantee is not made. If access fails, check browser site permissions and close other apps using the camera.

Automated Chromium tests exercise all four ratios, playback, browser downloads, and repeated recording with simulated camera/microphone inputs. Physical-device testing in Safari, Chrome, and Edge is still recommended; those browsers have not all been verified independently. Mobile recording is not yet verified.

## Desktop previews

The earlier Windows/macOS packaging remains in the source for development. **Do not use the earlier Mac preview as a normal installer:** its signature failed verification and it has not been Developer ID signed or notarized. The browser app above is the recommended distribution. The v0.1.1 desktop release remains unpublished while the project moves to browser use.

## Development

Built with React, TypeScript, Vite, and browser media APIs, with assistance from Codex.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
node tests/browser-smoke.cjs
npx vite preview --host 127.0.0.1
```

Vite emits static files into `dist/` with relative asset paths. Serve over HTTPS in production (localhost is suitable for local testing). The browser downloads Blob recordings directly; the optional Electron bridge is used only when running the legacy desktop build. A content security policy blocks network connections from application scripts.

## Deployment

`.github/workflows/pages.yml` builds, tests browser recording/downloads, and deploys `dist/` to GitHub Pages after pushes to `main`. Hosting uses GitHub Actions with the `github-pages` environment. Only static assets are deployed: no backend, credentials, or user recordings.

## The Story

I was struggling to record videos using Photo Booth, the recording app included with macOS. It didn’t offer the aspect ratios I needed, and saving or locating recordings took more effort than it should have.

A simple recording task was wasting too much time, so I thought:

> What if I made an app that records in different aspect ratios and saves videos directly to Downloads?

Glass Recorder grew from that idea into an offline desktop app with a save dialog that starts in Downloads.

I originally created it for myself—and for anyone else who appreciates this tiny bit of convenience.


[Watch the original demo](https://youtu.be/WTAsm1nJCpY)
