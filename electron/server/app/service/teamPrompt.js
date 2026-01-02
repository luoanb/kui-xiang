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
}

module.exports = TeamPromptService

