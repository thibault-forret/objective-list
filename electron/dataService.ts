import { getDb } from './database'
import type {
  ExportPayload,
  ImportMode,
  ObjectiveDTO,
  ObjectiveUpdate,
  ProjectUpdate,
  ProjectDTO,
} from '../src/shared/ipc'

type ProjectRow = {
  id: number
  name: string
  created_at: number
  objective_count?: number
  completed_count?: number
}

type ObjectiveRow = {
  id: number
  project_id: number
  title: string
  done: number
  created_at: number
  updated_at: number | null
}

const exportVersion = 1 as const

export function listProjects(): ProjectDTO[] {
  const db = getDb()
  const rows = db
    .prepare(
      `
      SELECT projects.id, projects.name, projects.created_at,
        COUNT(objectives.id) AS objective_count,
        SUM(CASE WHEN objectives.done = 1 THEN 1 ELSE 0 END) AS completed_count
      FROM projects
      LEFT JOIN objectives ON objectives.project_id = projects.id
      GROUP BY projects.id
      ORDER BY projects.created_at ASC
      `
    )
    .all() as ProjectRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    objectiveCount: row.objective_count ?? 0,
    completedCount: row.completed_count ?? 0,
  }))
}

export function createProject(name: string): ProjectDTO {
  const db = getDb()
  const createdAt = Date.now()
  const result = db
    .prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)')
    .run(name.trim(), createdAt)

  return {
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    createdAt,
    objectiveCount: 0,
    completedCount: 0,
  }
}

export function deleteProject(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function updateProject(id: number, update: ProjectUpdate): ProjectDTO {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, name, created_at FROM projects WHERE id = ?')
    .get(id) as ProjectRow | undefined

  if (!existing) {
    throw new Error('Projet non trouvé')
  }

  const name = update.name !== undefined ? update.name.trim() : existing.name

  db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id)

  return {
    id: existing.id,
    name,
    createdAt: existing.created_at,
    objectiveCount: getObjectiveCount(db, existing.id),
    completedCount: getCompletedCount(db, existing.id),
  }
}

function getObjectiveCount(db: ReturnType<typeof getDb>, projectId: number) {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM objectives WHERE project_id = ?')
    .get(projectId) as { count: number }
  return row?.count ?? 0
}

function getCompletedCount(db: ReturnType<typeof getDb>, projectId: number) {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM objectives WHERE project_id = ? AND done = 1')
    .get(projectId) as { count: number }
  return row?.count ?? 0
}

export function listObjectives(projectId: number): ObjectiveDTO[] {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT id, project_id, title, done, created_at, updated_at FROM objectives WHERE project_id = ? ORDER BY created_at ASC'
    )
    .all(projectId) as ObjectiveRow[]

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export function createObjective(projectId: number, title: string): ObjectiveDTO {
  const db = getDb()
  const createdAt = Date.now()
  const result = db
    .prepare(
      'INSERT INTO objectives (project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(projectId, title.trim(), 0, createdAt, null)

  return {
    id: Number(result.lastInsertRowid),
    projectId,
    title: title.trim(),
    done: false,
    createdAt,
    updatedAt: null,
  }
}

export function updateObjective(id: number, update: ObjectiveUpdate): ObjectiveDTO {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, project_id, title, done, created_at, updated_at FROM objectives WHERE id = ?')
    .get(id) as ObjectiveRow | undefined

  if (!existing) {
    throw new Error('Objectif non trouvé')
  }

  const title = update.title !== undefined ? update.title.trim() : existing.title
  const done = update.done !== undefined ? (update.done ? 1 : 0) : existing.done
  const updatedAt = Date.now()

  db.prepare('UPDATE objectives SET title = ?, done = ?, updated_at = ? WHERE id = ?').run(
    title,
    done,
    updatedAt,
    id
  )

  return {
    id: existing.id,
    projectId: existing.project_id,
    title,
    done: done === 1,
    createdAt: existing.created_at,
    updatedAt,
  }
}

export function deleteObjective(id: number) {
  const db = getDb()
  db.prepare('DELETE FROM objectives WHERE id = ?').run(id)
}

export function exportData(): ExportPayload {
  return {
    version: exportVersion,
    projects: listProjects(),
    objectives: listAllObjectives(),
  }
}

export function importData(payload: ExportPayload, mode: ImportMode) {
  assertValidPayload(payload)

  const db = getDb()
  const insertProject = db.prepare('INSERT INTO projects (name, created_at) VALUES (?, ?)')
  const insertObjective = db.prepare(
    'INSERT INTO objectives (project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )

  const transaction = db.transaction(() => {
    if (mode === 'overwrite') {
      db.exec('DELETE FROM objectives')
      db.exec('DELETE FROM projects')

      const insertProjectWithId = db.prepare(
        'INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)'
      )
      const insertObjectiveWithId = db.prepare(
        'INSERT INTO objectives (id, project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )

      payload.projects.forEach((project) => {
        insertProjectWithId.run(project.id, project.name.trim(), project.createdAt)
      })

      payload.objectives.forEach((objective) => {
        insertObjectiveWithId.run(
          objective.id,
          objective.projectId,
          objective.title.trim(),
          objective.done ? 1 : 0,
          objective.createdAt,
          objective.updatedAt
        )
      })

      return {
        projects: payload.projects.length,
        objectives: payload.objectives.length,
      }
    }

    const projectIdMap = new Map<number, number>()

    payload.projects.forEach((project) => {
      const result = insertProject.run(project.name.trim(), project.createdAt)
      projectIdMap.set(project.id, Number(result.lastInsertRowid))
    })

    let objectivesImported = 0
    payload.objectives.forEach((objective) => {
      const mappedProjectId = projectIdMap.get(objective.projectId)
      if (!mappedProjectId) {
        return
      }

      insertObjective.run(
        mappedProjectId,
        objective.title.trim(),
        objective.done ? 1 : 0,
        objective.createdAt,
        objective.updatedAt
      )
      objectivesImported += 1
    })

    return {
      projects: payload.projects.length,
      objectives: objectivesImported,
    }
  })

  return transaction()
}

function listAllObjectives(): ObjectiveDTO[] {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT id, project_id, title, done, created_at, updated_at FROM objectives ORDER BY created_at ASC'
    )
    .all() as ObjectiveRow[]

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

function assertValidPayload(payload: ExportPayload) {
  if (!payload || payload.version !== exportVersion) {
    throw new Error('Version du fichier d\'import non supportée')
  }

  if (!Array.isArray(payload.projects) || !Array.isArray(payload.objectives)) {
    throw new Error('Fichier d\'import invalide')
  }
}
