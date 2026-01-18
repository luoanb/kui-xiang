<template>
  <div class="tree-item" :style="{ paddingLeft: 14 + 'px' }">
    <div 
      class="flex items-center py-1 px-2 rounded hover:bg-accent/50 cursor-pointer transition-colors"
      @click="handleItemClick"
      @contextmenu.prevent="handleContextMenu"
    >
      <!-- 展开/折叠图标 -->
      <div v-if="item.type === 'directory'" class="w-4 h-4 flex items-center justify-center mr-1">
        <div v-if="loading" class="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full"></div>
        <div v-else-if="item.hasChildren || children" class="w-3 h-3 flex items-center justify-center">
          <span 
            class="text-xs font-bold transition-transform duration-150" 
            :class="{ 'rotate-90': isExpanded }"
          >
            >
          </span>
        </div>
        <div v-else class="w-4"></div>
      </div>
      <!-- 文件/目录图标 -->
      <div v-if="item.type === 'file'" class="w-4 h-4 flex items-center justify-center mr-1 text-blue-500">
        📄
      </div>
      <div v-else class="w-4 h-4 flex items-center justify-center mr-1 text-yellow-500">
        📁
      </div>
      <!-- 名称 -->
      <div v-if="isRenaming" class="flex-1 flex items-center">
        <input
          v-model="newName"
          class="w-full text-sm font-mono border border-input rounded bg-background px-1 py-0 focus:outline-none"
          @blur="handleRenameBlur"
          @keyup.enter="handleRenameSubmit"
          @keyup.escape="cancelRename"
          ref="renameInput"
          autocomplete="off"
        />
      </div>
      <span 
        v-else
        class="text-sm flex-1 truncate"
        :class="{ 'font-medium': item.type === 'directory' }"
        @dblclick="startRename"
      >
        {{ item.name }}
      </span>
      <!-- 大小（仅文件） -->
      <span v-if="item.type === 'file'" class="text-xs text-muted-foreground ml-2">
        {{ formatSize(item.size) }}
      </span>
    </div>
    <!-- 右键菜单 -->
    <div 
      v-if="showContextMenu" 
      class="absolute z-50 bg-background border rounded shadow-lg p-1"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div 
        class="px-2 py-1 text-xs cursor-pointer hover:bg-accent rounded"
        @click="startRename"
      >
        重命名
      </div>
    </div>
    <!-- 子目录 -->
    <div v-if="isExpanded && children">
      <TreeItem
        v-for="child in children"
        :key="child.path"
        :item="child"
        :level="level + 1"
        @select="$emit('select', $event)"
        @open="$emit('open', $event)"
        @expand="$emit('expand', $event)"
        @refresh="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { fileApi, type FileItem } from '@/api/request'

const props = defineProps<{
  item: FileItem
  level: number
}>()

const emit = defineEmits(['select', 'open', 'expand', 'refresh', 'rename'])

const isExpanded = ref(false)
const children = ref<FileItem[] | null>(null)
const loading = ref(false)
const hasLoaded = ref(false)

// 重命名相关状态
const isRenaming = ref(false)
const newName = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

// 格式化文件大小
const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// 处理展开/折叠
const toggleExpand = async () => {
  if (props.item.type !== 'directory') return
  
  if (!children.value && !hasLoaded.value) {
    // 第一次展开，加载子目录
    try {
      loading.value = true
      const result = await fileApi.getChildren(props.item.path)
      children.value = result.children
      hasLoaded.value = true
      isExpanded.value = true
      emit('expand', props.item.path)
    } catch (error) {
      console.error('Failed to load children:', error)
      emit('refresh')
    } finally {
      loading.value = false
    }
  } else {
    // 已经加载过，直接切换展开状态
    isExpanded.value = !isExpanded.value
  }
}

// 处理项目点击
const handleItemClick = () => {
  // 重命名时不执行点击操作
  if (isRenaming.value) {
    return
  }
  
  if (props.item.type === 'directory') {
    toggleExpand()
    // 目录不触发选择事件
  } else {
    handleOpen()
    // 只有文件触发选择事件
    handleSelect()
  }
}

// 处理选择
const handleSelect = () => {
  // 只有文件可以被选中，目录不可被选中
  if (props.item.type === 'file') {
    emit('select', props.item)
  }
}

// 处理文件打开
const handleOpen = () => {
  if (props.item.type === 'file') {
    emit('open', props.item)
  }
}

// 处理右键菜单
const handleContextMenu = (event: MouseEvent) => {
  showContextMenu.value = true
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  
  // 点击其他地方关闭右键菜单
  const closeMenu = () => {
    showContextMenu.value = false
    document.removeEventListener('click', closeMenu)
  }
  document.addEventListener('click', closeMenu)
}

// 开始重命名
const startRename = () => {
  isRenaming.value = true
  newName.value = props.item.name
  showContextMenu.value = false
  
  // 等待DOM更新后聚焦输入框
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

// 取消重命名
const cancelRename = () => {
  isRenaming.value = false
  newName.value = ''
}

// 处理重命名提交
const handleRenameSubmit = async () => {
  if (!newName.value.trim() || newName.value === props.item.name) {
    cancelRename()
    return
  }
  
  try {
    const oldPath = props.item.path
    const basePath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
    const newPath = basePath + newName.value
    
    await fileApi.renameFile(oldPath, newPath)
    emit('refresh')
    cancelRename()
  } catch (error) {
    console.error('Failed to rename item:', error)
    cancelRename()
  }
}

// 处理重命名输入框失焦
const handleRenameBlur = () => {
  handleRenameSubmit()
}
</script>

<style scoped>
.tree-item {
  user-select: none;
}
</style>