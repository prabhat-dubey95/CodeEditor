const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    getProjects: () => ipcRenderer.invoke("getProjects"),
    readProjectFile: (filePath) => ipcRenderer.invoke("readProjectFile", filePath),
    createProjectFolder: (folderPath) => ipcRenderer.invoke("createProjectFolder", folderPath),
    createProjectFile: (filePath) => ipcRenderer.invoke("createProjectFile", filePath),
    saveFile: (data) =>ipcRenderer.invoke("saveFile", data),
    fileExists: (filePath) =>ipcRenderer.invoke("fileExists", filePath),
    deleteProjectFile: function (filePath) {
       return ipcRenderer.invoke("deleteProjectFile",filePath)
    },
});