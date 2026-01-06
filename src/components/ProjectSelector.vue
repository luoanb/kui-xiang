<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import { ChevronDown, FolderOpen, Clock, Trash2 } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/stores/project"
import { mcpApi } from "@/api/request"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const projectStore = useProjectStore()
const version = ref('')

onMounted(async () => {
  if (!window.ipcRenderer) return
  
  try {
    version.value = await window.ipcRenderer.invoke('get-app-version')
  } catch (error) {
    console.error('Failed to get app version:', error)
  }
  
  projectStore.loadFromStorage()
})

const currentFolderName = computed(() => {
  return projectStore.getCurrentFolderName()
})

const handleOpenFolder = async () => {
  if (!window.ipcRenderer) return
  
  try {
    const result = await window.ipcRenderer.invoke('select-folder')
    if (result) {
      projectStore.setCurrentFolder(result)
      
      try {
        await window.ipcRenderer.invoke('update-filesystem-path', result.path)
        await mcpApi.restartFilesystemServer()
      } catch (error) {
        console.error('更新filesystem路径失败:', error)
      }
    }
  } catch (error) {
    console.error('打开文件夹失败:', error)
  }
}

const handleSelectFromHistory = (folder: any) => {
  projectStore.selectFolderFromHistory(folder)
  
  if (window.ipcRenderer) {
    window.ipcRenderer.invoke('update-filesystem-path', folder.path).then(async () => {
      try {
        await mcpApi.restartFilesystemServer()
      } catch (error) {
        console.error('重启filesystem服务器失败:', error)
      }
    }).catch(error => {
      console.error('更新filesystem路径失败:', error)
    })
  }
}

const handleRemoveFromHistory = (folderPath: string) => {
  projectStore.removeFromHistory(folderPath)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child style="-webkit-app-region: no-drag">
      <Button variant="ghost" class="h-6 px-2 text-xs font-bold hover:bg-transparent">
        <span class="flex items-center gap-1">
          <span>{{ currentFolderName }}</span>
          <span v-if="version" class="opacity-30 font-normal">v{{ version }}</span>
          <ChevronDown class="w-3 h-3" />
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-56" style="-webkit-app-region: no-drag">
      <DropdownMenuItem @click="handleOpenFolder" class="cursor-pointer">
        <FolderOpen class="mr-2 h-4 w-4" />
        <span>打开文件夹</span>
      </DropdownMenuItem>
      
      <DropdownMenuSeparator v-if="projectStore.history.length > 0" />
      
      <DropdownMenuLabel v-if="projectStore.history.length > 0" class="text-xs text-muted-foreground">
        最近打开
      </DropdownMenuLabel>
      
      <template v-for="folder in projectStore.history" :key="folder.path">
        <DropdownMenuItem 
          @click="handleSelectFromHistory(folder)"
          class="cursor-pointer group relative"
        >
          <Clock class="mr-2 h-4 w-4" />
          <div class="flex flex-col flex-1 min-w-0">
            <span class="truncate">{{ folder.name }}</span>
            <span class="text-[10px] text-muted-foreground truncate">{{ folder.path }}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6 opacity-0 group-hover:opacity-100 absolute right-2"
            @click.stop="handleRemoveFromHistory(folder.path)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
