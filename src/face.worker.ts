import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
let detector: FaceDetector | null = null;
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(data.base + "vision");
      detector = await FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: data.base + "models/blaze_face_short_range.tflite",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.55,
      });
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "error" });
    }
    return;
  }
  if (data.type === "frame") {
    const bitmap: ImageBitmap = data.bitmap;
    try {
      const detections = detector!.detectForVideo(bitmap, data.time).detections;
      const boxes = detections.flatMap((d) =>
        d.boundingBox ? [d.boundingBox] : [],
      );
      const box = boxes.sort(
        (a, b) => b.width * b.height - a.width * a.height,
      )[0];
      self.postMessage({
        type: "result",
        face: box
          ? {
              x: (box.originX + box.width / 2) / bitmap.width,
              y: (box.originY + box.height * 0.8) / bitmap.height,
            }
          : null,
      });
    } catch {
      self.postMessage({ type: "error" });
    } finally {
      bitmap.close();
    }
  }
};
