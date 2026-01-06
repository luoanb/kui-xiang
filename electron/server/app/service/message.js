const { Service } = require('egg')

class MessageService extends Service {
  /**
   * 更新会话的时间戳
   * @param {number} sessionId - 会话ID
   */
  async updateSessionTimestamp(sessionId) {
    const { ctx } = this
    try {
      const session = await ctx.model.ChatSession.findByPk(sessionId)
      if (session) {
        await session.update({ updated_at: new Date() })
      }
    } catch (error) {
      ctx.logger.error('[message_service] 更新会话时间戳失败:', error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 验证会话是否存在
   * @param {number} sessionId - 会话ID
   * @returns {Promise<Object>} 会话对象
   */
  async validateSession(sessionId) {
    const { ctx } = this
    const session = await ctx.model.ChatSession.findByPk(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }
    return session
  }

  /**
   * 创建消息
   * @param {Object} data - 消息数据
   * @param {number} data.sessionId - 会话ID
   * @param {string} data.uid - 用户ID
   * @param {string} data.role - 角色(user/assistant/system)
   * @param {string} data.content - 消息内容
   * @param {string} data.model - 模型名称（可选）
   * @param {boolean} data.isRoundEnd - 是否对话轮结束（可选，默认false）
   * @returns {Promise<Object>} Message 对象
   */
  async create(data) {
    const { ctx } = this
    const { sessionId, uid, role, content, model, isRoundEnd = false } = data

    // 参数验证（content 可以为空字符串，用于流式响应开始时创建占位消息）
    if (!uid || !role || content === undefined || content === null || !sessionId) {
      throw new Error('参数不完整')
    }

    // 验证角色是否合法
    if (!['user', 'assistant', 'system'].includes(role)) {
      throw new Error('无效的角色')
    }

    // 验证会话是否存在
    await this.validateSession(sessionId)

    try {
      const message = await ctx.model.Message.create({
        session_id: sessionId,
        uid,
        role,
        content,
        model: model || null,
        is_round_end: isRoundEnd,
        created_at: new Date(),
        updated_at: new Date(),
      })

      // 更新会话时间戳
      await this.updateSessionTimestamp(sessionId)

      console.log('[message_service]', '创建消息成功:', message.id)
      return message
    } catch (error) {
      ctx.logger.error('[message_service] 创建消息失败:', error)
      throw new Error('创建消息失败: ' + error.message)
    }
  }

  /**
   * 更新消息
   * @param {number} id - 消息ID
   * @param {Object} data - 更新数据
   * @param {string} data.content - 消息内容（可选）
   * @param {string} data.model - 模型名称（可选）
   * @returns {Promise<Object>} 更新后的 Message 对象
   */
  async update(id, data) {
    const { ctx } = this
    const { content, model } = data

    if (!id) {
      throw new Error('消息ID不能为空')
    }

    try {
      const message = await ctx.model.Message.findByPk(id)
      if (!message) {
        throw new Error('消息不存在')
      }

      const updateData = {
        updated_at: new Date(),
      }

      if (content !== undefined) {
        updateData.content = content
      }
      if (model !== undefined) {
        updateData.model = model
      }

      await message.update(updateData)

      // 更新会话时间戳
      await this.updateSessionTimestamp(message.session_id)

      console.log('[message_service]', '更新消息成功:', id)
      return message
    } catch (error) {
      ctx.logger.error('[message_service] 更新消息失败:', error)
      throw new Error('更新消息失败: ' + error.message)
    }
  }

  /**
   * 追加消息内容（流式响应）
   * @param {number} id - 消息ID
   * @param {string} content - 要追加的内容
   * @returns {Promise<Object>} 更新后的 Message 对象
   */
  async append(id, content) {
    const { ctx } = this

    if (!id || !content) {
      throw new Error('消息ID和内容不能为空')
    }

    try {
      const message = await ctx.model.Message.findByPk(id)
      if (!message) {
        throw new Error('消息不存在')
      }

      message.content += content
      message.updated_at = new Date()
      await message.save()

      // 更新会话时间戳
      await this.updateSessionTimestamp(message.session_id)

      console.log('[message_service]', '追加消息内容成功:', id)
      return message
    } catch (error) {
      ctx.logger.error('[message_service] 追加消息内容失败:', error)
      throw new Error('追加消息内容失败: ' + error.message)
    }
  }

  /**
   * 删除消息（软删除）
   * @param {number} id - 消息ID
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(id) {
    const { ctx } = this

    if (!id) {
      throw new Error('消息ID不能为空')
    }

    try {
      const message = await ctx.model.Message.findByPk(id)
      if (!message) {
        throw new Error('消息不存在')
      }

      const sessionId = message.session_id
      await message.destroy()

      // 更新会话时间戳
      await this.updateSessionTimestamp(sessionId)

      console.log('[message_service]', '删除消息成功:', id)
      return true
    } catch (error) {
      ctx.logger.error('[message_service] 删除消息失败:', error)
      throw new Error('删除消息失败: ' + error.message)
    }
  }

  /**
   * 切换消息的对话轮结束标记
   * @param {number} id - 消息ID
   * @returns {Promise<Object>} 更新后的 Message 对象
   */
  async toggleRoundEnd(id) {
    const { ctx } = this

    if (!id) {
      throw new Error('消息ID不能为空')
    }

    try {
      const message = await ctx.model.Message.findByPk(id)
      if (!message) {
        throw new Error('消息不存在')
      }

      // 切换 is_round_end 值
      message.is_round_end = !message.is_round_end
      message.updated_at = new Date()
      await message.save()

      // 更新会话时间戳
      await this.updateSessionTimestamp(message.session_id)

      console.log('[message_service]', '切换对话轮结束标记成功:', id, 'is_round_end:', message.is_round_end)
      return message
    } catch (error) {
      ctx.logger.error('[message_service] 切换对话轮结束标记失败:', error)
      throw new Error('切换对话轮结束标记失败: ' + error.message)
    }
  }

  /**
   * 根据ID获取消息
   * @param {number} id - 消息ID
   * @returns {Promise<Object>} Message 对象
   */
  async getById(id) {
    const { ctx } = this

    if (!id) {
      throw new Error('消息ID不能为空')
    }

    try {
      const message = await ctx.model.Message.findByPk(id)
      if (!message) {
        throw new Error('消息不存在')
      }
      return message
    } catch (error) {
      ctx.logger.error('[message_service] 获取消息失败:', error)
      throw new Error('获取消息失败: ' + error.message)
    }
  }

  /**
   * 获取会话消息列表（完整历史）
   * @param {number} sessionId - 会话ID
   * @param {Object} options - 查询选项
   * @param {number} options.page - 页码（默认1）
   * @param {number} options.pageSize - 每页数量（默认20）
   * @param {string} options.role - 角色过滤（可选）
   * @param {string} options.order - 排序方式（ASC/DESC，默认ASC）
   * @returns {Promise<Object>} { total, page, pageSize, data: Message[] }
   */
  async getBySession(sessionId, options = {}) {
    const { ctx } = this
    const { page = 1, pageSize = 20, role, order = 'ASC' } = options

    if (!sessionId) {
      throw new Error('会话ID不能为空')
    }

    // 验证会话是否存在
    await this.validateSession(sessionId)

    try {
      const offset = (page - 1) * pageSize

      const where = {
        session_id: sessionId,
      }

      if (role) {
        where.role = role
      }

      const { count, rows } = await ctx.model.Message.findAndCountAll({
        where,
        order: [['created_at', order.toUpperCase()]],
        offset,
        limit: pageSize,
      })

      return {
        total: count,
        page,
        pageSize,
        data: rows,
      }
    } catch (error) {
      ctx.logger.error('[message_service] 获取会话消息列表失败:', error)
      throw new Error('获取会话消息列表失败: ' + error.message)
    }
  }

  /**
   * 获取会话消息（用于模型调用）- 只取到最近一条 is_round_end = true 的消息为止
   * @param {number} sessionId - 会话ID
   * @param {Object} options - 查询选项
   * @param {number} options.page - 页码（默认1，通常不使用）
   * @param {number} options.pageSize - 每页数量（默认不限制）
   * @param {string} options.role - 角色过滤（可选）
   * @param {string} options.order - 排序方式（ASC/DESC，默认ASC）
   * @returns {Promise<Object>} { total, page, pageSize, data: Message[] }
   */
  async getBySessionForModel(sessionId, options = {}) {
    const { ctx } = this
    const { page = 1, pageSize = 10000, role, order = 'ASC' } = options

    if (!sessionId) {
      throw new Error('会话ID不能为空')
    }

    // 验证会话是否存在
    await this.validateSession(sessionId)

    try {
      const where = {
        session_id: sessionId,
      }

      if (role) {
        where.role = role
      }

      // 查询所有消息（按创建时间排序）
      const allMessages = await ctx.model.Message.findAll({
        where,
        order: [['created_at', order.toUpperCase()]],
      })

      console.log('[message_service] getBySessionForModel 查询到的所有消息:', {
        total: allMessages.length,
        messages: allMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content?.substring(0, 30) || '(empty)',
          isRoundEnd: msg.is_round_end
        }))
      })

      // 应用分页
      const offset = (page - 1) * pageSize
      const paginatedMessages = allMessages.slice(offset, offset + pageSize)

      console.log('[message_service] 获取模型消息:', {
        sessionId,
        total: allMessages.length,
        returned: paginatedMessages.length,
      })

      return {
        total: allMessages.length,
        page,
        pageSize,
        data: paginatedMessages,
      }
    } catch (error) {
      ctx.logger.error('[message_service] 获取模型消息失败:', error)
      throw new Error('获取模型消息失败: ' + error.message)
    }
  }

  /**
   * 获取会话最新消息
   * @param {number} sessionId - 会话ID
   * @param {string} role - 角色过滤（可选）
   * @returns {Promise<Object|null>} Message 对象或 null
   */
  async getLatestBySession(sessionId, role) {
    const { ctx } = this

    if (!sessionId) {
      throw new Error('会话ID不能为空')
    }

    try {
      const where = {
        session_id: sessionId,
      }

      if (role) {
        where.role = role
      }

      const message = await ctx.model.Message.findOne({
        where,
        order: [['created_at', 'DESC']],
      })

      return message
    } catch (error) {
      ctx.logger.error('[message_service] 获取最新消息失败:', error)
      throw new Error('获取最新消息失败: ' + error.message)
    }
  }

  /**
   * 转换为模型所需格式（去除 reasoning_content 标签，合并相同角色）
   * @param {Array} messages - 消息数组
   * @returns {Array} 转换后的消息数组 { role, content }[]
   */
  toModelMsg(messages) {
    console.log('[message_service] toModelMsg 输入消息数量:', messages?.length)
    
    if (!messages || messages.length === 0) {
      console.log('[message_service] toModelMsg 消息为空，返回空数组')
      return []
    }

    console.log('[message_service] toModelMsg 原始消息摘要:', messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content?.substring(0, 30) || '(empty)',
      isRoundEnd: msg.is_round_end
    })))

    // 从最新消息往前查找，找到第一条 is_round_end = true 的消息
    let startIndex = 0
    for (let i = messages.length - 1; i >= 0; i--) {
      console.log('[message_service] toModelMsg 检查消息', i, ':', {
        id: messages[i].id,
        role: messages[i].role,
        isRoundEnd: messages[i].is_round_end,
        content: messages[i].content?.substring(0, 30) || '(empty)'
      })
      if (messages[i].is_round_end) {
        startIndex = i + 1  // 从下一条开始，不包含当前这条
        console.log('[message_service] toModelMsg 找到 is_round_end=true 的消息，从下一条开始，索引:', startIndex)
        break
      }
    }

    // 截取从该消息开始到最新的所有消息
    const filteredMessages = messages.slice(startIndex)

    console.log('[message_service] toModelMsg 截取后的消息:', {
      startIndex,
      filteredCount: filteredMessages.length,
      filteredMessages: filteredMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content?.substring(0, 30) || '(empty)',
        isRoundEnd: msg.is_round_end
      }))
    })

    const mergedMessages = []
    let currentMessage = { ...filteredMessages[0] }

    // 去除第一条消息的 reasoning_content
    if (typeof currentMessage.reasoning_content !== 'undefined') {
      delete currentMessage.reasoning_content
    }

    // 去除 content 中的 reasoning_content 标签
    if (currentMessage.content) {
      currentMessage.content = currentMessage.content
        .replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/g, '')
        .trim()
    }

    for (let i = 1; i < filteredMessages.length; i++) {
      const msg = { ...filteredMessages[i] }

      // 去除 reasoning_content 字段
      if (typeof msg.reasoning_content !== 'undefined') {
        delete msg.reasoning_content
      }

      // 去除 content 中的 reasoning_content 标签
      if (msg.content) {
        msg.content = msg.content
          .replace(/<redacted_reasoning>[\s\S]*?<\/redacted_reasoning>/g, '')
          .trim()
      }

      // 合并相同角色的消息（deepseek 等模型不支持连续相同角色）
      if (msg.role === currentMessage.role) {
        currentMessage.content += '\n' + msg.content
      } else {
        // 如果角色不同，添加当前消息并开始新消息
        mergedMessages.push({
          role: currentMessage.role,
          content: currentMessage.content,
        })
        currentMessage = msg
      }
    }

    // 添加最后一条消息
    mergedMessages.push({
      role: currentMessage.role,
      content: currentMessage.content,
    })

    console.log('[message_service] toModelMsg 转换结果:', {
      original: messages.length,
      filtered: filteredMessages.length,
      merged: mergedMessages.length,
      mergedSummary: mergedMessages.map(msg => ({
        role: msg.role,
        content: msg.content?.substring(0, 30) || '(empty)'
      }))
    })

    return mergedMessages
  }
}

module.exports = MessageService
