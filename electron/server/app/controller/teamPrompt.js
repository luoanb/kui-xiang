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
}

module.exports = TeamPromptController

