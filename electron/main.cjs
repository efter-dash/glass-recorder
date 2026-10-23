const { app, BrowserWindow, session, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const entry = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
let window;
function openWindow() {
  window = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 700,
    minHeight: 650,
    title: "Glass Recorder",
    icon: path.join(__dirname, "../dist/app-icon.png"),
    backgroundColor: "#17202a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("close", (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: "question",
      buttons: ["Keep open", "Quit"],
      defaultId: 0,
      cancelId: 0,
      message: "Quit Glass Recorder?",
      detail: "Any recording you have not saved will be lost.",
    });
    if (choice === 0) event.preventDefault();
  });
  window.loadURL(entry);
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      callback(
        contents === window?.webContents &&
          contents.getURL() === entry &&
          permission === "media" &&
          (details.mediaTypes || []).every((type) =>
            ["audio", "video"].includes(type),
          ),
      );
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission) =>
      contents === window?.webContents &&
      contents.getURL() === entry &&
      permission === "media",
  );
  ipcMain.handle("save-recording", async (event, data, name) => {
    if (
      event.sender !== window?.webContents ||
      event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url !== entry
    )
      throw new Error("Untrusted sender");
    if (
      !(data instanceof ArrayBuffer) ||
      data.byteLength === 0 ||
      !/^Glass-Recording-[a-zA-Z0-9-]+\.(mp4|webm)$/.test(name)
    )
      throw new Error("Invalid recording");
    const extension = name.endsWith(".mp4") ? "mp4" : "webm";
    const result = await dialog.showSaveDialog(window, {
      title: "Save recording",
      defaultPath: path.join(app.getPath("downloads"), name),
      filters: [
        { name: extension.toUpperCase() + " video", extensions: [extension] },
      ],
    });
    if (result.canceled || !result.filePath) return false;
    await require("node:fs/promises").writeFile(
      result.filePath,
      Buffer.from(data),
    );
    return true;
  });
  openWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});
app.on("window-all-closed", () => app.quit());
