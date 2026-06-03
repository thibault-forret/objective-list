export type ProjectDTO = {
  id: number
  name: string
  createdAt: number
  objectiveCount: number
  completedCount: number
}

export type ObjectiveDTO = {
  id: number
  projectId: number
  title: string
  done: boolean
  createdAt: number
  updatedAt: number | null
}

export type ObjectiveUpdate = {
  title?: string
  done?: boolean
}

export type ProjectUpdate = {
  name?: string
}

export type ImportMode = 'merge' | 'overwrite'

export type ExportPayload = {
  version: 1
  projects: ProjectDTO[]
  objectives: ObjectiveDTO[]
}

export type DataChange =
  | { type: 'projects' }
  | { type: 'objectives'; projectId: number }

export type ExportResult = {
  canceled: boolean
  path?: string
  error?: string
}

export type ImportResult = {
  canceled: boolean
  projects?: number
  objectives?: number
  error?: string
}

export type Api = {
  listProjects: () => Promise<ProjectDTO[]>
  createProject: (name: string) => Promise<ProjectDTO>
  updateProject: (id: number, update: ProjectUpdate) => Promise<ProjectDTO>
  deleteProject: (id: number) => Promise<void>
  listObjectives: (projectId: number) => Promise<ObjectiveDTO[]>
  createObjective: (projectId: number, title: string) => Promise<ObjectiveDTO>
  updateObjective: (id: number, update: ObjectiveUpdate) => Promise<ObjectiveDTO>
  deleteObjective: (id: number, projectId: number) => Promise<void>
  exportData: () => Promise<ExportResult>
  importData: (mode: ImportMode) => Promise<ImportResult>
  onDataChanged: (handler: (payload: DataChange) => void) => () => void
}
