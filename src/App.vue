<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ImportMode, ObjectiveDTO, ProjectDTO } from './shared/ipc'

const projects = ref<ProjectDTO[]>([])
const objectives = ref<ObjectiveDTO[]>([])
const selectedProjectId = ref<number | null>(null)
const newProjectName = ref('')
const newObjectiveTitle = ref('')
const status = ref('')
const editingProjectId = ref<number | null>(null)
const editingProjectName = ref('')
const editingObjectiveId = ref<number | null>(null)
const editingTitle = ref('')
const projectMenu = ref<{ id: number; x: number; y: number } | null>(null)

const selectedProject = computed(() =>
  projects.value.find((project) => project.id === selectedProjectId.value) ?? null
)
const incompleteObjectives = computed(() =>
  objectives.value.filter((objective) => !objective.done)
)
const completedObjectives = computed(() =>
  objectives.value.filter((objective) => objective.done)
)

function formatCountLabel(count: number) {
  return `${count} objectif${count > 1 ? 's' : ''}`
}

function setStatus(message: string) {
  status.value = message
  if (message) {
    window.setTimeout(() => {
      status.value = ''
    }, 4000)
  }
}

async function refreshProjects() {
  projects.value = await window.api.listProjects()
  if (projects.value.length === 0) {
    selectedProjectId.value = null
    objectives.value = []
    return
  }

  if (!selectedProjectId.value || !projects.value.some((p) => p.id === selectedProjectId.value)) {
    selectedProjectId.value = projects.value[0].id
  }

  if (selectedProjectId.value) {
    await refreshObjectives(selectedProjectId.value)
  }
}

async function refreshObjectives(projectId: number) {
  objectives.value = await window.api.listObjectives(projectId)
}

function selectProject(projectId: number) {
  selectedProjectId.value = projectId
  refreshObjectives(projectId)
}

async function handleCreateProject() {
  const name = newProjectName.value.trim()
  if (!name) {
    return
  }

  const project = await window.api.createProject(name)
  newProjectName.value = ''
  selectedProjectId.value = project.id
  await refreshProjects()
  setStatus(`Projet "${project.name}" créé`)
}

async function handleDeleteProject(projectId: number) {
  const project = projects.value.find((item) => item.id === projectId)
  if (!project || !window.confirm(`Supprimer le projet "${project.name}" et tous ses objectifs ?`)) {
    return
  }

  await window.api.deleteProject(projectId)
  await refreshProjects()
  setStatus(`Projet "${project.name}" supprimé`)
}

function openProjectMenu(project: ProjectDTO, event: MouseEvent) {
  projectMenu.value = {
    id: project.id,
    x: event.clientX,
    y: event.clientY,
  }
}

function closeProjectMenu() {
  projectMenu.value = null
}

function handleProjectMenuEdit() {
  const project = projects.value.find((item) => item.id === projectMenu.value?.id)
  if (!project) {
    return
  }
  handleEditProject(project)
  closeProjectMenu()
}

function handleProjectMenuDelete() {
  const projectId = projectMenu.value?.id
  if (!projectId) {
    return
  }
  closeProjectMenu()
  handleDeleteProject(projectId)
}

function handleEditProject(project: ProjectDTO) {
  editingProjectId.value = project.id
  editingProjectName.value = project.name
}

function handleCancelProjectEdit() {
  editingProjectId.value = null
  editingProjectName.value = ''
}

async function handleSaveProjectEdit(project: ProjectDTO) {
  const name = editingProjectName.value.trim()
  if (!name) {
    return
  }

  const updated = await window.api.updateProject(project.id, { name })
  projects.value = projects.value.map((item) => (item.id === updated.id ? updated : item))
  handleCancelProjectEdit()
  setStatus(`Projet "${updated.name}" modifié`)
}

async function handleCreateObjective() {
  if (!selectedProjectId.value) {
    return
  }

  const title = newObjectiveTitle.value.trim()
  if (!title) {
    return
  }

  await window.api.createObjective(selectedProjectId.value, title)
  newObjectiveTitle.value = ''
  await refreshObjectives(selectedProjectId.value)
  setStatus('Objectif ajouté')
}

async function handleToggleObjective(objective: ObjectiveDTO) {
  const updated = await window.api.updateObjective(objective.id, { done: !objective.done })
  objectives.value = objectives.value.map((item) => (item.id === updated.id ? updated : item))
}

async function handleEditObjective(objective: ObjectiveDTO) {
  editingObjectiveId.value = objective.id
  editingTitle.value = objective.title
}

function handleCancelEdit() {
  editingObjectiveId.value = null
  editingTitle.value = ''
}

async function handleSaveEdit(objective: ObjectiveDTO) {
  const title = editingTitle.value.trim()
  if (!title) {
    return
  }

  const updated = await window.api.updateObjective(objective.id, { title })
  objectives.value = objectives.value.map((item) => (item.id === updated.id ? updated : item))
  handleCancelEdit()
  setStatus('Objectif modifié')
}

async function handleDeleteObjective(objective: ObjectiveDTO) {
  if (!selectedProjectId.value) {
    return
  }

  if (!window.confirm(`Supprimer l'objectif "${objective.title}" ?`)) {
    return
  }

  await window.api.deleteObjective(objective.id, selectedProjectId.value)
  await refreshObjectives(selectedProjectId.value)
  setStatus('Objectif supprimé')
}

async function handleExport() {
  const result = await window.api.exportData()
  if (result.canceled) {
    return
  }
  if (result.error) {
    setStatus(result.error)
    return
  }
  setStatus(`Export terminé : ${result.path ?? 'fichier'}`)
}

async function handleImport(mode: ImportMode) {
  if (mode === 'overwrite') {
    const ok = window.confirm(
      'Écraser toutes les données existantes avec le fichier importé ?'
    )
    if (!ok) {
      return
    }
  }

  const result = await window.api.importData(mode)
  if (result.canceled) {
    return
  }
  if (result.error) {
    setStatus(result.error)
    return
  }

  await refreshProjects()
  setStatus(
    `Import terminé : ${result.projects ?? 0} projets, ${result.objectives ?? 0} objectifs`
  )
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString()
}

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await refreshProjects()
  window.addEventListener('click', closeProjectMenu)
  unsubscribe = window.api.onDataChanged((payload) => {
    if (payload.type === 'projects') {
      refreshProjects()
      return
    }

    if (payload.type === 'objectives' && payload.projectId === selectedProjectId.value) {
      refreshObjectives(payload.projectId)
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeProjectMenu)
  unsubscribe?.()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div>
        <p class="eyebrow">Liste des objectifs</p>
        <h1>Clarté, rythme, progression</h1>
      </div>
      <div class="header-actions">
        <button class="ghost" type="button" @click="handleExport">Exporter JSON</button>
        <button class="ghost" type="button" @click="handleImport('merge')">
          Importer (fusion)
        </button>
        <button class="ghost danger" type="button" @click="handleImport('overwrite')">
          Importer (écraser)
        </button>
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>Projets</h2>
          <form class="inline-form project-form" @submit.prevent="handleCreateProject">
            <input v-model="newProjectName" type="text" placeholder="Nouveau projet" />
            <button type="submit">Ajouter</button>
          </form>
        </div>

        <ul class="project-list">
          <li v-for="project in projects" :key="project.id">
            <div
              class="project-item"
              :class="{ active: project.id === selectedProjectId }"
              @click="selectProject(project.id)"
              @contextmenu.prevent="openProjectMenu(project, $event)"
              role="button"
              tabindex="0"
            >
              <div class="project-meta">
                <span class="project-name">{{ project.name }}</span>
                <span class="meta">
                  {{ formatDate(project.createdAt) }} ·
                  {{ project.completedCount }}/{{ project.objectiveCount }} terminés
                </span>
              </div>

              <div v-if="editingProjectId === project.id" class="inline-edit">
                <input
                  v-model="editingProjectName"
                  type="text"
                  class="edit-input"
                  placeholder="Modifier le projet"
                  @keyup.enter="handleSaveProjectEdit(project)"
                  @keyup.esc="handleCancelProjectEdit"
                />
                <div class="objective-actions">
                  <button class="ghost" type="button" @click="handleSaveProjectEdit(project)">
                    Enregistrer
                  </button>
                  <button class="ghost danger" type="button" @click="handleCancelProjectEdit">
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </aside>

      <main class="main">
        <div v-if="!selectedProject" class="empty">
          <h2>Aucun projet sélectionné</h2>
          <p>Crée un projet pour commencer à suivre tes objectifs.</p>
        </div>

        <div v-else>
          <div class="main-header">
            <div>
              <h2>{{ selectedProject.name }}</h2>
              <p class="muted">
                {{ formatCountLabel(objectives.length) }} · {{ completedObjectives.length }} terminés
              </p>
            </div>
            <form class="inline-form" @submit.prevent="handleCreateObjective">
              <input v-model="newObjectiveTitle" type="text" placeholder="Ajouter un objectif" />
              <button type="submit">Ajouter</button>
            </form>
          </div>

          <div class="objective-group">
            <h3>En cours</h3>
            <ul class="objective-list">
              <li
                v-for="objective in incompleteObjectives"
                :key="objective.id"
                class="objective-item"
              >
                <div class="objective-content">
                  <label class="checkbox">
                    <input
                      type="checkbox"
                      :checked="objective.done"
                      @change="handleToggleObjective(objective)"
                    />
                    <span class="checkbox-box" aria-hidden="true"></span>
                    <span :class="{ done: objective.done }">{{ objective.title }}</span>
                  </label>

                  <div v-if="editingObjectiveId === objective.id" class="inline-edit">
                    <input
                      v-model="editingTitle"
                      type="text"
                      class="edit-input"
                      placeholder="Modifier l'objectif"
                      @keyup.enter="handleSaveEdit(objective)"
                      @keyup.esc="handleCancelEdit"
                    />
                    <div class="objective-actions">
                      <button class="ghost" type="button" @click="handleSaveEdit(objective)">
                        Enregistrer
                      </button>
                      <button class="ghost danger" type="button" @click="handleCancelEdit">
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>

                <div class="objective-actions" v-if="editingObjectiveId !== objective.id">
                  <button class="ghost" type="button" @click="handleEditObjective(objective)">
                    Modifier
                  </button>
                  <button class="ghost danger" type="button" @click="handleDeleteObjective(objective)">
                    Supprimer
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <div class="objective-group">
            <h3 class="accent">Terminés</h3>
            <ul class="objective-list">
              <li
                v-for="objective in completedObjectives"
                :key="objective.id"
                class="objective-item"
              >
              <div class="objective-content">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    :checked="objective.done"
                    @change="handleToggleObjective(objective)"
                  />
                  <span class="checkbox-box" aria-hidden="true"></span>
                  <span :class="{ done: objective.done }">{{ objective.title }}</span>
                </label>

                <div v-if="editingObjectiveId === objective.id" class="inline-edit">
                  <input
                    v-model="editingTitle"
                    type="text"
                    class="edit-input"
                    placeholder="Modifier l'objectif"
                    @keyup.enter="handleSaveEdit(objective)"
                    @keyup.esc="handleCancelEdit"
                  />
                  <div class="objective-actions">
                    <button class="ghost" type="button" @click="handleSaveEdit(objective)">
                      Enregistrer
                    </button>
                    <button class="ghost danger" type="button" @click="handleCancelEdit">
                      Annuler
                    </button>
                  </div>
                </div>
              </div>

              <div class="objective-actions" v-if="editingObjectiveId !== objective.id">
                <button class="ghost" type="button" @click="handleEditObjective(objective)">
                  Modifier
                </button>
                <button class="ghost danger" type="button" @click="handleDeleteObjective(objective)">
                  Supprimer
                </button>
              </div>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </section>

    <footer v-if="status" class="status">{{ status }}</footer>

    <div
      v-if="projectMenu"
      class="project-menu"
      :style="{ left: projectMenu.x + 'px', top: projectMenu.y + 'px' }"
      @click.stop
    >
      <button type="button" class="menu-item" @click="handleProjectMenuEdit">Renommer</button>
      <button type="button" class="menu-item danger" @click="handleProjectMenuDelete">
        Supprimer
      </button>
    </div>
  </div>
</template>
