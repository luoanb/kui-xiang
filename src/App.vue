<script setup lang="ts">
import { onMounted, onErrorCaptured, ref } from "vue"
import { useModelStore } from "@/stores/model"
import { useEnvStore } from "@/stores/env"
import Layout from "@/components/Layout.vue"
import { useRouter } from "vue-router"
import { useColorMode } from '@vueuse/core'
import GlobalSpeechIndicator from '@/components/speech/GlobalSpeechIndicator.vue'
import { initService } from '@/services/initService'
import { toast } from '@/components/ui/toast'

// 存储环境变量
const isProd = import.meta.env.PROD

// 只在生产环境下引入 Vercel Analytics
// 使用条件导入，避免异步 setup
let Analytics = null
if (isProd) {
  // 动态导入，避免在开发环境下加载
  import('@vercel/analytics/vue').then(m => {
    Analytics = m.Analytics
  })
}
const mode = useColorMode()

const modelStore = useModelStore()
const envStore = useEnvStore()
const router = useRouter()
const isInitializing = ref(false)
const initializationError = ref<string | null>(null)

// 捕获全局错误
onErrorCaptured((err, instance, info) => {
  console.error("Vue 错误:", err)
  console.error("错误信息:", info)
  return false
})

// 刷新页面方法
function reloadPage() {
  window.location.reload()
}

onMounted(async () => {
  try {
    isInitializing.value = true
    console.log('[App_vue] 开始应用初始化...')
    
    // 使用初始化服务进行应用初始化
    await initService.initialize()
    
    console.log('[App_vue] 应用初始化完成')
    console.log('[App_vue]', `platform:`, envStore.platform)
    console.log('[App_vue]', `isweb:`, envStore.isWeb)
    
  } catch (error: any) {
    console.error('[App_vue] 应用初始化失败:', error)
    initializationError.value = error.message || '应用初始化失败'
    
    // 显示错误提示
    toast({
      title: '初始化失败',
      description: '应用初始化失败，请检查后端服务是否正常运行',
      variant: 'destructive',
    })
  } finally {
    isInitializing.value = false
  }
})
</script>

<template>
  <div class="h-full w-full overflow-hidden">
    <!-- 初始化加载状态 -->
    <div v-if="isInitializing" class="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p class="text-lg font-medium">正在初始化应用...</p>
        <p class="text-sm text-muted-foreground mt-2">等待后端服务就绪</p>
      </div>
    </div>

    <!-- 初始化错误状态 -->
    <div v-else-if="initializationError" class="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div class="max-w-md p-6 bg-card rounded-lg border shadow-lg text-center">
        <div class="text-destructive mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 class="text-xl font-bold mb-2">初始化失败</h2>
        <p class="text-muted-foreground mb-4">{{ initializationError }}</p>
        <p class="text-sm text-muted-foreground mb-6">请检查后端服务是否正常运行，然后刷新页面重试</p>
        <button 
          @click="reloadPage"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          刷新页面
        </button>
      </div>
    </div>

    <!-- 正常内容 -->
    <template v-else>
      <Layout></Layout>
      <GlobalSpeechIndicator />
    </template>
  </div>
  <!-- 只在生产环境下渲染 Vercel Analytics -->
  <Analytics v-if="isProd" mode="production" />
</template>

<style>
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo.electron:hover {
  filter: drop-shadow(0 0 2em #9feaf9);
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
