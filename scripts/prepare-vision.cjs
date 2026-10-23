const fs = require("node:fs");
fs.mkdirSync("public/vision", { recursive: true });
fs.cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/vision", {
  recursive: true,
});
