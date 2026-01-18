const { Service } = require('egg')
const { type } = require('os')

module.exports = class ToolsService extends Service {
  constructor(ctx) {
    super(ctx)
    this.tools = [
      //   {
      //     "type": "function",
      //     "function": {
      //         "name": "get_weather",
      //         "description": "Get weather of an location, the user shoud supply a location first",
      //         "parameters": {
      //             "type": "object",
      //             "properties": {
      //                 "location": {
      //                     "type": "string",
      //                     "description": "The city and state, e.g. San Francisco, CA",
      //                 }
      //             },
      //             "required": ["location"]
      //         },
      //     }
      // },
    ]
  }

  addTool(name, tool) {
    this.tools[name] = tool
  }

  // 解析工具名称，提取服务器键和原始工具名
  
  parseMcpToolName(name) {
    if (name.startsWith('mcp_')) {
      const parts = name.split('_')
      if (parts.length >= 3) {
        const serverKey = parts[1]
        // 原始工具名可能包含下划线，需要重新组合
        const originalName = parts.slice(2).join('_')
        return { serverKey, originalName }
      }
    }
    return { serverKey: null, originalName: name }
  }

  async runTools(name, args) {
    console.log('[tools_js]', 'run tools', name, args)

    // 检查是否是内部工具
    if (name.startsWith('internal_')) {
      try {
        this.ctx.logger.info(`[ToolsService] 调用内部工具: ${name}`, args)
        const result = await this.ctx.service.mcp.callInternalTool(name, args)
        this.ctx.logger.info(`[ToolsService] 内部工具 ${name} 执行成功`)
        return result
      } catch (error) {
        this.ctx.logger.error(`[ToolsService] 内部工具 ${name} 调用失败:`, error)
        return {
          error: true,
          message: `内部工具调用失败: ${error.message}`,
          toolName: name,
          toolArgs: args,
        }
      }
    }

    // 检查是否是外部 MCP 工具
    if (name.startsWith('mcp_')) {
      try {
        const { serverKey, originalName } = this.parseMcpToolName(name)

        // 调用MCP服务的工具
        if (serverKey) {
          this.ctx.logger.info(`[ToolsService] 调用外部 MCP 工具: ${name}`, args)
          const result = await this.ctx.service.mcp.callTool(
            serverKey,
            originalName,
            args,
          )
          this.ctx.logger.info(`[ToolsService] 外部 MCP 工具 ${name} 执行成功`)
          return result
        }
      } catch (error) {
        this.ctx.logger.error(`[ToolsService] 外部 MCP 工具 ${name} 调用失败:`, error)
        return {
          error: true,
          message: `外部 MCP 工具调用失败: ${error.message}`,
          toolName: name,
          toolArgs: args,
        }
      }
    }

    // 未知工具类型
    this.ctx.logger.error(`[ToolsService] 未知的工具类型: ${name}`)
    return {
      error: true,
      message: `未知的工具: ${name}`,
      toolName: name,
    }
  }

  async getTools() {
    try {
      // 确保 MCP 服务已初始化（包括内部工具）
      await this.ctx.service.mcp.ensureInitialized()
      
      // 获取所有已安装的 MCP 服务器
      const installedServers = await this.ctx.service.mcp.getInstalledServers()
      
      // 过滤出正在运行且启用的服务器
      const runningServers = installedServers.filter(server => {
        const isRunning = server.status === 'running'
        const isEnabled = (server.config && server.config.enabled !== false)
        return isRunning && isEnabled
      })

      this.ctx.logger.info('[ToolsService] 正在运行的 MCP 服务器:', runningServers.map(s => s.key))

      // 获取所有正在运行的服务器的工具列表
      const allMcpTools = []
      for (const server of runningServers) {
        try {
          const serverTools = await this.ctx.service.mcp.getTool(server.key)
          if (serverTools && serverTools.tools && serverTools.tools.length > 0) {
            allMcpTools.push(...serverTools.tools)
            this.ctx.logger.info(`[ToolsService] 从服务器 ${server.key} 获取到 ${serverTools.tools.length} 个工具`)
          }
        } catch (error) {
          this.ctx.logger.error(`[ToolsService] 获取服务器 ${server.key} 的工具失败:`, error)
        }
      }

      // 添加内部工具
      const internalTools = this.ctx.service.mcp.getInternalTools()
      allMcpTools.push(...internalTools)

      this.ctx.logger.info(`[ToolsService] 总共获取到 ${allMcpTools.length} 个工具 (MCP: ${allMcpTools.length - internalTools.length}, 内部: ${internalTools.length})`)

      const openaiTools = JSON.parse(
        JSON.stringify(this.convertMcpToolsToOpenaiTools(allMcpTools)),
      )
      
      return [...this.tools, ...openaiTools]
    } catch (error) {
      this.ctx.logger.error('[ToolsService] 获取工具列表失败:', error)
      console.error('[ToolsService] 获取工具列表失败:', error)
      return this.tools // 如果 MCP 工具获取失败，至少返回内置工具
    }
  }

  convertMcpToolsToOpenaiTools(mcpTools) {
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: `${tool.name}`,
        description: tool.description,
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
        },
      },
    }))
  }
}
