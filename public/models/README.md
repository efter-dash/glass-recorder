# Local face detector

`blaze_face_short_range.tflite` is the Google MediaPipe BlazeFace short-range float16 model (version 1), downloaded from:
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

Upstream project: https://github.com/google-ai-edge/mediapipe
The upstream Apache-2.0 license is included as MEDIAPIPE-LICENSE.txt.

Inference takes place in a local browser worker; no camera frames are sent to the model provider. The WASM runtime is copied from the pinned npm installation at build time.
