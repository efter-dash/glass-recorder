import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CircleStop,
  Download,
  Mic,
  MicOff,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react";
import { cropFrame } from "./framing";
type Ratio = "9:16" | "3:4" | "1:1" | "16:9";
type Status = "idle" | "ready" | "recording" | "preview" | "error";
type Mode = "video" | "photo";
type Theme = "system" | "light" | "dark";
const sizes: Record<Ratio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "3:4": { width: 1080, height: 1440 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};
const ratioLabels: Record<Ratio, string> = {
  "9:16": "Reels · Shorts",
  "3:4": "Portrait",
  "1:1": "Square",
  "16:9": "Landscape",
};
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export default function Home() {
  const [ratio, setRatio] = useState<Ratio>("9:16"),
    [status, setStatus] = useState<Status>("idle"),
    [mode, setMode] = useState<Mode>("video");
  const [muted, setMuted] = useState(false),
    [cameraOff, setCameraOff] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [formatError, setFormatError] = useState(""),
    [extension, setExtension] = useState("mp4"),
    [busy, setBusy] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]),
    [selectedCamera, setSelectedCamera] = useState("");
  const [follow, setFollow] = useState(false),
    [tracking, setTracking] = useState("Off");
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem("glass-theme");
      return t === "dark" || t === "light" ? t : "system";
    } catch {
      return "system";
    }
  });
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recordingBlob = useRef<Blob | null>(null),
    urlRef = useRef("");
  const worker = useRef<Worker | null>(null),
    workerReady = useRef(false),
    pendingFrame = useRef(false),
    lastDetect = useRef(0),
    target = useRef({ x: 0.5, y: 0.5, time: 0 }),
    center = useRef({ x: 0.5, y: 0.5 });
  const active = status === "ready" || status === "recording";
  const replaceUrl = useCallback((next: string) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
  }, []);
  const stopStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  const refreshCameras = useCallback(async () => {
    try {
      setCameras(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
    } catch {}
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    try {
      localStorage.setItem("glass-theme", theme);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    void refreshCameras();
    navigator.mediaDevices?.addEventListener("devicechange", refreshCameras);
    return () => {
      navigator.mediaDevices?.removeEventListener(
        "devicechange",
        refreshCameras,
      );
      stopStream();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [refreshCameras, stopStream]);
  useEffect(() => {
    if (status !== "recording" && status !== "preview") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  const startCamera = async (device = selectedCamera, nextMode = mode) => {
    setBusy(true);
    stopStream();
    setStatus("idle");
    setError("");
    setFormatError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw Error("Open the HTTPS website in a supported browser.");
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(device
            ? { deviceId: { exact: device } }
            : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: nextMode === "video",
      });
      stream.current = s;
      setSelectedCamera(s.getVideoTracks()[0].getSettings().deviceId || device);
      s.getVideoTracks()[0].onended = () => {
        if (recorder.current?.state === "recording") recorder.current.stop();
        else {
          stopStream();
          setError(
            "Camera disconnected. Select an available camera and try again.",
          );
          setStatus("error");
        }
        void refreshCameras();
      };
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      await refreshCameras();
      setMuted(false);
      setCameraOff(false);
      replaceUrl("");
      recordingBlob.current = null;
      center.current = { x: 0.5, y: 0.5 };
      target.current = { x: 0.5, y: 0.5, time: 0 };
      setStatus("ready");
    } catch (e) {
      stopStream();
      setError(
        e instanceof DOMException
          ? e.name === "OverconstrainedError"
            ? "This camera is unavailable. Choose another camera."
            : e.name === "NotFoundError"
              ? "No camera or microphone found. Photo mode only needs a camera."
              : "Allow camera access (and microphone for video), or close other apps using the camera."
          : String(e),
      );
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    workerReady.current = false;
    pendingFrame.current = false;
    target.current = { x: 0.5, y: 0.5, time: 0 };
    if (!follow || !active || cameraOff) {
      setTracking(follow ? "Waiting for camera" : "Off");
      return;
    }
    if (!window.Worker || !window.createImageBitmap) {
      setTracking("Unavailable in this browser");
      return;
    }
    setTracking("Loading local model…");
    const w = new Worker(new URL("./face.worker.ts", import.meta.url));
    worker.current = w;
    const fail = () => {
      workerReady.current = false;
      pendingFrame.current = false;
      target.current = { x: 0.5, y: 0.5, time: 0 };
      setTracking("Unavailable — turn off and retry");
      w.terminate();
    };
    const timeout = setTimeout(fail, 30000);
    w.onerror = fail;
    w.onmessage = ({ data }) => {
      if (data.type === "ready") {
        clearTimeout(timeout);
        workerReady.current = true;
        setTracking("Looking for a face");
      } else if (data.type === "result") {
        pendingFrame.current = false;
        if (data.face) {
          target.current = { ...data.face, time: performance.now() };
          setTracking("Following face");
        } else setTracking("Looking for a face");
      } else if (data.type === "error") {
        clearTimeout(timeout);
        fail();
      }
    };
    w.postMessage({ type: "init", base: new URL(".", document.baseURI).href });
    return () => {
      clearTimeout(timeout);
      workerReady.current = false;
      worker.current = null;
      w.terminate();
    };
  }, [follow, active, cameraOff]);
  useEffect(() => {
    if (!active) return;
    let id = 0,
      cancelled = false,
      last = performance.now();
    const paint = (now: number) => {
      if (cancelled) return;
      const v = video.current,
        c = canvas.current;
      if (v && c && v.readyState >= 2 && v.videoWidth) {
        const { width, height } = sizes[ratio];
        if (c.width !== width) c.width = width;
        if (c.height !== height) c.height = height;
        const tracked = follow && workerReady.current && !cameraOff;
        const goal =
          tracked && now - target.current.time < 1200
            ? target.current
            : { x: 0.5, y: 0.5 };
        const easing = 1 - Math.exp(-Math.min(now - last, 100) / 250);
        center.current.x += (goal.x - center.current.x) * easing;
        center.current.y += (goal.y - center.current.y) * easing;
        const { sx, sy, sw, sh } = cropFrame(
          v.videoWidth,
          v.videoHeight,
          width / height,
          center.current.x,
          center.current.y,
          tracked,
        );
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.setTransform(-1, 0, 0, 1, width, 0);
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, width, height);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (
          tracked &&
          !pendingFrame.current &&
          now - lastDetect.current > 125
        ) {
          pendingFrame.current = true;
          lastDetect.current = now;
          const w = worker.current;
          createImageBitmap(v, {
            resizeWidth: 640,
            resizeHeight: Math.round((v.videoHeight / v.videoWidth) * 640),
          })
            .then((bitmap) => {
              if (cancelled || !workerReady.current || worker.current !== w) {
                bitmap.close();
                pendingFrame.current = false;
                return;
              }
              w!.postMessage({ type: "frame", bitmap, time: now }, [bitmap]);
            })
            .catch(() => {
              pendingFrame.current = false;
              workerReady.current = false;
              setTracking("Unavailable — turn off and retry");
            });
        }
      }
      last = now;
      id = requestAnimationFrame(paint);
    };
    id = requestAnimationFrame(paint);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [active, ratio, follow, cameraOff]);
  const record = () => {
    if (!canvas.current || !stream.current) return;
    if (typeof MediaRecorder === "undefined") {
      setFormatError(
        "Video recording is unavailable in this browser. You can still take photos.",
      );
      return;
    }
    const mime = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) {
      setFormatError("No supported video recording format. Try photo mode.");
      return;
    }
    let out: MediaStream | undefined;
    try {
      out = canvas.current.captureStream(30);
      if (!muted)
        stream.current
          .getAudioTracks()
          .forEach((t) => out!.addTrack(t.clone()));
      const r = new MediaRecorder(out, {
        mimeType: mime,
        videoBitsPerSecond: 8000000,
      });
      const chunks: Blob[] = [];
      let failed = false;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        out?.getTracks().forEach((t) => t.stop());
        stopStream();
        if (failed) return;
        const blob = new Blob(chunks, { type: r.mimeType });
        recordingBlob.current = blob;
        replaceUrl(URL.createObjectURL(blob));
        setStatus("preview");
      };
      r.onerror = () => {
        failed = true;
        out?.getTracks().forEach((t) => t.stop());
        stopStream();
        setError("Recording failed. Please reconnect the camera.");
        setStatus("error");
      };
      recorder.current = r;
      r.start(1000);
      setExtension(mime.startsWith("video/mp4") ? "mp4" : "webm");
      setElapsed(0);
      setFormatError("");
      setStatus("recording");
    } catch {
      out?.getTracks().forEach((t) => t.stop());
      setFormatError("Could not start recording. Please try again.");
    }
  };
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };
  const takePhoto = () => {
    if (!canvas.current || status !== "ready") return;
    setBusy(true);
    canvas.current.toBlob((blob) => {
      setBusy(false);
      if (!blob) {
        setFormatError("Could not capture photo. Try again.");
        return;
      }
      recordingBlob.current = blob;
      setExtension("png");
      replaceUrl(URL.createObjectURL(blob));
      stopStream();
      setStatus("preview");
    }, "image/png");
  };
  const save = async () => {
    if (!recordingBlob.current) return;
    setBusy(true);
    setFormatError("");
    try {
      const name = `Glass-${extension === "png" ? "Photo" : "Recording"}-${ratio.replace(":", "x")}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${extension}`;
      if (window.glassRecorder && extension !== "png")
        await window.glassRecorder.save(
          await recordingBlob.current.arrayBuffer(),
          name,
        );
      else {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      setFormatError("Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const toggleMic = () => {
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };
  const toggleCamera = () => {
    stream.current?.getVideoTracks().forEach((t) => (t.enabled = cameraOff));
    setCameraOff(!cameraOff);
  };
  const changeMode = (next: Mode) => {
    setMode(next);
    if (status === "ready") void startCamera(selectedCamera, next);
  };
  return (
    <main className="app-shell">
      <div className="ambient one" />
      <div className="ambient two" />
      <header className="topbar glass">
        <div className="brand">
          <img src="./app-icon.png" alt="" className="app-icon" />
        </div>
        <div>
          <h1>Glass Recorder</h1>
          <p>A little space to capture your best.</p>
        </div>
        <div className="theme-control" role="group" aria-label="Appearance">
          {(["light", "dark", "system"] as Theme[]).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => setTheme(choice)}
            >
              {choice === "light"
                ? "Light"
                : choice === "dark"
                  ? "Dark"
                  : "System"}
            </button>
          ))}
        </div>
        <div className="privacy">
          <i /> Private by design
        </div>
      </header>
      <section className="workspace">
        <div className="stage-wrap">
          <div
            className={`stage ratio-${ratio.replace(":", "-")} ${status === "recording" ? "active" : ""}`}
          >
            <video
              ref={video}
              className="source-video"
              playsInline
              muted
              aria-label="Live camera preview"
            />
            <canvas
              ref={canvas}
              className="capture-canvas"
              aria-label="Framed camera preview"
            />
            {url && status === "preview" && extension !== "png" && (
              <video
                src={url}
                className="playback"
                playsInline
                controls
                autoPlay
                aria-label="Recorded video preview"
              />
            )}
            {url && status === "preview" && extension === "png" && (
              <img
                src={url}
                className="playback"
                alt="Captured photo preview"
              />
            )}
            {(status === "idle" || status === "error") && (
              <div className="empty">
                <div className="camera-orb">
                  <img src="./app-icon.png" alt="" className="app-icon" />
                </div>
                <h2>
                  {status === "error"
                    ? "Camera unavailable"
                    : "Ready when you are"}
                </h2>
                <p>
                  {error ||
                    "Record here. Save to your device. Nothing is uploaded."}
                </p>
                <button
                  className="primary compact"
                  disabled={busy}
                  onClick={() => void startCamera()}
                >
                  <Video size={17} />
                  {status === "error" ? "Try again" : "Turn on camera"}
                </button>
              </div>
            )}
            {status === "recording" && (
              <div className="badge rec">
                <i />
                REC&nbsp;&nbsp; {clock(elapsed)}
              </div>
            )}
            {status === "ready" && (
              <div className="badge">
                <Check size={13} />
                Camera ready
              </div>
            )}
            <div className="corners">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <aside className="panel glass">
          <div className="heading">
            <div>
              <span>Your setup</span>
              <h2>Make it yours.</h2>
            </div>
            <span
              className={`setup-status ${status === "recording" ? "live" : ""}`}
            >
              {status === "recording"
                ? "Recording"
                : status === "ready"
                  ? "Ready"
                  : status === "preview"
                    ? "Captured"
                    : "Standby"}
            </span>
          </div>
          <div className="capture-mode" role="group" aria-label="Capture mode">
            <button
              aria-pressed={mode === "video"}
              disabled={busy || status === "recording" || status === "preview"}
              onClick={() => changeMode("video")}
            >
              <Video size={16} />
              Video
            </button>
            <button
              aria-pressed={mode === "photo"}
              disabled={busy || status === "recording" || status === "preview"}
              onClick={() => changeMode("photo")}
            >
              <Camera size={16} />
              Photo
            </button>
          </div>
          <div className="group">
            <label>Aspect ratio</label>
            <div
              className="segments"
              role="radiogroup"
              aria-label="Aspect ratio"
            >
              {(["9:16", "3:4", "1:1", "16:9"] as Ratio[]).map((r) => (
                <button
                  key={r}
                  role="radio"
                  aria-checked={ratio === r}
                  className={ratio === r ? "selected" : ""}
                  onClick={() => status !== "recording" && setRatio(r)}
                  disabled={
                    busy || status === "recording" || status === "preview"
                  }
                >
                  <i className={`ratio-icon r-${r.replace(":", "-")}`} />
                  <span>
                    <b>{r}</b>
                    <small>{ratioLabels[r]}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <label htmlFor="camera-select">Camera</label>
            <select
              id="camera-select"
              className="camera-select"
              value={selectedCamera}
              disabled={busy || status === "recording" || status === "preview"}
              onChange={(e) => {
                setSelectedCamera(e.target.value);
                if (status === "ready") void startCamera(e.target.value);
              }}
            >
              <option value="">System default</option>
              {selectedCamera &&
                !cameras.some((c) => c.deviceId === selectedCamera) && (
                  <option value={selectedCamera}>Camera unavailable</option>
                )}
              {cameras
                .filter((c) => c.deviceId)
                .map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `Camera ${i + 1}`}
                  </option>
                ))}
            </select>
            <p className="control-note">
              Allow camera access to see device names.
            </p>
          </div>
          <div className="group follow-control">
            <label className="switch-label">
              <span>Follow my face</span>
              <input
                type="checkbox"
                role="switch"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                disabled={status === "preview" || busy}
              />
            </label>
            <p className="control-note" role="status">
              {follow ? tracking : "On-device auto-framing · no uploads"}
            </p>
            {follow && (
              <p className="control-note">
                1.2× digital crop · follows the largest face. Turn off Apple
                Center Stage to avoid double tracking.
              </p>
            )}
          </div>
          <div className="quick">
            <button
              onClick={toggleCamera}
              aria-pressed={!cameraOff}
              disabled={status !== "ready"}
            >
              <i>{cameraOff ? <VideoOff /> : <Video />}</i>
              {cameraOff ? "Camera off" : "Camera on"}
            </button>
            <button
              onClick={toggleMic}
              aria-pressed={!muted && mode === "video"}
              disabled={status !== "ready" || mode === "photo"}
            >
              <i>{muted ? <MicOff /> : <Mic />}</i>
              {mode === "photo" ? "No audio" : muted ? "Muted" : "Mic on"}
            </button>
          </div>
          <div className="actions">
            {status === "preview" ? (
              <>
                <button className="primary" disabled={busy} onClick={save}>
                  <Download />
                  Save {extension.toUpperCase()}…
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void startCamera()}
                >
                  <RefreshCw />
                  {mode === "photo" ? "Take another" : "Record another"}
                </button>
              </>
            ) : status === "recording" ? (
              <button className="stop" onClick={stop}>
                <CircleStop fill="currentColor" />
                Stop recording
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || cameraOff}
                onClick={() =>
                  status === "ready"
                    ? mode === "photo"
                      ? takePhoto()
                      : record()
                    : void startCamera()
                }
              >
                <i className="record-dot" />
                {status === "ready"
                  ? mode === "photo"
                    ? "Take photo"
                    : "Start recording"
                  : "Set up camera"}
              </button>
            )}
            <p className={formatError ? "format-error" : ""}>
              {formatError ||
                (status === "preview"
                  ? "Your capture is ready to save."
                  : `${sizes[ratio].width} × ${sizes[ratio].height} · ${mode === "photo" ? "PNG photo" : "MP4 or WebM video"}`)}
            </p>
          </div>
        </aside>
      </section>
      <footer>
        <span>
          <i />
          Nothing is uploaded
        </span>
        <span>Keep this tab open while recording · Save before leaving</span>
      </footer>
    </main>
  );
}
