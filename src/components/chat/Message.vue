<script setup lang="ts">
import MessageItem from "@/components/chat/MessageItem.vue"

const props = defineProps<{
  messages: Array<{ 
    id?: number
    role: string
    content: string
    reasoning_content?: string
    is_round_end?: boolean
  }>
}>()
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex-1 leading-8">
      <MessageItem
        v-for="(message, index) in messages"
        :key="message.id || index"
        :message="message.content"
        :messageReasoning="message.reasoning_content || ''"
        :role="message.role"
        :messageId="message.id"
        v-model:isRoundEnd="message.is_round_end"
      />
    </div>
    <!-- {{ messages[messages.length - 1].reasoning_content }} -->
  </div>
</template>
