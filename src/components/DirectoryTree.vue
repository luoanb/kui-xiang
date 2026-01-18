<template>
  <div class="directory-tree">
    <div class="tree-header p-2 flex items-center justify-between border-b">
      <h3 class="text-sm font-semibold">文件目录</h3>
      <div class="flex gap-2">
        <button 
          class="text-xs px-2 py-1 bg-accent hover:bg-accent/80 text-accent-foreground rounded transition-colors"
          @click="refresh"
        >
          刷新
        </button>
      </div>
    </div>
    <div class="tree-content overflow-auto h-[calc(100%-36px)]">
      <div class="p-2">
        <div v-if="loading" class="flex items-center justify-center py-4 text-muted-foreground">
          <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
          <span>加载中...</span>
        </div>
        <div v-else-if="error" class="py-4 text-center text-destructive">
          {{ error }}
        </div>
        <div v-else>
          <TreeItem
            v-for="item in treeData"
            :key="item.path"
            :item="item"
            :level="0"
            @select="handleSelect"
            @open="handleOpen"
            @expand="handleExpand"
            @refresh="refresh"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fileApi, type FileItem } from '@/api/request'
import { useProjectStore } from '@/stores/project'
import TreeItem from './TreeItem.vue'

// 主组件
const emit = defineEmits(['open', 'select', 'refresh'])

const projectStore = useProjectStore()
const treeData = ref<FileItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 格式化文件大小
const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// 加载目录数据
const loadDirectory = async () => {
  try {
    loading.value = true
    error.value = null
    const result = await fileApi.getChildren()
    treeData.value = result.children
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载目录失败'
    console.error('Failed to load directory:', err)
  } finally {
    loading.value = false
  }
}

// 刷新目录
const refresh = () => {
  console.log('[DirectoryTree] 刷新目录')
  loadDirectory()
  emit('refresh')
}

// 处理选择
const handleSelect = (item: FileItem) => {
  emit('select', item)
}

// 处理文件打开
const handleOpen = (item: FileItem) => {
  emit('open', item)
}

// 处理目录展开
const handleExpand = (path: string) => {
  // 可以在这里添加额外的逻辑，比如记录展开状态
}

// 初始加载
onMounted(() => {
  loadDirectory()
})
</script>

<style scoped>
.directory-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid border;
}

.tree-content {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.tree-content::-webkit-scrollbar {
  width: 6px;
}

.tree-content::-webkit-scrollbar-track {
  background: transparent;
}

.tree-content::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 3px;
  border: none;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-border-strong);
}

.tree-item {
  user-select: none;
}
</style>
