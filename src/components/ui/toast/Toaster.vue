<script setup lang="ts">
import { isVNode } from 'vue'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '.'
import { useToast } from './use-toast'
import { Button } from '@/components/ui/button'

const { toasts } = useToast()

const copyError = async (toast: any) => {
  let text = ''
  if (toast.title) text += toast.title
  if (toast.description) {
    if (text) text += '\n\n'
    text += typeof toast.description === 'string' ? toast.description : '错误详情请查看控制台'
  }
  await navigator.clipboard.writeText(text)
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
      <Button
        v-if="toast.variant === 'destructive'"
        @click="copyError(toast)"
        size="sm"
        variant="outline"
      >
        复制
      </Button>
      <component v-if="toast.action" :is="toast.action" />
    </Toast>
    <ToastViewport />
  </ToastProvider>
</template>
