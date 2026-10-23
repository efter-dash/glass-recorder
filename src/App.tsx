import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CircleStop,
  Download,
  Mic,
  MicOff,
  RefreshCw,
  Sparkles,
  Video,
  VideoOff,
} from "lucide-react";
type Ratio = "9:16" | "3:4" | "1:1" | "16:9";
type Status = "idle" | "ready" | "recording" | "preview" | "error";
const sizes: Record<Ratio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "3:4": { width: 1080, height: 1440 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};
const ratioLabels: Record<Ratio, string> = {
  "9:16": "Reels · Shorts",
  "3:4": "Portrait post",
  "1:1": "Square post",
  "16:9": "Landscape",
};
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export default function Home() {
  const [ratio, setRatio] = useState<Ratio>("9:16"),
    [status, setStatus] = useState<Status>("idle"),
    [muted, setMuted] = useState(false),
    [cameraOff, setCameraOff] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [cameraName, setCameraName] = useState("Default camera"),
    [formatError, setFormatError] = useState(""),
    [extension, setExtension] = useState("mp4"),
    [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    chunks = useRef<Blob[]>([]),
    frame = useRef<number | null>(null),
    recordingBlob = useRef<Blob | null>(null);
  const stopStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);
  const startCamera = useCallback(async () => {
    setBusy(true);
    try {
      setError("");
      setFormatError("");
      stopStream();
      let s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user",
        },
        audio: true,
      });
      stream.current = s;
      const devices = await navigator.mediaDevices.enumerateDevices(),
        faceTime = devices.find(
          (d) =>
            d.kind === "videoinput" &&
            d.label.toLowerCase().includes("facetime"),
        );
      if (
        faceTime &&
        s.getVideoTracks()[0]?.getSettings().deviceId !== faceTime.deviceId
      ) {
        s.getTracks().forEach((t) => t.stop());
        s = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: faceTime.deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
      }
      stream.current = s;
      setCameraName(
        s.getVideoTracks()[0]?.label || faceTime?.label || "Default camera",
      );
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setMuted(false);
      setCameraOff(false);
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return "";
      });
      recordingBlob.current = null;
      chunks.current = [];
      setStatus("ready");
    } catch {
      stopStream();
      setError("Allow camera and microphone access, then try again.");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, [stopStream]);
  useEffect(() => () => stopStream(), [stopStream]);
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  const draw = useCallback(() => {
    const c = canvas.current,
      v = video.current;
    if (!c || !v || v.readyState < 2) {
      frame.current = requestAnimationFrame(draw);
      return;
    }
    const { width: w, height: h } = sizes[ratio];
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const x = c.getContext("2d");
    if (!x) return;
    const sr = v.videoWidth / v.videoHeight,
      tr = w / h;
    let sw = v.videoWidth,
      sh = v.videoHeight,
      sx = 0,
      sy = 0;
    if (sr > tr) {
      sw = v.videoHeight * tr;
      sx = (v.videoWidth - sw) / 2;
    } else {
      sh = v.videoWidth / tr;
      sy = (v.videoHeight - sh) / 2;
    }
    x.save();
    x.translate(w, 0);
    x.scale(-1, 1);
    x.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
    x.restore();
    frame.current = requestAnimationFrame(draw);
  }, [ratio]);
  const record = () => {
    if (
      !canvas.current ||
      !stream.current ||
      typeof MediaRecorder === "undefined"
    ) {
      setFormatError(
        "Recording is unavailable. Please restart the app and try again.",
      );
      return;
    }
    const recordingTypes = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1.4D401E,mp4a.40.2",
        "video/mp4;codecs=avc1,mp4a",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ],
      mime = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) {
      setFormatError(
        "No supported recording format is available. Please restart the app and try again.",
      );
      return;
    }
    setFormatError("");
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    setExtension(ext);
    let out: MediaStream | undefined;
    try {
      draw();
      out = canvas.current.captureStream(30);
      if (!muted)
        stream.current
          .getAudioTracks()
          .forEach((t) => out!.addTrack(t.clone()));
      const r = new MediaRecorder(out, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
      });
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      let failed = false;
      r.onstop = () => {
        if (failed) return;
        const blob = new Blob(chunks.current, { type: r.mimeType });
        recordingBlob.current = blob;
        setUrl(URL.createObjectURL(blob));
        out?.getTracks().forEach((t) => t.stop());
        stopStream();
        setStatus("preview");
      };
      r.onerror = () => {
        failed = true;
        if (frame.current) cancelAnimationFrame(frame.current);
        out?.getTracks().forEach((t) => t.stop());
        stopStream();
        setError("Recording failed. Please set up the camera again.");
        setStatus("error");
      };
      recorder.current = r;
      r.start(1000);
      setElapsed(0);
      setStatus("recording");
    } catch {
      out?.getTracks().forEach((t) => t.stop());
      if (frame.current) cancelAnimationFrame(frame.current);
      setFormatError("Could not start recording. Please try again.");
    }
  };
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (frame.current) cancelAnimationFrame(frame.current);
  };
  const save = async () => {
    if (!recordingBlob.current) return;
    setBusy(true);
    setFormatError("");
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      await window.glassRecorder.save(
        await recordingBlob.current.arrayBuffer(),
        `Glass-Recording-${ratio.replace(":", "x")}-${stamp}.${extension}`,
      );
    } catch {
      setFormatError("Could not save the recording. Try another folder.");
    } finally {
      setBusy(false);
    }
  };
  const toggleMic = () => {
      const next = !muted;
      stream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      setMuted(next);
    },
    toggleCamera = () => {
      const next = !cameraOff;
      stream.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
      setCameraOff(next);
    };
  return (
    <main className="app-shell">
      <div className="ambient one" />
      <div className="ambient two" />
      <header className="topbar glass">
        <div className="brand">
          <Sparkles size={18} />
        </div>
        <div>
          <h1>Glass Recorder</h1>
          <p>Private recording, right on your device</p>
        </div>
        <div className="privacy">
          <i /> Stored locally
        </div>
      </header>
      <section className="workspace">
        <div className="stage-wrap">
          <div
            className={`stage ratio-${ratio.replace(":", "-")} ${status === "recording" ? "active" : ""}`}
          >
            <video
              ref={video}
              className="feed"
              playsInline
              muted
              aria-label="Live camera preview"
            />
            {url && status === "preview" && (
              <video
                src={url}
                className="playback"
                playsInline
                controls
                autoPlay
                aria-label="Recorded video preview"
              />
            )}
            {(status === "idle" || status === "error") && (
              <div className="empty">
                <div className="camera-orb">
                  <Camera size={30} />
                </div>
                <h2>
                  {status === "error"
                    ? "Camera unavailable"
                    : "Ready when you are"}
                </h2>
                <p>
                  {error ||
                    "Your video stays on this device until you save it."}
                </p>
                <button
                  className="primary compact"
                  disabled={busy}
                  onClick={startCamera}
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
              <span>Capture settings</span>
              <h2>Frame your video</h2>
            </div>
            <i />
          </div>
          <div className="group">
            <label>Aspect ratio</label>
            <div className="segments" role="radiogroup">
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
            <label>Camera</label>
            <button
              className="device"
              onClick={startCamera}
              disabled={busy || status === "recording" || status === "preview"}
            >
              <span>
                <Camera size={18} />
              </span>
              <div>
                <b>{cameraName}</b>
                <small>Preferred camera · 30 fps</small>
              </div>
              <span>⌄</span>
            </button>
          </div>
          <div className="quick">
            <button onClick={toggleCamera} disabled={status !== "ready"}>
              <i>{cameraOff ? <VideoOff /> : <Video />}</i>
              {cameraOff ? "Camera off" : "Camera on"}
            </button>
            <button onClick={toggleMic} disabled={status !== "ready"}>
              <i>{muted ? <MicOff /> : <Mic />}</i>
              {muted ? "Muted" : "Mic on"}
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
                  onClick={startCamera}
                >
                  <RefreshCw />
                  Record another
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
                onClick={status === "ready" ? record : startCamera}
              >
                <i className="record-dot" />
                {status === "ready" ? "Start recording" : "Set up camera"}
              </button>
            )}
            <p className={formatError ? "format-error" : ""}>
              {formatError ||
                (status === "preview"
                  ? "Your recording is ready to save."
                  : `${sizes[ratio].width} × ${sizes[ratio].height} · MP4 when available, otherwise WebM`)}
            </p>
          </div>
        </aside>
      </section>
      <footer>
        <span>
          <i />
          Nothing is uploaded
        </span>
        <span>Choose where to save your recording</span>
      </footer>
      <canvas ref={canvas} />
    </main>
  );
}
