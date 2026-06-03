# Project Context (Objective List)

## Goal
Build a desktop objective tracker using Electron + Vue + TypeScript with a local SQLite database and JSON import/export.

## Tech Stack
- Electron (main + preload)
- Vue 3 + Vite (renderer)
- TypeScript
- SQLite (driver to be chosen)
- electron-builder for packaging

## Workspace Layout
- electron/ main process and preload entry points
- src/ renderer (Vue app)
- public/ static assets
- index.html, vite.config.ts, tsconfig*.json
- electron-builder.json5 for packaging config

## Current State
- Base scaffold is present (Electron + Objective List).
- No data layer or IPC services implemented yet.
- UI is still the template.

## Scripts
- dev: vite (renderer dev server)
- build: typecheck + vite build + electron-builder
- preview: vite preview

## Implementation Plan Summary
1. Scaffold and verify scripts and structure.
2. Base Electron setup with contextIsolation and preload bridge.
3. SQLite data layer with schema and migrations.
4. Main process services for CRUD on projects and objectives.
5. IPC API exposed to renderer and refresh events.
6. Renderer UI for projects sidebar and objectives list.
7. JSON import/export with validation and merge/overwrite.
8. Packaging for macOS and Windows.
9. Verification of persistence and import/export.

## Data Model (Planned)
- projects
- objectives (linked to project)
- objective_items (optional)
- migration/version table

## Non-Goals (For Now)
- Cloud sync
- Multi-user accounts
- Complex analytics
