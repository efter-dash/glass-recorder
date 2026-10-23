const { chromium, expect } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const root = path.resolve("dist");
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    ).replace(/^\/glass-recorder\//, "");
    const file = path.resolve(root, relative || "index.html");
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
    };
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const context = await browser.newContext({
      permissions: ["camera", "microphone"],
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:${server.address().port}/glass-recorder/`,
    );
    await expect(page.locator(".brand img")).toBeVisible();
    await page.getByRole("button", { name: "Turn on camera" }).click();
    await page.getByText("Camera ready", { exact: true }).waitFor();
    for (const ratio of ["9:16", "3:4", "1:1", "16:9"]) {
      await page.getByRole("radio", { name: new RegExp(ratio) }).click();
      await page.getByRole("button", { name: "Start recording" }).click();
      await page.waitForTimeout(1800);
      await page.getByRole("button", { name: "Stop recording" }).click();
      await page.getByRole("button", { name: /^Save / }).waitFor();
      await expect
        .poll(() => page.locator(".playback").evaluate((v) => v.videoWidth))
        .toBeGreaterThan(0);
      const dimensions = await page
        .locator(".playback")
        .evaluate((v) => [v.videoWidth, v.videoHeight]);
      const [w, h] = ratio.split(":").map(Number);
      if (Math.abs(dimensions[0] / dimensions[1] - w / h) > 0.01)
        throw Error("Incorrect crop");
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: /^Save / }).click();
      const download = await pending;
      const saved = await download.path();
      if (fs.statSync(saved).size < 1000) throw Error("Empty recording");
      console.log(
        ratio,
        dimensions,
        download.suggestedFilename(),
        fs.statSync(saved).size,
      );
      await page.getByRole("button", { name: "Record another" }).click();
      await page.getByText("Camera ready", { exact: true }).waitFor();
    }
    if (errors.length) throw Error(errors.join("\n"));
    console.log("Browser recording and download tests passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
