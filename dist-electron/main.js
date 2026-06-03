import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
let db = null;
function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "objective-list.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}
function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY CHECK (version >= 1)
    );
  `);
  const row = database.prepare("SELECT version FROM schema_version LIMIT 1").get();
  const currentVersion = (row == null ? void 0 : row.version) ?? 0;
  if (currentVersion < 1) {
    const transaction = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS objectives (
          id INTEGER PRIMARY KEY,
          project_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          done INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
      `);
      database.prepare("DELETE FROM schema_version").run();
      database.prepare("INSERT INTO schema_version (version) VALUES (1)").run();
    });
    transaction();
  }
}
const exportVersion = 1;
function listProjects() {
  const db2 = getDb();
  const rows = db2.prepare(
    `
      SELECT projects.id, projects.name, projects.created_at,
        COUNT(objectives.id) AS objective_count,
        SUM(CASE WHEN objectives.done = 1 THEN 1 ELSE 0 END) AS completed_count
      FROM projects
      LEFT JOIN objectives ON objectives.project_id = projects.id
      GROUP BY projects.id
      ORDER BY projects.created_at ASC
      `
  ).all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    objectiveCount: row.objective_count ?? 0,
    completedCount: row.completed_count ?? 0
  }));
}
function createProject(name) {
  const db2 = getDb();
  const createdAt = Date.now();
  const result = db2.prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)").run(name.trim(), createdAt);
  return {
    id: Number(result.lastInsertRowid),
    name: name.trim(),
    createdAt,
    objectiveCount: 0,
    completedCount: 0
  };
}
function deleteProject(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM projects WHERE id = ?").run(id);
}
function updateProject(id, update) {
  const db2 = getDb();
  const existing = db2.prepare("SELECT id, name, created_at FROM projects WHERE id = ?").get(id);
  if (!existing) {
    throw new Error("Project not found");
  }
  const name = update.name !== void 0 ? update.name.trim() : existing.name;
  db2.prepare("UPDATE projects SET name = ? WHERE id = ?").run(name, id);
  return {
    id: existing.id,
    name,
    createdAt: existing.created_at,
    objectiveCount: getObjectiveCount(db2, existing.id),
    completedCount: getCompletedCount(db2, existing.id)
  };
}
function getObjectiveCount(db2, projectId) {
  const row = db2.prepare("SELECT COUNT(*) as count FROM objectives WHERE project_id = ?").get(projectId);
  return (row == null ? void 0 : row.count) ?? 0;
}
function getCompletedCount(db2, projectId) {
  const row = db2.prepare("SELECT COUNT(*) as count FROM objectives WHERE project_id = ? AND done = 1").get(projectId);
  return (row == null ? void 0 : row.count) ?? 0;
}
function listObjectives(projectId) {
  const db2 = getDb();
  const rows = db2.prepare(
    "SELECT id, project_id, title, done, created_at, updated_at FROM objectives WHERE project_id = ? ORDER BY created_at ASC"
  ).all(projectId);
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
function createObjective(projectId, title) {
  const db2 = getDb();
  const createdAt = Date.now();
  const result = db2.prepare(
    "INSERT INTO objectives (project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(projectId, title.trim(), 0, createdAt, null);
  return {
    id: Number(result.lastInsertRowid),
    projectId,
    title: title.trim(),
    done: false,
    createdAt,
    updatedAt: null
  };
}
function updateObjective(id, update) {
  const db2 = getDb();
  const existing = db2.prepare("SELECT id, project_id, title, done, created_at, updated_at FROM objectives WHERE id = ?").get(id);
  if (!existing) {
    throw new Error("Objective not found");
  }
  const title = update.title !== void 0 ? update.title.trim() : existing.title;
  const done = update.done !== void 0 ? update.done ? 1 : 0 : existing.done;
  const updatedAt = Date.now();
  db2.prepare("UPDATE objectives SET title = ?, done = ?, updated_at = ? WHERE id = ?").run(
    title,
    done,
    updatedAt,
    id
  );
  return {
    id: existing.id,
    projectId: existing.project_id,
    title,
    done: done === 1,
    createdAt: existing.created_at,
    updatedAt
  };
}
function deleteObjective(id) {
  const db2 = getDb();
  db2.prepare("DELETE FROM objectives WHERE id = ?").run(id);
}
function exportData() {
  return {
    version: exportVersion,
    projects: listProjects(),
    objectives: listAllObjectives()
  };
}
function importData(payload, mode) {
  assertValidPayload(payload);
  const db2 = getDb();
  const insertProject = db2.prepare("INSERT INTO projects (name, created_at) VALUES (?, ?)");
  const insertObjective = db2.prepare(
    "INSERT INTO objectives (project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  );
  const transaction = db2.transaction(() => {
    if (mode === "overwrite") {
      db2.exec("DELETE FROM objectives");
      db2.exec("DELETE FROM projects");
      const insertProjectWithId = db2.prepare(
        "INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)"
      );
      const insertObjectiveWithId = db2.prepare(
        "INSERT INTO objectives (id, project_id, title, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      );
      payload.projects.forEach((project) => {
        insertProjectWithId.run(project.id, project.name.trim(), project.createdAt);
      });
      payload.objectives.forEach((objective) => {
        insertObjectiveWithId.run(
          objective.id,
          objective.projectId,
          objective.title.trim(),
          objective.done ? 1 : 0,
          objective.createdAt,
          objective.updatedAt
        );
      });
      return {
        projects: payload.projects.length,
        objectives: payload.objectives.length
      };
    }
    const projectIdMap = /* @__PURE__ */ new Map();
    payload.projects.forEach((project) => {
      const result = insertProject.run(project.name.trim(), project.createdAt);
      projectIdMap.set(project.id, Number(result.lastInsertRowid));
    });
    let objectivesImported = 0;
    payload.objectives.forEach((objective) => {
      const mappedProjectId = projectIdMap.get(objective.projectId);
      if (!mappedProjectId) {
        return;
      }
      insertObjective.run(
        mappedProjectId,
        objective.title.trim(),
        objective.done ? 1 : 0,
        objective.createdAt,
        objective.updatedAt
      );
      objectivesImported += 1;
    });
    return {
      projects: payload.projects.length,
      objectives: objectivesImported
    };
  });
  return transaction();
}
function listAllObjectives() {
  const db2 = getDb();
  const rows = db2.prepare(
    "SELECT id, project_id, title, done, created_at, updated_at FROM objectives ORDER BY created_at ASC"
  ).all();
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
function assertValidPayload(payload) {
  if (!payload || payload.version !== exportVersion) {
    throw new Error("Unsupported import payload version");
  }
  if (!Array.isArray(payload.projects) || !Array.isArray(payload.objectives)) {
    throw new Error("Invalid import payload");
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    title: "Objective List",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
function broadcastChange(payload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("data:changed", payload);
  });
}
ipcMain.handle("ping", () => "pong");
ipcMain.handle("projects:list", () => listProjects());
ipcMain.handle("projects:create", (_event, name) => {
  const project = createProject(name);
  broadcastChange({ type: "projects" });
  return project;
});
ipcMain.handle("projects:update", (_event, id, update) => {
  const project = updateProject(id, update);
  broadcastChange({ type: "projects" });
  return project;
});
ipcMain.handle("projects:delete", (_event, id) => {
  deleteProject(id);
  broadcastChange({ type: "projects" });
});
ipcMain.handle("objectives:list", (_event, projectId) => listObjectives(projectId));
ipcMain.handle("objectives:create", (_event, projectId, title) => {
  const objective = createObjective(projectId, title);
  broadcastChange({ type: "objectives", projectId });
  return objective;
});
ipcMain.handle("objectives:update", (_event, id, update) => {
  const objective = updateObjective(id, update);
  broadcastChange({ type: "objectives", projectId: objective.projectId });
  return objective;
});
ipcMain.handle("objectives:delete", (_event, id, projectId) => {
  deleteObjective(id);
  broadcastChange({ type: "objectives", projectId });
});
ipcMain.handle("data:export", async () => {
  const result = await dialog.showSaveDialog({
    title: "Export objectives",
    defaultPath: "objective-list.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  const payload = exportData();
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
  return { canceled: false, path: result.filePath };
});
ipcMain.handle("data:import", async (_event, mode) => {
  const result = await dialog.showOpenDialog({
    title: "Import objectives",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  try {
    const raw = fs.readFileSync(result.filePaths[0], "utf-8");
    const payload = JSON.parse(raw);
    const summary = importData(payload, mode);
    broadcastChange({ type: "projects" });
    return { canceled: false, ...summary };
  } catch (error) {
    return {
      canceled: false,
      error: error instanceof Error ? error.message : "Import failed"
    };
  }
});
app.whenReady().then(createWindow);
export {
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
