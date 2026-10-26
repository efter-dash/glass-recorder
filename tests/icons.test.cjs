const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const dimensions = (p) => {
  const b = fs.readFileSync(p);
  assert.equal(b.toString("ascii", 1, 4), "PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
test("lens artwork has all UI and native icon sizes", () => {
  for (const [p, n] of [
    ["build/icon-source.png", 1254],
    ["build/icon.png", 1024],
    ["public/app-icon.png", 256],
    ["public/app-icon-512.png", 512],
    ["public/apple-touch-icon.png", 180],
  ])
    assert.deepEqual(dimensions(p), [n, n]);
  const ico = fs.readFileSync("build/icon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 6);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => ico[6 + i * 16] || 256),
    [16, 32, 48, 64, 128, 256],
  );
  assert.deepEqual(ico, fs.readFileSync("public/favicon.ico"));
  const icns = fs.readFileSync("build/icon.icns");
  assert.equal(icns.toString("ascii", 0, 4), "icns");
  assert.equal(icns.readUInt32BE(4), icns.length);
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /favicon.ico\?v=0.2.1/);
});
