/**
 * 团队提示词存储工具函数
 * 使用 localStorage 存储团队提示词配置
 */

export interface TeamPrompt {
  id: string;
  title: string;
  content: string;
  isMain: boolean;
  temperature?: number[];
  top_p?: number[];
  presence_penalty?: number[];
  frequency_penalty?: number[];
}

export interface TeamPromptConfig {
  id: string; // 随机生成的 ID
  title: string; // 对话名称
  prompts: TeamPrompt[]; // 提示词数组
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

const STORAGE_KEY_LIST = 'team_prompts_list';
const STORAGE_KEY_CURRENT_ID = 'team_prompts_current_id';

/**
 * 生成随机 ID
 */
export function generateTeamPromptId(): string {
  return `team-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取所有团队提示词列表
 */
export function getTeamPromptsList(): TeamPromptConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_LIST);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to get team prompts list:', error);
    return [];
  }
}

/**
 * 保存团队提示词列表
 */
export function saveTeamPromptsList(list: TeamPromptConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to save team prompts list:', error);
    throw error;
  }
}

/**
 * 保存团队提示词配置
 */
export function saveTeamPromptConfig(config: TeamPromptConfig): void {
  try {
    const list = getTeamPromptsList();
    const index = list.findIndex(item => item.id === config.id);
    
    if (index >= 0) {
      // 更新现有配置，保留原始创建时间
      list[index] = {
        ...config,
        createdAt: list[index].createdAt, // 保留原始创建时间
        updatedAt: Date.now(),
      };
    } else {
      // 添加新配置
      list.push(config);
    }
    
    saveTeamPromptsList(list);
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to save team prompt config:', error);
    throw error;
  }
}

/**
 * 加载指定 ID 的团队提示词配置
 */
export function loadTeamPromptConfig(id: string): TeamPromptConfig | null {
  try {
    const list = getTeamPromptsList();
    return list.find(item => item.id === id) || null;
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to load team prompt config:', error);
    return null;
  }
}

/**
 * 删除指定 ID 的团队提示词配置
 */
export function deleteTeamPromptConfig(id: string): void {
  try {
    const list = getTeamPromptsList();
    const filtered = list.filter(item => item.id !== id);
    saveTeamPromptsList(filtered);
    
    // 如果删除的是当前使用的配置，清除 currentID
    const currentId = getCurrentTeamPromptId();
    if (currentId === id) {
      setCurrentTeamPromptId('');
    }
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to delete team prompt config:', error);
    throw error;
  }
}

/**
 * 设置当前使用的团队提示词 ID
 */
export function setCurrentTeamPromptId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, id);
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to set current team prompt id:', error);
    throw error;
  }
}

/**
 * 获取当前使用的团队提示词 ID
 */
export function getCurrentTeamPromptId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_CURRENT_ID) || '';
  } catch (error) {
    console.error('[teamPromptsStorage] Failed to get current team prompt id:', error);
    return '';
  }
}

