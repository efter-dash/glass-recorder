const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("glassRecorder", {
  save: (data, name) => ipcRenderer.invoke("save-recording", data, name),
});
