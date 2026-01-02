/**
 * 团队提示词存储工具函数
 * 使用数据库存储团队提示词配置
 */

import { teamPromptApi, type TeamPrompt, type TeamPromptConfig } from '@/api/request'

// 重新导出类型，保持向后兼容
export type { TeamPrompt, TeamPromptConfig }

const STORAGE_KEY_CURRENT_ID = 'team_prompts_current_id'

/**
 * 生成随机 ID（用于前端临时标识）
 */
export function generateTeamPromptId(): string {
  return `team-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取所有团队提示词列表
 */
export async function getTeamPromptsList(): Promise<TeamPromptConfig[]> {
  try {
    const list = await teamPromptApi.getList()
    return list
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to get team prompts list:', error)
    return []
  }
}

/**
 * 保存团队提示词列表（已废弃，保留仅为兼容性）
 * @deprecated 不再需要，数据直接通过 API 保存
 */
export function saveTeamPromptsList(list: TeamPromptConfig[]): void {
  console.warn('[teamPromptsStorage] saveTeamPromptsList is deprecated, use saveTeamPromptConfig instead')
}

/**
 * 保存团队提示词配置
 */
export async function saveTeamPromptConfig(config: TeamPromptConfig): Promise<TeamPromptConfig> {
  try {
    // 如果 id 是数字字符串，说明是数据库 ID，执行更新
    // 如果 id 是自定义字符串（如 team-prompt-xxx），说明是新配置，执行创建
    const isNumericId = /^\d+$/.test(config.id)
    
    if (isNumericId) {
      // 更新现有配置
      const result = await teamPromptApi.update(parseInt(config.id), {
        title: config.title,
        prompts: config.prompts,
      })
      return result
    } else {
      // 创建新配置
      const result = await teamPromptApi.create({
        title: config.title,
        prompts: config.prompts,
      })
      // 更新本地存储的当前 ID
      if (result && result.id) {
        const currentId = getCurrentTeamPromptId()
        if (currentId === config.id) {
          setCurrentTeamPromptId(result.id)
        }
      }
      return result
    }
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to save team prompt config:', error)
    throw error
  }
}

/**
 * 加载指定 ID 的团队提示词配置
 */
export async function loadTeamPromptConfig(id: string): Promise<TeamPromptConfig | null> {
  try {
    const config = await teamPromptApi.getById(id)
    return config
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to load team prompt config:', error)
    return null
  }
}

/**
 * 删除指定 ID 的团队提示词配置
 */
export async function deleteTeamPromptConfig(id: string): Promise<void> {
  try {
    await teamPromptApi.delete(id)
    
    // 如果删除的是当前使用的配置，清除 currentID
    const currentId = getCurrentTeamPromptId()
    if (currentId === id) {
      setCurrentTeamPromptId('')
    }
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to delete team prompt config:', error)
    throw error
  }
}

/**
 * 设置当前使用的团队提示词 ID
 */
export function setCurrentTeamPromptId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, id)
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to set current team prompt id:', error)
    throw error
  }
}

/**
 * 获取当前使用的团队提示词 ID
 */
export function getCurrentTeamPromptId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_CURRENT_ID) || ''
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to get current team prompt id:', error)
    return ''
  }
}

