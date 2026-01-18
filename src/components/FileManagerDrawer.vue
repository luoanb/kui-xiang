<template>
  <Sidebar side="right" class="absolute h-[calc(100dvh-30px)]">
    <SidebarContent>
      <FileManager />
    </SidebarContent>
  </Sidebar>
</template>

<script setup lang="ts">
import { Sidebar, SidebarContent } from '@/components/ui/sidebar'
import FileManager from './FileManager.vue'
</script>
