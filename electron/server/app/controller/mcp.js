const { Controller } = require('egg');

class McpController extends Controller {
  async listAllTools() {
    const { ctx } = this

    try {
      // 获取所有已安装的 MCP 服务器
      const installedServers = await ctx.service.mcp.getInstalledServers()
      
      // 过滤出正在运行且启用的服务器
      const runningServers = installedServers.filter(server => {
        const isRunning = server.status === 'running'
        const isEnabled = server.config?.enabled !== false
        return isRunning && isEnabled
      })

      ctx.logger.info('[McpController] 正在运行的 MCP 服务器:', runningServers.map(s => s.key))

      // 获取所有正在运行的服务器的工具列表
      const allMcpTools = []
      for (const server of runningServers) {
        try {
          const serverTools = await ctx.service.mcp.getTool(server.key)
          if (serverTools && serverTools.tools && serverTools.tools.length > 0) {
            allMcpTools.push(...serverTools.tools)
            ctx.logger.info(`[McpController] 从服务器 ${server.key} 获取到 ${serverTools.tools.length} 个工具`)
          }
        } catch (error) {
          ctx.logger.error(`[McpController] 获取服务器 ${server.key} 的工具失败:`, error)
        }
      }

      // 添加内部工具
      const internalTools = ctx.service.mcp.getInternalTools()
      allMcpTools.push(...internalTools)

      ctx.logger.info(`[McpController] 总共获取到 ${allMcpTools.length} 个工具 (MCP: ${allMcpTools.length - internalTools.length}, 内部: ${internalTools.length})`)

      const res = {
        tools: allMcpTools,
        cacheVersion: ctx.service.mcp.getCacheVersion()
      }
      
      ctx.body = ctx.helper.success(res)
    } catch (error) {
      ctx.logger.error('[McpController] 获取工具列表失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  async restartServer() {
    const { ctx } = this
    try {
      const res = await ctx.service.mcp.restartServer()
      ctx.body = ctx.helper.success(res)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  async restartFilesystemServer() {
    const { ctx } = this
    try {
      const res = await ctx.service.mcp.restartFilesystemServer()
      ctx.body = ctx.helper.success(res)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  // 获取内部工具分组
  async getInternalToolGroups() {
    const { ctx } = this
    try {
      const groups = ctx.service.mcp.getInternalToolGroups()
      ctx.logger.info('[McpController] 内部工具分组:', Object.keys(groups))
      ctx.body = ctx.helper.success(groups)
    } catch (error) {
      ctx.logger.error('[McpController] 获取内部工具分组失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  // 获取README内容
  async fetchReadme() {
    const { ctx } = this
    const { url } = ctx.query
  
    try {
      if (!url) {
        ctx.body = ctx.helper.error('URL不能为空')
        return
      }
  
      const content = await ctx.service.mcp.fetchReadme(url)
      ctx.body = ctx.helper.success(content)
    } catch (error) {
      ctx.logger.error('获取README失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 添加MCP服务器
  async addServer() {
    const { ctx } = this
    const serverData = ctx.request.body
  
    try {
      if (!serverData || Object.keys(serverData).length === 0) {
        ctx.body = ctx.helper.error('服务器数据不能为空')
        return
      }
  
      const result = await ctx.service.mcp.addServer(serverData)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('添加MCP服务器失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 获取已安装的MCP服务器列表
  async getInstalledServers() {
    const { ctx } = this
    
    try {
      const servers = await ctx.service.mcp.getInstalledServers()
      ctx.body = ctx.helper.success(servers)
    } catch (error) {
      ctx.logger.error('获取已安装MCP服务器列表失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 删除MCP服务器
  async deleteServer() {
    const { ctx } = this
    const { key } = ctx.params
    
    try {
      if (!key) {
        ctx.body = ctx.helper.error('服务器标识不能为空')
        return
      }
      
      const result = await ctx.service.mcp.deleteServer(key)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error(`删除MCP服务器 ${key} 失败:`, error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 启动MCP服务器
  async startServer() {
    const { ctx } = this
    const { key } = ctx.params
    
    try {
      if (!key) {
        ctx.body = ctx.helper.error('服务器标识不能为空')
        return
      }
      
      const result = await ctx.service.mcp.startServer(key)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error(`启动MCP服务器 ${key} 失败:`, error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 停止MCP服务器
  async stopServer() {
    const { ctx } = this
    const { key } = ctx.params
    
    try {
      if (!key) {
        ctx.body = ctx.helper.error('服务器标识不能为空')
        return
      }
      
      const result = await ctx.service.mcp.stopServer(key)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error(`停止MCP服务器 ${key} 失败:`, error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
  
  // 更新MCP服务器
  async updateServer() {
    const { ctx } = this
    const serverData = ctx.request.body
    
    try {
      if (!serverData || Object.keys(serverData).length === 0) {
        ctx.body = ctx.helper.error('服务器配置不能为空')
        return
      }
      
      const result = await ctx.service.mcp.updateServer(serverData)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('更新MCP服务器失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  // AI分析README并提取配置
  async analyzeReadme() {
    const { ctx } = this
    const { readmeContent } = ctx.request.body
    
    try {
      if (!readmeContent || !readmeContent.trim()) {
        ctx.body = ctx.helper.error('README 内容不能为空')
        return
      }
      
      const config = await ctx.service.mcp.analyzeReadme(readmeContent)
      ctx.body = ctx.helper.success(config)
    } catch (error) {
      ctx.logger.error('AI分析README失败:', error)
      ctx.body = ctx.helper.error(error.message || 'AI分析失败')
    }
  }
}
module.exports = McpController;
