const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("glassRecorder", {
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  openUpdate: () => ipcRenderer.invoke("open-update"),
  save: (data, name) => ipcRenderer.invoke("save-recording", data, name),
});
