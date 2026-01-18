<template>
  <div class="file-manager flex h-full w-full">
    <!-- 左侧目录树 -->
    <div class="tree-panel w-1/3 h-full border-r">
      <DirectoryTree
        @open="handleFileOpen"
        @select="handleFileSelect"
        @refresh="refresh"
      />
    </div>
    
    <!-- 右侧文件内容 -->
    <div class="content-panel w-2/3 flex flex-col h-full">
      <!-- 文件内容标题栏 -->
      <div class="content-header p-2 flex items-center justify-between border-b">
        <div class="flex items-center gap-2">
          <h3 
            class="text-sm font-semibold whitespace-nowrap"
            :title="currentFile?.path || ''"
          >
            {{ currentFile?.name || '未选择文件' }}
          </h3>
        </div>
        <div class="flex gap-2 whitespace-nowrap">
          <button 
            v-if="currentFile?.type === 'file'"
            class="text-xs px-3 py-1 bg-accent hover:bg-accent/80 text-accent-foreground rounded transition-colors flex-shrink-0"
            @click="saveFile"
            :disabled="!isDirty"
          >
            保存
          </button>
          <button 
            class="text-xs px-3 py-1 bg-accent hover:bg-accent/80 text-accent-foreground rounded transition-colors flex-shrink-0"
            @click="newFile"
          >
            新建文件
          </button>
          <button 
            class="text-xs px-3 py-1 bg-accent hover:bg-accent/80 text-accent-foreground rounded transition-colors flex-shrink-0"
            @click="newDirectory"
          >
            新建目录
          </button>
          <button 
            v-if="currentFile"
            class="text-xs px-3 py-1 bg-destructive hover:bg-destructive/80 text-destructive-foreground rounded transition-colors flex-shrink-0"
            @click="deleteFile"
          >
            删除
          </button>
        </div>
      </div>
      
      <!-- 文件内容编辑区 -->
      <div class="content-body flex-1 overflow-hidden">
        <div v-if="!currentFile" class="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div class="text-lg mb-2">📁</div>
          <p>选择一个文件查看或编辑</p>
          <p class="text-xs mt-1">从左侧目录树中选择文件</p>
        </div>
        
        <div v-else-if="currentFile.type === 'directory'" class="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div class="text-lg mb-2">📁</div>
          <p>{{ currentFile.name }}</p>
          <p class="text-xs mt-1">这是一个目录</p>
        </div>
        
        <div v-else class="h-full">
          <div v-if="loading" class="flex items-center justify-center h-full text-muted-foreground">
            <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="error" class="flex items-center justify-center h-full text-center text-destructive">
            {{ error }}
          </div>
          <div v-else class="h-full flex flex-col">
            <MonacoEditor
              v-model="fileContent"
              class="flex-1"
              :options="{
                automaticLayout: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                fontSize: 14
              }"
            />
          </div>
        </div>
      </div>
      
      <!-- 状态栏 -->
      <div class="content-footer p-1 border-t text-xs text-muted-foreground flex items-center justify-between">
        <div>
          {{ currentFile ? `${currentFile.name} - ${formatSize(currentFile.size)}` : '未选择文件' }}
        </div>
        <div>
          {{ fileContent.length }} 字符
        </div>
      </div>
    </div>
    
    <!-- 新建文件/目录对话框 -->
    <div v-if="showNewFileDialog" class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div class="bg-background rounded p-4 w-[400px]">
        <h3 class="text-sm font-semibold mb-3">新建{{ newItemType === 'file' ? '文件' : '目录' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs mb-1">基础路径</label>
            <div class="w-full p-2 border border-input rounded bg-muted text-sm">
              {{ basePath || '未选择路径' }}
            </div>
          </div>
          <div>
            <label class="block text-xs mb-1">{{ newItemType === 'file' ? '文件' : '目录' }}名称</label>
            <input
              v-model="newItemName"
              class="w-full p-2 border border-input rounded bg-background text-sm"
              :placeholder="`输入${newItemType === 'file' ? '文件' : '目录'}名称`"
              autocomplete="off"
            />
          </div>
          <div class="flex gap-2 justify-end">
            <button 
              class="px-3 py-1 text-xs bg-accent hover:bg-accent/80 text-accent-foreground rounded transition-colors"
              @click="cancelNewItem"
            >
              取消
            </button>
            <button 
              class="px-3 py-1 text-xs bg-primary hover:bg-primary/80 text-primary-foreground rounded transition-colors"
              @click="createNewItem"
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { fileApi, type FileItem } from '@/api/request'
import DirectoryTree from './DirectoryTree.vue'
import MonacoEditor from './common/MonacoEditor.vue'

// 当前选中的文件
const currentFile = ref<FileItem | null>(null)
// 文件内容
const fileContent = ref('')
// 原始文件内容（用于检测是否修改）
const originalContent = ref('')
// 加载状态
const loading = ref(false)
// 错误信息
const error = ref<string | null>(null)
// 是否需要保存
const isDirty = computed(() => fileContent.value !== originalContent.value)
// 新建文件/目录对话框
const showNewFileDialog = ref(false)
// 新建项类型
const newItemType = ref<'file' | 'directory'>('file')
// 基础路径（不可更改）
const basePath = ref('')
// 新建项名称
const newItemName = ref('')
// 新建项路径
const newItemPath = ref('')
// 新建文件内容
const newItemContent = ref('')

// 格式化文件大小
const formatSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// 处理文件打开
const handleFileOpen = async (file: FileItem) => {
  if (file.type !== 'file') return
  
  try {
    loading.value = true
    error.value = null
    const result = await fileApi.readFile(file.path)
    fileContent.value = result.content
    originalContent.value = result.content
    currentFile.value = file
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取文件失败'
    console.error('Failed to read file:', err)
  } finally {
    loading.value = false
  }
}

// 处理文件选择
const handleFileSelect = (file: FileItem) => {
  currentFile.value = file
  if (file.type === 'file') {
    handleFileOpen(file)
  } else {
    fileContent.value = ''
    originalContent.value = ''
  }
}

// 处理文件内容变化
const handleContentChange = () => {
  // 内容变化会自动更新 isDirty 状态
}

// 保存文件
const saveFile = async () => {
  if (!currentFile.value || !isDirty.value) return
  
  try {
    loading.value = true
    error.value = null
    await fileApi.writeFile(currentFile.value.path, fileContent.value)
    originalContent.value = fileContent.value
    // 刷新当前文件信息
    await handleFileOpen(currentFile.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存文件失败'
    console.error('Failed to save file:', err)
  } finally {
    loading.value = false
  }
}

// 刷新
const refresh = () => {
  // 目录树会自行刷新
}

// 获取基础路径 - 所选文件的所在目录，确保没有尾部斜杠
const getBasePath = (): string => {
  if (!currentFile.value) {
    return ''
  }
  
  let path = ''
  if (currentFile.value.type === 'directory') {
    path = currentFile.value.path
  } else {
    // 处理Windows和Unix风格的路径，同时支持正斜杠和反斜杠
    const filePath = currentFile.value.path
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
    // 如果没有斜杠（根目录文件），path 为空字符串
    path = lastSlashIndex === -1 ? '' : filePath.substring(0, lastSlashIndex)
  }
  
  // 移除尾部斜杠（同时处理正斜杠和反斜杠）
  if (path.endsWith('/') || path.endsWith('\\')) {
    path = path.slice(0, -1)
  }
  
  return path
}

// 新建文件
const newFile = () => {
  newItemType.value = 'file'
  // 设置基础路径和新文件名称
  basePath.value = getBasePath()
  newItemName.value = ''
  newItemContent.value = ''
  showNewFileDialog.value = true
}

// 新建目录
const newDirectory = () => {
  newItemType.value = 'directory'
  // 设置基础路径和新目录名称
  basePath.value = getBasePath()
  newItemName.value = ''
  showNewFileDialog.value = true
}

// 取消新建
const cancelNewItem = () => {
  showNewFileDialog.value = false
  newItemPath.value = ''
  newItemContent.value = ''
}

// 创建新文件/目录
const createNewItem = async () => {
  if (!newItemName.value.trim()) {
    error.value = '名称不能为空'
    return
  }
  
  try {
    loading.value = true
    error.value = null
    
    // 组合完整路径，确保只有一个斜杠
    let fullPath = ''
    if (basePath.value) {
      // 检查basePath的末尾是否已有斜杠（支持正斜杠和反斜杠）
      const hasTrailingSlash = basePath.value.endsWith('/') || basePath.value.endsWith('\\')
      // 使用与basePath相同的斜杠风格
      const slash = basePath.value.includes('\\') ? '\\' : '/'
      fullPath = `${basePath.value}${hasTrailingSlash ? '' : slash}${newItemName.value}`
    } else {
      fullPath = newItemName.value
    }
    
    // 新建文件时不需要内容，直接创建空文件
    await fileApi.createFile(fullPath, newItemType.value)
    showNewFileDialog.value = false
    basePath.value = ''
    newItemName.value = ''
    newItemContent.value = ''
    // 刷新目录树
    refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '创建失败'
    console.error('Failed to create item:', err)
  } finally {
    loading.value = false
  }
}

// 删除文件/目录
const deleteFile = async () => {
  if (!currentFile.value) return
  
  if (!confirm(`确定要删除 ${currentFile.value.name} 吗？`)) {
    return
  }
  
  try {
    loading.value = true
    error.value = null
    await fileApi.deleteFile(currentFile.value.path, currentFile.value.type)
    // 清空当前选择
    currentFile.value = null
    fileContent.value = ''
    originalContent.value = ''
    // 刷新目录树
    refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
    console.error('Failed to delete item:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.file-manager {
  height: 100%;
  overflow: hidden;
}

.content-panel {
  height: 100%;
  overflow: hidden;
}

.content-body {
  overflow: hidden;
}

.content-body textarea {
  outline: none;
}

.content-body textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent/20);
}
</style>
