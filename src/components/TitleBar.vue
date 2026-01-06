<script setup lang="ts">
import { useEnvStore } from "@/stores/env"
import ProjectSelector from "@/components/ProjectSelector.vue"

const envStore = useEnvStore()
</script>
<template>
  <div
    style="-webkit-app-region: drag"
    class="bg-sidebar h-[30px] flex items-center justify-between px-4 border-b text-xs font-bold"
    :class="envStore.isWeb && 'hidden'"
  >
    <ProjectSelector />
  </div>
</template>
