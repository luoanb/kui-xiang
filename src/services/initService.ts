import { healthApi } from '@/api/request'
import { useModelStore } from '@/stores/model'
import { useEnvStore } from '@/stores/env'

/**
 * 应用初始化服务
 * 负责协调前后端启动顺序，确保后端服务就绪后再进行前端初始化
 */
class InitService {
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * 初始化应用
   * 1. 等待后端服务就绪
   * 2. 初始化环境变量
   * 3. 初始化模型配置
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[init_service] 应用已初始化')
      return
    }

    if (this.initializationPromise) {
      console.log('[init_service] 初始化正在进行中，等待完成...')
      return this.initializationPromise
    }

    this.initializationPromise = this._initialize()
    return this.initializationPromise
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('[init_service] 开始应用初始化...')

      // 1. 等待后端服务就绪
      const isBackendReady = await this.waitForBackend()
      if (!isBackendReady) {
        console.error('[init_service] 后端服务未就绪，应用初始化失败')
        throw new Error('后端服务未就绪')
      }

      console.log('[init_service] 后端服务已就绪')

      // 2. 初始化环境变量
      await this.initEnvironment()

      // 3. 初始化模型配置
      await this.initModelConfig()

      this.isInitialized = true
      console.log('[init_service] 应用初始化完成')
    } catch (error) {
      console.error('[init_service] 应用初始化失败:', error)
      throw error
    } finally {
      this.initializationPromise = null
    }
  }

  /**
   * 等待后端服务就绪
   */
  private async waitForBackend(): Promise<boolean> {
    console.log('[init_service] 等待后端服务就绪...')
    
    try {
      // 使用healthApi中的waitForReady方法
      const isReady = await healthApi.waitForReady(30, 1000)
      return isReady
    } catch (error) {
      console.error('[init_service] 等待后端服务时出错:', error)
      return false
    }
  }

  /**
   * 初始化环境变量
   */
  private async initEnvironment(): Promise<void> {
    console.log('[init_service] 初始化环境变量...')
    const envStore = useEnvStore()
    
    try {
      await envStore.initEnv()
      console.log('[init_service] 环境变量初始化完成')
      console.log('[init_service]', `platform:`, envStore.platform)
      console.log('[init_service]', `isweb:`, envStore.isWeb)
    } catch (error) {
      console.error('[init_service] 环境变量初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化模型配置
   */
  private async initModelConfig(): Promise<void> {
    console.log('[init_service] 初始化模型配置...')
    const modelStore = useModelStore()
    
    try {
      // 使用store中的方法初始化模型配置
      await modelStore.fetchProvidersAndModels()
      console.log('[init_service] 模型配置初始化完成')
    } catch (error) {
      console.error('[init_service] 模型配置初始化失败:', error)
      // 这里不抛出错误，因为模型配置初始化失败不应阻止应用启动
      // 用户可以在应用内手动重试
    }
  }

  /**
   * 检查应用是否已初始化
   */
  isAppInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * 重置初始化状态（用于开发调试）
   */
  reset(): void {
    this.isInitialized = false
    this.initializationPromise = null
    console.log('[init_service] 初始化状态已重置')
  }
}

// 导出单例实例
export const initService = new InitService()