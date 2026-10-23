const { chromium, expect } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const root = path.resolve("dist");
  const server = http.createServer((req, res) => {
    if (req.url === "/portrait.jpg" && process.env.FACE_FIXTURE) {
      res.setHeader("Content-Type", "image/jpeg");
      fs.createReadStream(process.env.FACE_FIXTURE).pipe(res);
      return;
    }
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
      ".wasm": "application/wasm",
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
      "--use-fake-device-for-media-stream=device-count=2",
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
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Dark", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "System", exact: true }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Turn on camera" }).click();
    await page.getByText("Camera ready", { exact: true }).waitFor();
    const options = await page
      .locator("#camera-select option")
      .evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    if (options.length < 2) throw Error("Expected two simulated cameras");
    await page.locator("#camera-select").selectOption(options[1]);
    await page.getByText("Camera ready", { exact: true }).waitFor();
    await expect
      .poll(() =>
        page
          .locator(".source-video")
          .evaluate(
            (v) => v.srcObject.getVideoTracks()[0].getSettings().deviceId,
          ),
      )
      .toBe(options[1]);
    await page.getByRole("switch").check();
    await page
      .getByText("Looking for a face", { exact: true })
      .waitFor({ timeout: 60000 });
    await page.getByRole("switch").uncheck();
    console.log(
      "Themes, camera switching, and real face model initialization passed",
    );
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
    await page.getByRole("button", { name: "Photo", exact: true }).click();
    await page.getByText("Camera ready", { exact: true }).waitFor();
    if (
      await page
        .locator(".source-video")
        .evaluate((v) => v.srcObject.getAudioTracks().length)
    )
      throw Error("Photo requested audio");
    for (const ratio of ["9:16", "3:4", "1:1", "16:9"]) {
      await page.getByRole("radio", { name: new RegExp(ratio) }).click();
      await page.waitForTimeout(150);
      await page
        .getByRole("button", { name: "Take photo", exact: true })
        .click();
      await page.getByRole("button", { name: "Save PNG" }).waitFor();
      await expect(page.getByAltText("Captured photo preview")).toBeVisible();
      await expect
        .poll(() =>
          page
            .getByAltText("Captured photo preview")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);

      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Save PNG" }).click();
      const download = await pending;
      const data = fs.readFileSync(await download.path());
      const w = data.readUInt32BE(16),
        h = data.readUInt32BE(20);
      const [rw, rh] = ratio.split(":").map(Number);
      if (Math.abs(w / h - rw / rh) > 0.01)
        throw Error("Incorrect photo ratio");
      console.log("PNG", ratio, w, h, data.length);
      await page.getByRole("button", { name: "Take another" }).click();
      await page.getByText("Camera ready", { exact: true }).waitFor();
    }
    if (process.env.SCREENSHOT_DIR) {
      for (const theme of ["light", "dark"]) {
        await page
          .getByRole("button", {
            name: theme === "dark" ? "Dark" : "Light",
            exact: true,
          })
          .click();
        await page.screenshot({
          path: path.join(process.env.SCREENSHOT_DIR, theme + ".png"),
          fullPage: true,
        });
      }
    }
    if (process.env.FACE_FIXTURE) {
      const workerFile = fs
        .readdirSync(path.join(root, "assets"))
        .find((f) => f.startsWith("face.worker-"));
      const positions = await page.evaluate(async (workerFile) => {
        const img = new Image();
        img.src = "/portrait.jpg";
        await img.decode();
        const worker = new Worker("assets/" + workerFile);
        const receive = () =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("Worker timeout")),
              30000,
            );
            worker.onmessage = ({ data }) => {
              clearTimeout(timer);
              data.type === "error"
                ? reject(Error("Detection failed"))
                : resolve(data);
            };
          });
        let result = receive();
        worker.postMessage({
          type: "init",
          base: new URL(".", location.href).href,
        });
        await result;
        const c = document.createElement("canvas");
        c.width = 960;
        c.height = 640;
        const ctx = c.getContext("2d");
        const xs = [];
        for (const x of [20, 580]) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 960, 640);
          ctx.drawImage(img, x, 0, 360, 640);
          const bitmap = await createImageBitmap(c);
          result = receive();
          worker.postMessage(
            { type: "frame", bitmap, time: performance.now() },
            [bitmap],
          );
          const data = await result;
          if (!data.face) throw Error("No face detected");
          xs.push(data.face.x);
        }
        worker.terminate();
        return xs;
      }, workerFile);
      if (positions[1] - positions[0] < 0.4)
        throw Error("Face movement not detected");
      console.log("Real portrait moving left to right detected:", positions);
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
