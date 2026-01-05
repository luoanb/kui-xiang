const { Controller } = require('egg')

class MessageController extends Controller {
  /**
   * 创建消息
   * POST /api/message
   */
  async create() {
    const { ctx } = this
    const { sessionId, uid, role, content, model, isRoundEnd } = ctx.request.body

    try {
      const message = await ctx.service.message.create({
        sessionId,
        uid,
        role,
        content,
        model,
        isRoundEnd,
      })
      ctx.body = ctx.helper.success(message)
    } catch (error) {
      ctx.logger.error('[message_controller] 创建消息失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 获取消息详情
   * GET /api/message/:id
   */
  async getById() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const message = await ctx.service.message.getById(id)
      ctx.body = ctx.helper.success(message)
    } catch (error) {
      ctx.logger.error('[message_controller] 获取消息失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 更新消息
   * PUT /api/message/:id
   */
  async update() {
    const { ctx } = this
    const { id } = ctx.params
    const { content, model } = ctx.request.body

    try {
      const message = await ctx.service.message.update(id, { content, model })
      ctx.body = ctx.helper.success(message)
    } catch (error) {
      ctx.logger.error('[message_controller] 更新消息失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 删除消息
   * DELETE /api/message/:id
   */
  async delete() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const result = await ctx.service.message.delete(id)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('[message_controller] 删除消息失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 获取会话消息列表（完整历史）
   * GET /api/message/session/:sessionId
   */
  async getBySession() {
    const { ctx } = this
    const { sessionId } = ctx.params
    const { page = 1, pageSize = 20, role, order = 'ASC' } = ctx.query

    try {
      const result = await ctx.service.message.getBySession(sessionId, {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        role,
        order,
      })
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('[message_controller] 获取会话消息列表失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 获取会话消息（用于模型调用）
   * GET /api/message/session/:sessionId/for-model
   */
  async getBySessionForModel() {
    const { ctx } = this
    const { sessionId } = ctx.params
    const { page = 1, pageSize = 10000, role, order = 'ASC' } = ctx.query

    try {
      const result = await ctx.service.message.getBySessionForModel(sessionId, {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        role,
        order,
      })
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('[message_controller] 获取模型消息失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 追加消息内容
   * POST /api/message/:id/append
   */
  async append() {
    const { ctx } = this
    const { id } = ctx.params
    const { content } = ctx.request.body

    if (!content) {
      ctx.body = ctx.helper.error('内容不能为空')
      return
    }

    try {
      const message = await ctx.service.message.append(id, content)
      ctx.body = ctx.helper.success(message)
    } catch (error) {
      ctx.logger.error('[message_controller] 追加消息内容失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 切换消息的对话轮结束标记
   * PUT /api/message/:id/toggle-round-end
   */
  async toggleRoundEnd() {
    const { ctx } = this
    const { id } = ctx.params

    try {
      const message = await ctx.service.message.toggleRoundEnd(id)
      ctx.body = ctx.helper.success(message)
    } catch (error) {
      ctx.logger.error('[message_controller] 切换对话轮结束标记失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
}

module.exports = MessageController

