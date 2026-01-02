<script setup lang="ts">
import { isVNode, ref } from 'vue'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, ToastAction } from '.'
import { useToast } from './use-toast'
import { Copy, Check } from 'lucide-vue-next'

const { toasts } = useToast()

// 复制状态管理
const copiedIds = ref<Set<string>>(new Set())

// 复制错误信息到剪贴板
const copyError = async (toast: any) => {
  try {
    // 构建要复制的文本
    let textToCopy = ''
    if (toast.title) {
      textToCopy += toast.title
    }
    if (toast.description) {
      if (textToCopy) textToCopy += '\n\n'
      if (typeof toast.description === 'string') {
        textToCopy += toast.description
      } else {
        // 如果是 VNode，提示查看控制台
        textToCopy += '错误详情请查看控制台'
      }
    }

    await navigator.clipboard.writeText(textToCopy)
    
    // 显示复制成功状态
    copiedIds.value.add(toast.id)
    
    // 2秒后恢复
    setTimeout(() => {
      copiedIds.value.delete(toast.id)
    }, 2000)
  } catch (error) {
    console.error('[Toaster] 复制失败:', error)
  }
}

// 判断是否为错误类型的 toast
const isErrorToast = (toast: any) => {
  return toast.variant === 'destructive'
}
</script>

<template>
  <ToastProvider>
    <Toast v-for="toast in toasts" :key="toast.id" v-bind="toast">
      <div class="grid gap-1">
        <ToastTitle v-if="toast.title">
          {{ toast.title }}
        </ToastTitle>
        <template v-if="toast.description">
          <ToastDescription v-if="isVNode(toast.description)">
            <component :is="toast.description" />
          </ToastDescription>
          <ToastDescription v-else>
            {{ toast.description }}
          </ToastDescription>
        </template>
        <ToastClose />
      </div>
      <!-- 错误类型的 toast 显示复制按钮 -->
      <ToastAction
        v-if="isErrorToast(toast) && !toast.action"
        @click="copyError(toast)"
        class="ml-2"
      >
        <Check v-if="copiedIds.has(toast.id)" class="h-4 w-4" />
        <Copy v-else class="h-4 w-4" />
      </ToastAction>
      <!-- 自定义 action -->
      <component v-else :is="toast.action" />
    </Toast>
    <ToastViewport />
  </ToastProvider>
</template>
