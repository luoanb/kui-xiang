import { defineStore } from 'pinia'
import path from 'path'

interface ProjectFolder {
  name: string
  path: string
  lastOpened: number
}

interface ProjectState {
  currentFolder: ProjectFolder | null
  history: ProjectFolder[]
  maxHistory: number
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    currentFolder: null,
    history: [],
    maxHistory: 10,
  }),

  actions: {
    setCurrentFolder(folder: ProjectFolder) {
      this.currentFolder = folder
      this.addToHistory(folder)
      this.saveToStorage()
    },

    addToHistory(folder: ProjectFolder) {
      const existingIndex = this.history.findIndex(f => f.path === folder.path)
      
      if (existingIndex !== -1) {
        this.history.splice(existingIndex, 1)
      }
      
      this.history.unshift(folder)
      
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(0, this.maxHistory)
      }
    },

    selectFolderFromHistory(folder: ProjectFolder) {
      this.currentFolder = folder
      this.addToHistory(folder)
      this.saveToStorage()
    },

    removeFromHistory(folderPath: string) {
      this.history = this.history.filter(f => f.path !== folderPath)
      if (this.currentFolder?.path === folderPath) {
        this.currentFolder = null
      }
      this.saveToStorage()
    },

    clearHistory() {
      this.history = []
      this.currentFolder = null
      this.saveToStorage()
    },

    saveToStorage() {
      localStorage.setItem('project-history', JSON.stringify({
        currentFolder: this.currentFolder,
        history: this.history,
      }))
    },

    loadFromStorage() {
      try {
        const stored = localStorage.getItem('project-history')
        if (stored) {
          const data = JSON.parse(stored)
          this.currentFolder = data.currentFolder || null
          this.history = data.history || []
        }
      } catch (error) {
        console.error('加载项目历史失败:', error)
      }
    },

    getCurrentPath(): string | null {
      return this.currentFolder?.path || null
    },

    getCurrentFolderName(): string {
      return this.currentFolder?.name || '未选择项目'
    },
  },

  persist: {
    key: 'project-store',
  },
})
