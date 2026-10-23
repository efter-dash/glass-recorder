const test = require("node:test");
const assert = require("node:assert/strict");
const { selectUpdate } = require("../electron/updates.cjs");
const release = (v, name = "Glass-Recorder-0.3.0-mac-arm64.dmg") => ({
  tag_name: v,
  draft: false,
  assets: [
    {
      name,
      state: "uploaded",
      browser_download_url: `https://github.com/efter-dash/glass-recorder/releases/download/${v}/${name}`,
    },
  ],
});
test("selects a newer matching platform and never downgrades", () => {
  assert.equal(
    selectUpdate([release("v0.3.0")], "0.2.0", "darwin", "arm64").version,
    "v0.3.0",
  );
  assert.equal(
    selectUpdate([release("v0.1.0")], "0.2.0", "darwin", "arm64").url,
    null,
  );
  assert.equal(
    selectUpdate([release("v0.3.0")], "0.2.0", "win32", "x64").url,
    null,
  );
  assert.equal(
    selectUpdate(
      [{ ...release("v0.3.0"), draft: true }],
      "0.2.0",
      "darwin",
      "arm64",
    ).url,
    null,
  );
});
test("rejects off-repository downloads and compares versions numerically", () => {
  const bad = release("v0.3.0");
  bad.assets[0].browser_download_url = "https://evil.example/update";
  assert.equal(selectUpdate([bad], "0.2.0", "darwin", "arm64").url, null);
  assert.equal(
    selectUpdate(
      [release("v0.9.0"), release("v0.10.0")],
      "0.2.0",
      "darwin",
      "arm64",
    ).version,
    "v0.10.0",
  );
});
