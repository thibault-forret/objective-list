# Objective List

Objective List est une application de bureau élégante et performante conçue pour vous aider à organiser vos projets et à suivre vos objectifs avec clarté et rythme.

## 🚀 Fonctionnalités

- **Gestion de Projets** : Créez, renommez et organisez vos différents projets depuis une barre latérale intuitive.
- **Suivi d'Objectifs** : Ajoutez des objectifs à chaque projet, marquez-les comme terminés et suivez votre progression en temps réel.
- **Indicateurs de Progression** : Visualisez instantanément le nombre d'objectifs terminés par rapport au total pour chaque projet.
- **Import/Export JSON** : Sauvegardez vos données ou transférez-les facilement grâce aux fonctions d'importation (fusion ou écrasement) et d'exportation.
- **Interface Moderne** : Une interface soignée, réactive et localisée en français pour une expérience utilisateur optimale.

## 🛠️ Stack Technique

- **Frontend** : [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Backend** : [Electron](https://www.electronjs.org/)
- **Base de données** : SQLite (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Packaging** : [electron-builder](https://www.electron.build/)

## 💻 Développement

### Installation des dépendances

```bash
npm install
```

### Lancer en mode développement

```bash
npm run dev
```

### Créer l'exécutable (Build)

```bash
npm run build
```

Les fichiers installables seront générés dans le dossier `release/`.
