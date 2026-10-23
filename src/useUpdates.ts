import { useEffect, useState } from "react";
declare const __BUILD_ID__: string;
export function useUpdates(blocked: boolean) {
  const [state, setState] = useState<
    "checking" | "current" | "available" | "error"
  >("checking");
  const [version, setVersion] = useState("");
  const check = async () => {
    setState("checking");
    try {
      if (window.glassRecorder?.checkUpdate) {
        const result = await window.glassRecorder.checkUpdate();
        setVersion(result.version);
        setState(result.available ? "available" : "current");
      } else {
        const response = await fetch(
          new URL(`version.json?t=${Date.now()}`, document.baseURI),
          { cache: "no-store", signal: AbortSignal.timeout(12000) },
        );
        if (!response.ok) throw Error("Version unavailable");
        const data = await response.json();
        if (typeof data.buildId !== "string" || !data.buildId)
          throw Error("Invalid version");
        setState(data.buildId !== __BUILD_ID__ ? "available" : "current");
      }
    } catch {
      setState("error");
    }
  };
  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 5 * 60 * 1000);
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const activate = async () => {
    if (blocked) return;
    if (state !== "available") {
      await check();
      return;
    }
    if (window.glassRecorder?.openUpdate) {
      try {
        await window.glassRecorder.openUpdate();
      } catch {
        setState("error");
      }
    } else window.location.reload();
  };
  return {
    activate,
    disabled: blocked || state === "checking",
    label:
      state === "available"
        ? `Update available${version ? ` · ${version}` : ""}`
        : state === "checking"
          ? "Checking updates…"
          : state === "error"
            ? "Retry update check"
            : "Up to date · Check again",
    available: state === "available",
  };
}
