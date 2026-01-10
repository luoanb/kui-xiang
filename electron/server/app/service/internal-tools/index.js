const fs = require('fs')
const path = require('path')

/**
 * 内部工具加载器
 * 自动加载 internal-tools 文件夹中的所有工具
 * 文件夹组织：file/read.js → internal_file_read
 */
class InternalToolLoader {
  constructor(ctx) {
    this.ctx = ctx
    this.toolsDir = __dirname
    this.tools = new Map()
    this.groups = new Map() // 分组映射表
  }

  /**
   * 加载所有内部工具
   * @returns {Map} 工具映射表
   */
  loadAllTools() {
    try {
      // 确保工具目录存在
      if (!fs.existsSync(this.toolsDir)) {
        this.ctx.logger.warn(`内部工具目录不存在: ${this.toolsDir}`)
        return this.tools
      }

      // 递归加载所有工具文件
      this.loadToolsFromDirectory(this.toolsDir)

      this.ctx.logger.info(`[InternalToolLoader] 成功加载 ${this.tools.size} 个内部工具`)
      return this.tools
    } catch (error) {
      this.ctx.logger.error('[InternalToolLoader] 加载内部工具失败:', error)
      return this.tools
    }
  }

  /**
   * 递归加载目录中的工具
   * @param {string} dirPath 目录路径
   * @param {string|null} group 分组名称
   */
  loadToolsFromDirectory(dirPath, group = null) {
    const files = fs.readdirSync(dirPath)
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        // 如果是目录，递归加载子目录
        // 目录名作为分组名（如 file、code、system）
        this.loadToolsFromDirectory(fullPath, file)
      } else if (file.endsWith('.js') && file !== 'index.js' && !file.startsWith('.')) {
        // 如果是 .js 文件，加载工具
        try {
          this.loadToolFile(fullPath, group)
        } catch (error) {
          this.ctx.logger.error(`[InternalToolLoader] 加载工具文件 ${file} 失败:`, error)
        }
      }
    }
  }

  /**
   * 加载单个工具文件
   * @param {string} filePath 工具文件路径
   * @param {string|null} group 分组名称
   */
  loadToolFile(filePath, group = null) {
    // 动态加载工具模块
    const toolModule = require(filePath)
    
    // 验证工具格式
    if (!toolModule || !toolModule.name || !toolModule.handler) {
      throw new Error(`工具文件 ${filePath} 格式不正确`)
    }

    // 组合完整的工具名称：internal_{group}_{name}
    const fullToolName = group ? `internal_${group}_${toolModule.name}` : `internal_${toolModule.name}`

    // 标记为内部工具
    const tool = {
      ...toolModule,
      name: fullToolName, // 使用组合后的完整名称
      metadata: {
        ...toolModule.metadata,
        type: 'internal',
        source: filePath,
        group, // 分组名
        originalName: toolModule.name, // 原始工具名
      },
    }

    // 注册工具
    this.tools.set(fullToolName, tool)
    
    // 添加到分组
    if (group) {
      if (!this.groups.has(group)) {
        this.groups.set(group, [])
      }
      this.groups.get(group).push(fullToolName)
    }
    
    this.ctx.logger.info(`[InternalToolLoader] 已加载工具: ${fullToolName} (分组: ${group || 'default'})`)
  }

  /**
   * 获取所有工具列表
   * @returns {Array} 工具列表
   */
  getTools() {
    const tools = []
    for (const [name, tool] of this.tools.entries()) {
      tools.push({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        metadata: tool.metadata,
      })
    }
    return tools
  }

  /**
   * 获取指定工具
   * @param {string} toolName 工具名称
   * @returns {Object|null} 工具对象
   */
  getTool(toolName) {
    return this.tools.get(toolName)
  }

  /**
   * 调用指定工具
   * @param {string} toolName 工具名称
   * @param {Object} args 工具参数
   * @returns {Promise<Object>} 工具执行结果
   */
  async callTool(toolName, args) {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`内部工具 ${toolName} 不存在`)
    }

    try {
      this.ctx.logger.info(`[InternalToolLoader] 调用内部工具: ${toolName}`, args)
      const result = await tool.handler(args, this.ctx)
      this.ctx.logger.info(`[InternalToolLoader] 内部工具 ${toolName} 执行成功`)
      return result
    } catch (error) {
      this.ctx.logger.error(`[InternalToolLoader] 内部工具 ${toolName} 执行失败:`, error)
      throw error
    }
  }

  /**
   * 重新加载所有工具
   * @returns {Map} 工具映射表
   */
  reload() {
    this.tools.clear()
    return this.loadAllTools()
  }
}

module.exports = InternalToolLoader
