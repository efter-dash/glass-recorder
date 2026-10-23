const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const pkg = require("../package.json");
test("packages only the offline app and declares camera consent", () => {
  assert.deepEqual(pkg.build.files, [
    "dist/**/*",
    "electron/**/*",
    "package.json",
  ]);
  assert.ok(pkg.build.mac.extendInfo.NSCameraUsageDescription);
  assert.ok(pkg.build.mac.extendInfo.NSMicrophoneUsageDescription);
  assert.deepEqual(pkg.build.win.target, ["nsis"]);
});
test("built UI uses local relative assets and restricts connections to same-origin assets", () => {
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.match(html, /src="\.\/assets\//);
  assert.match(html, /connect-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//);
});
