const { Service } = require('egg')

class TeamPromptService extends Service {
  /**
   * 获取所有团队提示词列表
   */
  async list() {
    const { ctx } = this
    try {
      const teamPrompts = await ctx.model.TeamPrompt.findAll({
        include: [
          {
            model: ctx.model.TeamPromptItem,
            as: 'items',
            required: false,
          },
        ],
        order: [['created_at', 'DESC']],
      })

      // 转换为前端需要的格式
      return teamPrompts.map(tp => ({
        id: tp.id.toString(),
        title: tp.title,
        prompts: (tp.items || []).map(item => ({
          id: item.prompt_id,
          title: item.title,
          content: item.content,
          isMain: item.is_main,
          temperature: item.temperature,
          top_p: item.top_p,
          presence_penalty: item.presence_penalty,
          frequency_penalty: item.frequency_penalty,
        })),
        createdAt: tp.created_at ? new Date(tp.created_at).getTime() : Date.now(),
        updatedAt: tp.updated_at ? new Date(tp.updated_at).getTime() : Date.now(),
      }))
    } catch (error) {
      ctx.logger.error('[TeamPromptService] 获取团队提示词列表失败:', error)
      throw new Error('获取团队提示词列表失败: ' + error.message)
    }
  }

  /**
   * 根据ID获取团队提示词配置
   */
  async getById(id) {
    const { ctx } = this
    try {
      const teamPrompt = await ctx.model.TeamPrompt.findByPk(id, {
        include: [
          {
            model: ctx.model.TeamPromptItem,
            as: 'items',
            required: false,
          },
        ],
      })

      if (!teamPrompt) {
        return null
      }

      return {
        id: teamPrompt.id.toString(),
        title: teamPrompt.title,
        prompts: (teamPrompt.items || []).map(item => ({
          id: item.prompt_id,
          title: item.title,
          content: item.content,
          isMain: item.is_main,
          temperature: item.temperature,
          top_p: item.top_p,
          presence_penalty: item.presence_penalty,
          frequency_penalty: item.frequency_penalty,
        })),
        createdAt: teamPrompt.created_at ? new Date(teamPrompt.created_at).getTime() : Date.now(),
        updatedAt: teamPrompt.updated_at ? new Date(teamPrompt.updated_at).getTime() : Date.now(),
      }
    } catch (error) {
      ctx.logger.error('[TeamPromptService] 获取团队提示词配置失败:', error)
      throw new Error('获取团队提示词配置失败: ' + error.message)
    }
  }

  /**
   * 创建团队提示词配置
   */
  async create(config) {
    const { ctx } = this
    try {
      const transaction = await ctx.model.transaction()

      try {
        // 创建团队提示词配置
        const now = new Date()
        const teamPrompt = await ctx.model.TeamPrompt.create(
          {
            title: config.title || '未命名团队提示词',
            created_at: now,
            updated_at: now,
          },
          { transaction },
        )

        // 创建提示词项
        if (config.prompts && Array.isArray(config.prompts)) {
          const items = config.prompts.map(prompt => ({
            team_prompt_id: teamPrompt.id,
            prompt_id: prompt.id,
            title: prompt.title,
            content: prompt.content,
            is_main: prompt.isMain || false,
            temperature: prompt.temperature || null,
            top_p: prompt.top_p || null,
            presence_penalty: prompt.presence_penalty || null,
            frequency_penalty: prompt.frequency_penalty || null,
            created_at: now,
            updated_at: now,
          }))

          await ctx.model.TeamPromptItem.bulkCreate(items, { transaction })
        }

        await transaction.commit()

        // 返回完整数据
        return await this.getById(teamPrompt.id)
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    } catch (error) {
      ctx.logger.error('[TeamPromptService] 创建团队提示词配置失败:', error)
      throw new Error('创建团队提示词配置失败: ' + error.message)
    }
  }

  /**
   * 更新团队提示词配置
   */
  async update(id, config) {
    const { ctx } = this
    try {
      const teamPrompt = await ctx.model.TeamPrompt.findByPk(id)
      if (!teamPrompt) {
        throw new Error('团队提示词配置不存在')
      }

      const transaction = await ctx.model.transaction()

      try {
        // 更新团队提示词配置
        await teamPrompt.update(
          {
            title: config.title || teamPrompt.title,
          },
          { transaction },
        )

        // 删除旧的提示词项
        await ctx.model.TeamPromptItem.destroy({
          where: { team_prompt_id: id },
          transaction,
        })

        // 创建新的提示词项
        if (config.prompts && Array.isArray(config.prompts)) {
          const now = new Date()
          const items = config.prompts.map(prompt => ({
            team_prompt_id: id,
            prompt_id: prompt.id,
            title: prompt.title,
            content: prompt.content,
            is_main: prompt.isMain || false,
            temperature: prompt.temperature || null,
            top_p: prompt.top_p || null,
            presence_penalty: prompt.presence_penalty || null,
            frequency_penalty: prompt.frequency_penalty || null,
            created_at: now,
            updated_at: now,
          }))

          await ctx.model.TeamPromptItem.bulkCreate(items, { transaction })
        }

        await transaction.commit()

        // 返回完整数据
        return await this.getById(id)
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    } catch (error) {
      ctx.logger.error('[TeamPromptService] 更新团队提示词配置失败:', error)
      throw new Error('更新团队提示词配置失败: ' + error.message)
    }
  }

  /**
   * 删除团队提示词配置
   */
  async delete(id) {
    const { ctx } = this
    try {
      const teamPrompt = await ctx.model.TeamPrompt.findByPk(id)
      if (!teamPrompt) {
        throw new Error('团队提示词配置不存在')
      }

      await teamPrompt.destroy()
      return { success: true }
    } catch (error) {
      ctx.logger.error('[TeamPromptService] 删除团队提示词配置失败:', error)
      throw new Error('删除团队提示词配置失败: ' + error.message)
    }
  }

  /**
   * Team 对话 API
   * @param {Object} model - 模型配置
   * @param {Object} provider - 提供商配置
   * @param {Array} messages - 消息列表
   * @param {string} sessionId - 会话ID
   * @param {Object} config - 配置
   * @param {boolean} enableMcp - 是否启用 MCP（如果为 true，自动获取所有正在运行的 MCP 工具）
   * @param {any} msgSaved - 消息保存状态
   * @param {Array} context - 知识库上下文
   */
  async chat(model, provider, messages, sessionId, config, enableMcp, msgSaved, context) {
    const { ctx } = this
    const llmService = ctx.service.llm
    let tools = null

    // 如果启用了 MCP，自动获取所有正在运行且启用的 MCP 工具
    if (enableMcp) {
      try {
        console.log('[teamPrompt_js]', '启用 MCP，开始获取正在运行的 MCP 工具');
        
        ctx.logger.info('[TeamPromptService] 启用 MCP，开始获取正在运行的 MCP 工具')
        
        // 获取所有已安装的 MCP 服务器
        const installedServers = await ctx.service.mcp.getInstalledServers()
        
        // 过滤出正在运行且启用的服务器
        const runningServers = installedServers.filter(server => {
          const isRunning = server.status === 'running'
          const isEnabled = server.config?.enabled !== false // 默认为 true，只有显式设置为 false 才禁用
          return isRunning && isEnabled
        })

        ctx.logger.info('[TeamPromptService] 找到正在运行且启用的 MCP 服务器:', runningServers.map(s => s.key))

        // 获取所有正在运行的服务器的工具列表
        const allTools = []
        for (const server of runningServers) {
          try {
            const serverTools = await ctx.service.mcp.getTool(server.key)
            if (serverTools && serverTools.tools && serverTools.tools.length > 0) {
              allTools.push(...serverTools.tools)
              ctx.logger.info(`[TeamPromptService] 从服务器 ${server.key} 获取到 ${serverTools.tools.length} 个工具`)
            }
          } catch (error) {
            ctx.logger.error(`[TeamPromptService] 获取服务器 ${server.key} 的工具失败:`, error)
            // 继续处理其他服务器，不中断流程
          }
        }

        if (allTools.length > 0) {
          tools = allTools
          ctx.logger.info(`[TeamPromptService] 总共获取到 ${allTools.length} 个 MCP 工具`)
        } else {
          ctx.logger.info('[TeamPromptService] 未找到可用的 MCP 工具')
        }
      } catch (error) {
        ctx.logger.error('[TeamPromptService] 获取 MCP 工具失败:', error)
        // MCP 获取失败不影响对话流程，继续执行
      }
    }

    // 调用 LLMService 的 chat 方法
    try {
      const result = await llmService.chat(
        model,
        provider,
        messages,
        sessionId,
        config,
        tools,
        msgSaved,
        context
      )
      return result
    } catch (error) {
      ctx.logger.error('[TeamPromptService] Team 对话失败:', error)
      throw error
    }
  }
}

module.exports = TeamPromptService

