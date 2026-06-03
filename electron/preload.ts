import { ipcRenderer, contextBridge } from 'electron'
import type {
  Api,
  DataChange,
  ImportMode,
  ObjectiveUpdate,
  ProjectUpdate,
} from '../src/shared/ipc'

const api: Api = {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  updateProject: (id: number, update: ProjectUpdate) =>
    ipcRenderer.invoke('projects:update', id, update),
  deleteProject: (id: number) => ipcRenderer.invoke('projects:delete', id),
  listObjectives: (projectId: number) => ipcRenderer.invoke('objectives:list', projectId),
  createObjective: (projectId: number, title: string) =>
    ipcRenderer.invoke('objectives:create', projectId, title),
  updateObjective: (id: number, update: ObjectiveUpdate) =>
    ipcRenderer.invoke('objectives:update', id, update),
  deleteObjective: (id: number, projectId: number) =>
    ipcRenderer.invoke('objectives:delete', id, projectId),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (mode: ImportMode) => ipcRenderer.invoke('data:import', mode),
  onDataChanged: (handler: (payload: DataChange) => void) => {
    const listener = (_event: unknown, payload: DataChange) => handler(payload)
    ipcRenderer.on('data:changed', listener)
    return () => ipcRenderer.off('data:changed', listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
