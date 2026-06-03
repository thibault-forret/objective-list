import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import {
  createObjective,
  createProject,
  deleteObjective,
  deleteProject,
  exportData,
  importData,
  listObjectives,
  listProjects,
  updateObjective,
  updateProject,
} from './dataService'
import type { DataChange, ImportMode, ObjectiveUpdate, ProjectUpdate } from '../src/shared/ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'app-icon.png')

  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  win = new BrowserWindow({
    title: 'Objective List',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function broadcastChange(payload: DataChange) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('data:changed', payload)
  })
}

ipcMain.handle('ping', () => 'pong')
ipcMain.handle('projects:list', () => listProjects())
ipcMain.handle('projects:create', (_event, name: string) => {
  const project = createProject(name)
  broadcastChange({ type: 'projects' })
  return project
})
ipcMain.handle('projects:update', (_event, id: number, update: ProjectUpdate) => {
  const project = updateProject(id, update)
  broadcastChange({ type: 'projects' })
  return project
})
ipcMain.handle('projects:delete', (_event, id: number) => {
  deleteProject(id)
  broadcastChange({ type: 'projects' })
})

ipcMain.handle('objectives:list', (_event, projectId: number) => listObjectives(projectId))
ipcMain.handle('objectives:create', (_event, projectId: number, title: string) => {
  const objective = createObjective(projectId, title)
  broadcastChange({ type: 'objectives', projectId })
  return objective
})
ipcMain.handle('objectives:update', (_event, id: number, update: ObjectiveUpdate) => {
  const objective = updateObjective(id, update)
  broadcastChange({ type: 'objectives', projectId: objective.projectId })
  return objective
})
ipcMain.handle('objectives:delete', (_event, id: number, projectId: number) => {
  deleteObjective(id)
  broadcastChange({ type: 'objectives', projectId })
})

ipcMain.handle('data:export', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Exporter les objectifs',
    defaultPath: 'objective-list.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  const payload = exportData()
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return { canceled: false, path: result.filePath }
})

ipcMain.handle('data:import', async (_event, mode: ImportMode) => {
  const result = await dialog.showOpenDialog({
    title: 'Importer des objectifs',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
    const payload = JSON.parse(raw)
    const summary = importData(payload, mode)
    broadcastChange({ type: 'projects' })
    return { canceled: false, ...summary }
  } catch (error) {
    return {
      canceled: false,
      error: error instanceof Error ? error.message : 'Échec de l\'importation',
    }
  }
})

app.whenReady().then(createWindow)
