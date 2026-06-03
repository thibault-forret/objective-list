"use strict";
const electron = require("electron");
const api = {
  listProjects: () => electron.ipcRenderer.invoke("projects:list"),
  createProject: (name) => electron.ipcRenderer.invoke("projects:create", name),
  updateProject: (id, update) => electron.ipcRenderer.invoke("projects:update", id, update),
  deleteProject: (id) => electron.ipcRenderer.invoke("projects:delete", id),
  listObjectives: (projectId) => electron.ipcRenderer.invoke("objectives:list", projectId),
  createObjective: (projectId, title) => electron.ipcRenderer.invoke("objectives:create", projectId, title),
  updateObjective: (id, update) => electron.ipcRenderer.invoke("objectives:update", id, update),
  deleteObjective: (id, projectId) => electron.ipcRenderer.invoke("objectives:delete", id, projectId),
  exportData: () => electron.ipcRenderer.invoke("data:export"),
  importData: (mode) => electron.ipcRenderer.invoke("data:import", mode),
  onDataChanged: (handler) => {
    const listener = (_event, payload) => handler(payload);
    electron.ipcRenderer.on("data:changed", listener);
    return () => electron.ipcRenderer.off("data:changed", listener);
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
