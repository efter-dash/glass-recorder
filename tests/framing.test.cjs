const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/framing.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context,
);
const { cropFrame } = context.exports;
test("all ratios remain inside source bounds while tracking", () => {
  for (const [w, h] of [
    [1920, 1080],
    [640, 480],
    [720, 1280],
  ])
    for (const ratio of [9 / 16, 3 / 4, 1, 16 / 9])
      for (const x of [0, 0.2, 0.5, 0.8, 1])
        for (const y of [0, 0.5, 1]) {
          const c = cropFrame(w, h, ratio, x, y, true);
          assert.ok(
            c.sx >= 0 &&
              c.sy >= 0 &&
              c.sx + c.sw <= w + 1e-6 &&
              c.sy + c.sh <= h + 1e-6,
          );
          assert.ok(Math.abs(c.sw / c.sh - ratio) < 1e-9);
        }
});
test("following pans and leaves digital zoom headroom", () => {
  const left = cropFrame(1920, 1080, 9 / 16, 0.2, 0.5, true);
  const right = cropFrame(1920, 1080, 9 / 16, 0.8, 0.5, true);
  const normal = cropFrame(1920, 1080, 9 / 16, 0.5, 0.5, false);
  assert.ok(right.sx > left.sx);
  assert.ok(Math.abs(left.sw * 1.2 - normal.sw) < 1e-6);
});
