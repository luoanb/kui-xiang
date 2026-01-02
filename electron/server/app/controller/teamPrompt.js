const { Controller } = require('egg')

class TeamPromptController extends Controller {
  /**
   * 获取所有团队提示词列表
   */
  async list() {
    const { ctx } = this
    try {
      const result = await ctx.service.teamPrompt.list()
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 根据ID获取团队提示词配置
   */
  async getById() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const result = await ctx.service.teamPrompt.getById(id)
      if (!result) {
        ctx.body = ctx.helper.error('团队提示词配置不存在')
        return
      }
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 创建团队提示词配置
   */
  async create() {
    const { ctx } = this
    const config = ctx.request.body
    try {
      const result = await ctx.service.teamPrompt.create(config)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 更新团队提示词配置
   */
  async update() {
    const { ctx } = this
    const { id } = ctx.params
    const config = ctx.request.body
    try {
      const result = await ctx.service.teamPrompt.update(id, config)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 删除团队提示词配置
   */
  async delete() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const result = await ctx.service.teamPrompt.delete(id)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * Team 对话 API
   * 支持自动获取正在运行的 MCP 工具
   */
  async chat() {
    const { ctx } = this
    const { model, provider, messages, sessionId, config, context, promptConfig, enableMcp } = ctx.request.body
    const uid = ctx.request.query.uid || 'default-user'
    let ragBaseIds = []
    if(context && typeof context === 'string') {
      ragBaseIds = context.split(',')
    }
    try {
      // 如果提供了 promptConfig，将其合并到 config 中
      const mergedConfig = promptConfig ? { ...config, promptConfig } : config
      // TeamPromptService.chat 内部会处理流式响应和错误
      await ctx.service.teamPrompt.chat(
        model,
        provider,
        messages,
        sessionId,
        mergedConfig,
        enableMcp,
        null,
        ragBaseIds
      )
      // 流式响应已经在 service 层处理，这里不需要返回
    } catch (error) {
      // 如果 service 层没有处理错误，使用 streamError 处理
      ctx.helper.streamError(ctx, error, sessionId)
    }
  }
}

module.exports = TeamPromptController

