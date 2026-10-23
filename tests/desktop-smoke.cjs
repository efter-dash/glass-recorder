// Run locally with `node tests/desktop-smoke.cjs` after npm run build.
// Fake devices verify recording without accessing a real camera or microphone.
const { _electron: electron } = require("@playwright/test");
const assert = require("node:assert/strict");
(async () => {
  const app = await electron.launch({
    executablePath: process.env.GLASS_EXECUTABLE,
    args: [
      ...(process.env.GLASS_EXECUTABLE ? [] : ["."]),
      `--user-data-dir=${require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "glass-test-"))}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    require("node:fs").mkdirSync("release", { recursive: true });
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("console", (message) => console.log("renderer:", message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.locator(".brand img").waitFor();
    assert.equal(
      await page
        .locator(".brand img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    );
    await page.emulateMedia({ colorScheme: "light" });
    await page.screenshot({ path: "release/icon-ui-preview.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "release/icon-ui-dark.png" });
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("button", { name: "Turn on camera" }).click();
    await page.getByText("Camera ready", { exact: true }).waitFor();
    await page.getByRole("switch").check();
    await page
      .getByText("Looking for a face", { exact: true })
      .waitFor({ timeout: 60000 });
    await page.getByRole("switch").uncheck();
    await page.waitForTimeout(500);
    for (const ratio of ["9:16", "3:4", "1:1", "16:9"]) {
      await page.getByRole("radio", { name: new RegExp(ratio) }).click();
      await page.getByRole("button", { name: "Start recording" }).click();
      await page.waitForTimeout(1400);
      await page.getByRole("button", { name: "Stop recording" }).click();
      await page.getByRole("button", { name: /^Save / }).waitFor();
      await require("@playwright/test")
        .expect.poll(
          () => page.locator(".playback").evaluate((v) => v.videoWidth),
          { timeout: 15000 },
        )
        .toBeGreaterThan(0);
      const result = await page.locator(".playback").evaluate(async (v) => {
        await new Promise((resolve, reject) => {
          if (v.readyState >= 1) return resolve();
          if (v.error) return reject(new Error(v.error.message));
          setTimeout(
            () =>
              reject(
                new Error(
                  "Playback metadata timed out: " +
                    (v.error?.message || v.readyState),
                ),
              ),
            15000,
          );
          v.onloadedmetadata = resolve;
          v.onerror = reject;
        });
        return {
          width: v.videoWidth,
          height: v.videoHeight,
          duration: v.duration,
        };
      });
      console.log("Recorded metadata", ratio, result);
      const [w, h] = ratio.split(":").map(Number);
      assert.ok(Math.abs(result.width / result.height - w / h) < 0.01);
      assert.ok(result.duration > 0);
      console.log(
        ratio,
        result,
        await page.getByRole("button", { name: /^Save / }).innerText(),
      );
      assert.equal(
        await page
          .locator(".source-video")
          .evaluate((v) =>
            v.srcObject.getTracks().every((t) => t.readyState === "ended"),
          ),
        true,
      );
      const extension = (
        await page.getByRole("button", { name: /^Save / }).innerText()
      ).includes("MP4")
        ? "mp4"
        : "webm";
      const target = require("node:path").resolve(
        `release/smoke-${ratio.replace(":", "x")}.${extension}`,
      );
      await app.evaluate(({ dialog }, target) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: target,
        });
      }, target);
      await page.getByRole("button", { name: /^Save / }).click();
      await require("@playwright/test")
        .expect(page.getByRole("button", { name: /^Save / }))
        .toBeEnabled();
      assert.ok(require("node:fs").statSync(target).size > 1000);
      await page.getByRole("button", { name: "Record another" }).click();
      await page.getByText("Camera ready", { exact: true }).waitFor();
    }
    await page.screenshot({ path: "release/smoke-preview.png" });
    assert.deepEqual(errors, []);
    console.log("Desktop recording smoke test passed");
  } finally {
    await app
      .evaluate(({ BrowserWindow }) => {
        for (const window of BrowserWindow.getAllWindows()) window.destroy();
      })
      .catch(() => {});
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
