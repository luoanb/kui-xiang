<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import MonacoEditor from '@/components/common/MonacoEditor.vue'
import { ref, defineProps, defineEmits, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useColorMode } from '@vueuse/core'

const { t } = useI18n()
const colorMode = useColorMode()

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  initialPrompt: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:isOpen', 'save'])

const promptText = ref(props.initialPrompt)

// 根据当前主题设置 Monaco 编辑器主题
const monacoTheme = computed(() => {
  const mode = colorMode.value
  if (mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    return 'vs-dark'
  }
  return 'vs'
})

// 监听 initialPrompt 的变化
watch(
  () => props.initialPrompt,
  newPrompt => {
    promptText.value = newPrompt
  },
)

const handleSave = () => {
  emit('save', promptText.value)
  emit('update:isOpen', false)
}

const handleCancel = () => {
  promptText.value = props.initialPrompt
  emit('update:isOpen', false)
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="val => emit('update:isOpen', val)">
    <DialogContent class="sm:max-w-[900px] max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{{ t('chat.promptEditor.title') }}</DialogTitle>
      </DialogHeader>
      <div class="py-4 flex-1 min-h-0">
        <MonacoEditor
          v-model="promptText"
          language="markdown"
          :theme="monacoTheme"
          height="500px"
          :options="{
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            fontSize: 14,
            tabSize: 2,
            automaticLayout: true,
          }"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="handleCancel">{{
          t('common.cancel')
        }}</Button>
        <Button @click="handleSave">{{ t('common.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
