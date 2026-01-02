const Transform = require('stream').Transform
const { Service } = require('egg')
const OpenAI = require('openai')
const ollamaBaseUrl = 'http://127.0.0.1:11434'
const ToolCallMerger = require('./ToolCallMerger')
const MCP_STATE = require('./ToolCallMerger').MCP_STATE

class ChatService extends Service {
  constructor(ctx) {
    super(ctx)
    this.accumulatedContent = ''
    this.currentToolCall = {}
    this.toolCallArguments = ''
    this.cachedParams = null
  }

  /**
   * 发送消息到大模型
   * @param {string} messages - 聊天内容
   * @param {string} sessionId - 会话ID
   * @reurns {Promise<string>} - 返回聊天结果
   */
  async sendMessageLocal(model, messages, sessionId, promptConfig) {
    this.cachedParams = { model, messages, sessionId }
    const { ctx } = this
    try {
      const openai = new OpenAI({
        baseURL: `${ollamaBaseUrl}/v1`,
        apiKey: 'dummy',
      })

      const requestParams = {
        model: model.id,
        messages,
        stream: true,
      }

      // 如果提供了 promptConfig，添加到请求参数中
      if (promptConfig) {
        if (promptConfig.temperature !== undefined) {
          requestParams.temperature = promptConfig.temperature
        }
        if (promptConfig.top_p !== undefined) {
          requestParams.top_p = promptConfig.top_p
        }
        if (promptConfig.presence_penalty !== undefined) {
          requestParams.presence_penalty = promptConfig.presence_penalty
        }
        if (promptConfig.frequency_penalty !== undefined) {
          requestParams.frequency_penalty = promptConfig.frequency_penalty
        }
      }
      const stream = await openai.chat.completions.create(requestParams)
      await this.handleStream(
        stream,
        ctx,
        messages,
        sessionId,
        model,
      )
    } catch (error) {
      ctx.logger.error('Chat service error:', error)
      await this.handleStreamError(
        new Error(ctx.__('chat.service_error') + error.message),
        ctx,
      )
    }
  }
  
  async handleStream(
    stream,
    ctx,
    messages,
    sessionId,
    model,
    loopArgs,
    msgSaved,
  ) {
    console.log('[chat_js]', 'handleStream')
    if (!msgSaved) {
      // 保存用户最后一条消息
      await this.saveMsg(
        'default-user',
        messages[messages.length - 1].role,
        messages[messages.length - 1].content,
        sessionId,
      )
    }
    ctx.set({
      'Content-Type': 'text/event-stream;charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    ctx.res.statusCode = 200
    let assistantMessage = ''
    let hasEnded = false

    try {
      const toolCallMerger = new ToolCallMerger()
      for await (const chunk of stream) {
        // 检查响应是否已结束
        if (ctx.res.writableEnded) {
          break
        }
        if(!chunk.choices || !chunk.choices[0] || !chunk.choices[0].delta) {
          continue
        }
        const tool_calls = toolCallMerger.handleChunk(chunk)
        if (tool_calls) {
          console.log('[chat_js]', '✅ tool_calls 完整结果：', tool_calls)
          // 可以 return / 推送前端 / 执行函数调用
          const toolCallRes = await this.handleRunToolCall(tool_calls)
          const toolSaveRes = await this.sendAndSaveToolCall(
            toolCallRes,
            sessionId,
            msgSaved,
          )
          
          // 确保当前响应已正确结束
          if (!ctx.res.writableEnded) {
            ctx.res.end()
            hasEnded = true
          }
          
          // 使用更新后的消息重新发起对话
          ctx.logger.info('工具调用完成，重新发起对话')
          const { model, provider, messages, config } = loopArgs
          // todo，重新查询最新消息
          messages.push({
            role: 'assistant',
            content: toolSaveRes.join('\n'),
          })
          await ctx.service.llm.chat(
            model,
            provider,
            messages,
            sessionId,
            config,
            [],
            msgSaved,
          )
          return
        }
        if(chunk.choices[0].delta.reasoning) {
          chunk.choices[0].delta.reasoning_content = chunk.choices[0].delta.reasoning
        }
        if(chunk.choices[0].delta.reasoning_content) {
          ctx.res.write(JSON.stringify(chunk) + '\n')
          continue
        }
        if (!chunk.choices[0].delta.content) {
          continue
        }
        ctx.res.write(JSON.stringify(chunk) + '\n')
        const content =
          (chunk.choices[0] &&
            chunk.choices[0].delta &&
            chunk.choices[0].delta.content) ||
          ''
        if (content) {
          assistantMessage += content
        }
        // todo: 用量信息
        // todo: session 会话信息
      }

      // 检测状态1：参数构建中 - 检查是否有未完成的tool_call
      if (toolCallMerger.hasIncompleteToolCalls()) {
        console.log('[chat_js]', '⚠️ 检测到未完成的tool_call（状态1：参数构建中）')
        
        // 尝试修复并获取tool_calls
        const incompleteToolCalls = toolCallMerger.tryGetMergedToolCalls()
        
        if (incompleteToolCalls) {
          console.log('[chat_js]', '✅ 成功修复未完成的tool_call，继续执行')
          try {
            // 执行修复后的tool_call
            const toolCallRes = await this.handleRunToolCall(incompleteToolCalls)
            const toolSaveRes = await this.sendAndSaveToolCall(
              toolCallRes,
              sessionId,
              msgSaved,
            )
            
            // 确保当前响应已正确结束
            if (!ctx.res.writableEnded) {
              ctx.res.end()
              hasEnded = true
            }
            
            // 使用更新后的消息重新发起对话（在新的请求中）
            ctx.logger.info('工具调用完成，将在下次对话时继续处理')
            // 注意：不在当前响应中继续，而是保存状态，让下次对话时自动恢复
            // 这样可以避免响应混乱和loading状态丢失
            const { model, provider, messages, config } = loopArgs
            messages.push({
              role: 'assistant',
              content: toolSaveRes.join('\n'),
            })
            // 保存消息以便下次对话时自动恢复
            await this.saveMsg(
              'default-user',
              'assistant',
              toolSaveRes.join('\n'),
              sessionId,
            )
            return
          } catch (error) {
            ctx.logger.error('[chat_js] 执行修复后的tool_call失败:', error)
            // 如果执行失败，保存未完成状态
            await this.saveIncompleteMcpState(
              sessionId,
              MCP_STATE.BUILDING_PARAMS,
              toolCallMerger.getIncompleteToolCalls(),
              msgSaved,
            )
          }
        } else {
          // 无法修复，保存未完成状态
          console.log('[chat_js]', '❌ 无法修复未完成的tool_call，保存状态')
          const incompleteInfo = toolCallMerger.getIncompleteToolCalls()
          await this.saveIncompleteMcpState(
            sessionId,
            MCP_STATE.BUILDING_PARAMS,
            incompleteInfo,
            msgSaved,
          )
          
          // 发送提示信息给前端
          if (!ctx.res.writableEnded) {
            const errorChunk = {
              choices: [{
                delta: {
                  content: '\n\n⚠️ MCP工具调用因内容过长而中断。参数构建未完成，请回复"继续"以完成工具调用。',
                },
                finish_reason: 'stop',
                index: 0,
              }],
            }
            ctx.res.write(JSON.stringify(errorChunk) + '\n')
          }
        }
      }

      // 保存助手的完整回复
      if (msgSaved && assistantMessage) {
        await this.appendMsg(msgSaved.id, assistantMessage)
      } else if (assistantMessage) {
        await this.saveMsg(
          'default-user',
          'assistant',
          assistantMessage,
          sessionId,
        )
      }

      // 只有在响应尚未结束时才结束它
      if (!ctx.res.writableEnded) {
        ctx.res.end()
        hasEnded = true
      }
    } catch (error) {
      ctx.logger.error('Stream error:', error)
      // 只在响应尚未结束时处理错误
      if (!ctx.res.writableEnded && !hasEnded) {
        await this.handleStreamError(
          new Error(ctx.__('chat.stream_error') + error.message),
          ctx,
        )
      }
    }
  }

  async handleRunToolCall(toolFunctions) {
    const { ctx } = this
    const res = []
    for (const toolCall of toolFunctions) {
      const toolName = toolCall.function.name
      const toolArgs = toolCall.function.arguments
      console.log('[chat_js]', 'run tool:', toolName, toolArgs)
      
      try {
        // 设置超时（30秒）
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('MCP工具调用超时（30秒）')), 30000)
        })
        
        const toolCallPromise = ctx.service.tools.runTools(toolName, toolArgs)
        const resItem = await Promise.race([toolCallPromise, timeoutPromise])
        
        const messageStandWithRes = this.ctx.helper.factoryMessageContent({
          type: 'mcp',
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          result: resItem,
        })
        res.push(messageStandWithRes)
      } catch (error) {
        ctx.logger.error(`[chat_js] MCP工具调用失败 (${toolName}):`, error)
        
        // 保存错误信息，返回给AI处理
        const errorResult = {
          error: true,
          message: error.message || '工具调用失败',
          toolName,
          toolArgs,
        }
        
        const messageStandWithRes = this.ctx.helper.factoryMessageContent({
          type: 'mcp',
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          result: errorResult,
        })
        res.push(messageStandWithRes)
      }
    }
    return res
  }

  async sendAndSaveToolCall(res, sessionId, msgSaved) {
    const { ctx } = this
    const saveRes = []
    for (const message of res) {
      const messageWithDirective = this.ctx.helper.toolCallFucntionToDirective(
        message,
        'tool_call',
      )
      // 返回客户端指令流
      ctx.res.write(`${JSON.stringify(messageWithDirective)}\n\n`)
      const content = messageWithDirective.choices[0].delta.content
      // this.appendMsg(sessionId, 'assistant', content)
      saveRes.push(content)
    }
    return saveRes
  }

  async handleStreamError(error, ctx) {
    console.error('handleStreamError:', error)

    // 检查响应是否已结束
    console.log('[chat_js]', 'ctx.res.writableEnded:', ctx.res.writableEnded)

    if (ctx.res.writableEnded) {
      return
    }
    try {
      ctx.set({
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      ctx.res.statusCode = 200
      const data = {
        choices: [
          {
            delta: {
              content: error.message,
            },
            finish_reason: 'stop',
            index: 0,
          },
        ],
      }
      ctx.res.write(JSON.stringify(data) + '\n')

      // 确保只结束一次响应
      if (!ctx.res.writableEnded) {
        ctx.res.end()
      }
    } catch (error) {
      ctx.logger.error(ctx.__('chat.handle_error_failed'), error)
    }
  }

  /**
   * 保持为历史对话
   * @param {string} uid - 用户 ID
   * @param {string} role - 用户角色
   * @param {string} content - 聊天内容
   * @param {string} id - 消息 ID
   * @returns {Promise<void>}
   */
  async saveMsg(uid, role, content, sessionId) {
    const { ctx } = this

    // 参数验证
    if (!uid || !role || !content || !sessionId) {
      if (!uid) console.log('[chat_js]', 'uid is empty')
      if (!role) console.log('[chat_js]', 'role is empty')
      if (!content) console.log('[chat_js]', 'content is empty')
      if (!sessionId) console.log('[chat_js]', 'sessionId is empty')
      throw new Error(ctx.__('chat.incomplete_params'))
    }

    // 验证角色是否合法
    if (!['user', 'assistant', 'system'].includes(role)) {
      throw new Error(ctx.__('chat.invalid_role'))
    }

    try {
      // 创建消息记录
      const message = await ctx.model.Message.create({
        session_id: sessionId,
        uid,
        role,
        content,
        created_at: new Date(),
        updated_at: new Date(),
      })

      return message
    } catch (error) {
      ctx.logger.error('保存消息失败:', error)
      throw new Error(ctx.__('chat.save_message_failed') + error.message)
    }
  }

  async appendMsg(sessionId, role, message) {
    const { ctx } = this

    try {
      // 验证会话是否存在
      const session = await ctx.model.ChatSession.findByPk(sessionId)
      if (!session) {
        throw new Error(ctx.__('chat.session_not_found'))
      }

      // 查找当前会话角色的最新消息
      const latestMessage = await ctx.model.Message.findOne({
        where: {
          session_id: sessionId,
          role: role,
        },
        order: [['created_at', 'DESC']],
      })

      // 如果找到最新消息，则追加内容
      if (latestMessage) {
        latestMessage.content += message
        latestMessage.updated_at = new Date()
        await latestMessage.save()
        return latestMessage
      } else {
        // 如果没有找到，则创建一个新的消息
        const newMessage = await this.saveMsg(
          'default-user',
          role,
          message,
          sessionId,
        )
        return newMessage
      }
    } catch (error) {
      ctx.logger.error('追加消息失败:', error)
      throw new Error(ctx.__('chat.append_message_failed') + error.message)
    }
  }

  /**
   * 获取对话历史记录
   * @param {string} sessionId - 会话ID
   * @param {string} uid - 用户ID
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   * @returns
   */
  async getHistory(sessionId, uid, page = 1, pageSize = 20) {
    // console.log('getHistory', sessionId, uid, page, pageSize)

    const { ctx } = this

    if (!uid || !sessionId) {
      throw new Error(ctx.__('chat.incomplete_params'))
    }

    try {
      const offset = (page - 1) * pageSize

      const { count, rows } = await ctx.model.Message.findAndCountAll({
        where: {
          session_id: sessionId,
          uid: uid,
        },
        order: [['created_at', 'ASC']],
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
      ctx.logger.error('获取历史记录失败:', error)
      throw new Error(ctx.__('chat.get_history_failed') + error.message)
    }
  }

  /**
   * 创建新的对话会话
   * @param {Object} params - 创建参数
   * @param {string} params.title - 会话标题
   * @param {string} params.uid - 用户ID
   */
  async createSession(params) {
    const { ctx } = this
    const { title, uid } = params

    try {
      // 创建新会话
      const session = await ctx.model.ChatSession.create({
        title,
        uid,
        model: 'deepseek-r1', // 默认模型
        created_at: new Date(),
        updated_at: new Date(),
      })

      return session
    } catch (error) {
      ctx.logger.error('创建会话失败:', error)
      throw new Error(ctx.__('chat.create_session_failed') + error.message)
    }
  }

  async getSession(id) {
    const { ctx } = this

    if (!id) {
      throw new Error(ctx.__('chat.incomplete_params'))
    }

    try {
      const session = await ctx.model.ChatSession.findByPk(id, {
        include: [
          {
            model: ctx.model.Message,
            as: 'messages',
            order: [['created_at', 'ASC']],
          },
        ],
      })
      console.log('[chat_js]', session)

      return session
    } catch (error) {
      ctx.logger.error('获取会话失败:', error)
      throw new Error(ctx.__('chat.get_history_failed') + error.message)
    }
  }

  async listSession(page = 1, pageSize = 2000) {
    const { ctx } = this

    try {
      const offset = (page - 1) * pageSize

      const { count, rows } = await ctx.model.ChatSession.findAndCountAll({
        order: [['created_at', 'DESC']],
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
      ctx.logger.error('获取会话列表失败:', error)
      throw new Error(ctx.__('chat.get_history_failed') + error.message)
    }
  }

  async removeSession(id) {
    const { ctx } = this

    if (!id) {
      throw new Error(ctx.__('chat.incomplete_params'))
    }

    try {
      const session = await ctx.model.ChatSession.findByPk(id)
      if (!session) {
        throw new Error(ctx.__('chat.session_not_found'))
      }
      await session.destroy()
      await ctx.model.Message.destroy({
        where: {
          session_id: id,
        },
      })
      return true
    } catch (error) {
      ctx.logger.error('删除会话失败:', error)
      throw new Error(ctx.__('chat.delete_session_failed') + error.message)
    }
  }

  async summary(model, messages, sessionId) {
    const { ctx } = this
    if (!sessionId || !messages) {
      throw new Error(ctx.__('chat.incomplete_params'))
    }
    let messagesStr = ''
    messages.forEach(item => {
      messagesStr += item.role + ': ' + item.content + '\n'
    })
    const prompt = [
      // {
      //   role: "system",
      //   // content: "You are a concise summarizer. Always provide summaries in exactly 10 words."
      //   content: "你是一个对话标题总结器。总是以10个字的文字总结标题, 无需思考过程。"
      // },
      {
        role: 'user',
        // content: `Summarize the following conversation in 10 words: ${messagesStr}`,
        content: `
我想让你充当对话标题生成器。我将向你提供对话内容，你将生成一个吸引人的标题。请严格遵循以下规则：

1. 请保持标题简洁，不超过 10 个字，并确保保持其含义。
2. 标题内容不能包含标点符号和特殊符号。
3. 答复时直接给出结果, 无需思考过程。
4. 答复时要利用对话的语言类型, 如对话内容为英语则生成英语标题，对话内容是中文则生成中文标题。
5. 标题内容不能为空。
6. 标题的开头必须使用适合当前对话内容的 emoji。
7. 不要以“标题：”开头。

我的第一个对话内容是： ${messagesStr}
`,
      },
    ]
    try {
      let res = ''
      const provider_id = model.provider_id
      if (provider_id == 'local') {
        res = await ctx.service.ollama.chatNoStream(prompt, model.id)
      } else {
        res = await ctx.service.llm.chatNoStream(prompt, model, provider_id)
      }
      const session = await ctx.model.ChatSession.findByPk(sessionId.id)
      if (!session) {
        throw new Error(ctx.__('chat.session_not_found'))
      }

      // 移除思考过程的内容
      if (res && res.includes('<think>')) {
        const pattern = /<think>[\s\S]*?<\/think>/g
        res = res.replace(pattern, '').trim()
      }

      // 使用 emojiHelper 为标题添加 emoji
      // const emojiHelper = require('../extend/emojiHelper');
      // res = emojiHelper.addEmojiToTitle(res);

      await session.update({
        title: res,
      })
      await session.reload()
      return session
    } catch (error) {
      ctx.logger.error('修改会话标题失败:', error)
      throw new Error(ctx.__('chat.update_title_failed') + error.message)
    }
  }

  async updateSettings(sessionId, settings) {
    const { ctx } = this
    try {
      const session = await ctx.model.ChatSession.findByPk(sessionId)
      if (!session) {
        throw new Error(ctx.__('chat.session_not_found'))
      }

      // 更新会话设置
      const updateData = {
        title: settings.title,
        system_prompt: settings.systemPrompt,
        temperature: settings.temperature && settings.temperature[0],
        top_p: settings.top_p && settings.top_p[0],
        presence_penalty: settings.presence_penalty && settings.presence_penalty[0],
        frequency_penalty: settings.frequency_penalty && settings.frequency_penalty[0],
      }

      // 如果存在 prompts 字段，将其存储为 JSON 字符串到 system_prompt 字段
      // 为了兼容性，同时保存主提示词到 system_prompt
      if (settings.prompts && Array.isArray(settings.prompts)) {
        // 将 prompts 数组存储为 JSON 字符串
        // 由于数据库字段是 TEXT，我们可以将 JSON 存储在 system_prompt 中
        // 或者使用一个约定：如果 system_prompt 以 "{" 开头，则认为是 JSON
        const mainPrompt = settings.prompts.find(p => p.isMain)
        if (mainPrompt) {
          updateData.system_prompt = mainPrompt.content
        }
        // 将 prompts 数组序列化为 JSON 字符串，存储在 system_prompt 字段
        // 为了兼容，我们使用一个特殊格式：JSON 字符串存储在 system_prompt 中
        // 格式：{"prompts": [...], "mainPrompt": "..."}
        const promptsData = JSON.stringify({
          prompts: settings.prompts,
          mainPrompt: (mainPrompt && mainPrompt.content) || ''
        })
        // 如果 system_prompt 字段足够大，我们可以直接存储 JSON
        // 否则，我们需要使用另一个字段或者扩展字段
        // 这里我们使用一个约定：如果 prompts 存在，将其存储在 system_prompt 中作为 JSON
        // 但为了兼容，我们只在有多个提示词时才这样做
        if (settings.prompts.length > 1) {
          updateData.system_prompt = promptsData
        }
      }

      await session.update(updateData)
      return session
    } catch (error) {
      ctx.logger.error('更新会话设置失败:', error)
      throw new Error(ctx.__('chat.update_settings_failed') + error.message)
    }
  }

  async getSettings(sessionId) {
    const { ctx } = this
    try {
      const session = await ctx.model.ChatSession.findByPk(sessionId)
      if (!session) {
        throw new Error(ctx.__('chat.session_not_found'))
      }

      // 尝试解析 system_prompt 是否为 JSON（多提示词格式）
      let prompts = null
      let systemPrompt = session.system_prompt
      
      try {
        // 如果 system_prompt 以 "{" 开头，尝试解析为 JSON
        if (session.system_prompt && session.system_prompt.trim().startsWith('{')) {
          const parsed = JSON.parse(session.system_prompt)
          if (parsed.prompts && Array.isArray(parsed.prompts)) {
            prompts = parsed.prompts
            const mainPromptItem = parsed.prompts.find(p => p.isMain)
            systemPrompt = parsed.mainPrompt || (mainPromptItem && mainPromptItem.content) || ''
          }
        }
      } catch (e) {
        // 解析失败，说明是普通字符串，使用原值
        systemPrompt = session.system_prompt
      }

      const result = {
        title: session.title,
        systemPrompt: systemPrompt,
        temperature: session.temperature,
        top_p: session.top_p,
        presence_penalty: session.presence_penalty,
        frequency_penalty: session.frequency_penalty,
      }

      // 如果解析出了 prompts，添加到返回结果中
      if (prompts) {
        result.prompts = prompts
      }

      return result
    } catch (error) {
      ctx.logger.error('获取会话设置失败:', error)
      throw new Error(ctx.__('chat.get_settings_failed') + error.message)
    }
  }

  /**
   * 保存未完成的MCP调用状态
   * @param {string} sessionId - 会话ID
   * @param {string} state - MCP状态
   * @param {Array} incompleteInfo - 未完成的tool_call信息
   * @param {Object} msgSaved - 已保存的消息对象
   */
  async saveIncompleteMcpState(sessionId, state, incompleteInfo, msgSaved) {
    const { ctx } = this
    try {
      let message = '\n\n[未完成的MCP工具调用]\n'
      message += `状态: ${state}\n\n`
      incompleteInfo.forEach((info, index) => {
        message += `${index + 1}. 工具: ${info.name}\n`
        message += `   参数片段: ${info.arguments.substring(0, 100)}${info.arguments.length > 100 ? '...' : ''}\n`
        message += `   JSON状态: ${info.isComplete ? '完整' : '不完整'}\n\n`
      })
      message += '请回复"继续"以完成此工具调用。\n'
      
      // 添加状态标记
      message += `\n[MCP_INCOMPLETE:${state}]\n`
      message += JSON.stringify({ state, incompleteInfo }, null, 2)

      if (msgSaved) {
        await this.appendMsg(msgSaved.id, message)
      } else {
        await this.saveMsg(
          'default-user',
          'assistant',
          message,
          sessionId,
        )
      }
    } catch (error) {
      ctx.logger.error('保存未完成MCP状态失败:', error)
    }
  }

  /**
   * 检测是否有未完成的MCP调用（状态5：结果已保存但AI未处理）
   * @param {string} sessionId - 会话ID
   * @returns {Object|null} 未完成的MCP调用信息，如果没有返回null
   */
  async checkIncompleteMcpCall(sessionId) {
    const { ctx } = this
    try {
      // 获取会话的最新消息
      const messages = await this.getHistory(sessionId, 'default-user', 1, 20)
      if (!messages.data || messages.data.length === 0) {
        return null
      }

      // 查找最后一条助手消息
      const lastAssistantMsg = messages.data
        .slice()
        .reverse()
        .find(msg => msg.role === 'assistant')

      if (!lastAssistantMsg) {
        return null
      }

      // 检查是否包含tool_call指令
      if (lastAssistantMsg.content.includes(':::tool_call')) {
        // 检查是否有后续消息
        const lastMsg = messages.data[messages.data.length - 1]
        const hasFollowUp = lastMsg.id > lastAssistantMsg.id && 
                           (lastMsg.role === 'user' || 
                            (lastMsg.role === 'assistant' && 
                             !lastMsg.content.includes(':::tool_call')))

        if (!hasFollowUp) {
          // 提取tool_call信息
          const toolCallInfo = this.extractToolCallInfo(lastAssistantMsg.content)
          if (toolCallInfo) {
            return {
              state: MCP_STATE.RESULT_SAVED_NOT_PROCESSED,
              message: lastAssistantMsg,
              toolCallInfo,
            }
          }
        }
      }

      // 检查是否有未完成状态标记
      const incompleteStateMatch = lastAssistantMsg.content.match(/\[MCP_INCOMPLETE:(\w+)\]/)
      if (incompleteStateMatch) {
        const state = incompleteStateMatch[1]
        // 尝试提取tool_call信息
        const jsonMatch = lastAssistantMsg.content.match(/\[MCP_INCOMPLETE:\w+\]\s*([\s\S]*)$/)
        if (jsonMatch) {
          try {
            const stateInfo = JSON.parse(jsonMatch[1].trim())
            return {
              state,
              message: lastAssistantMsg,
              stateInfo,
            }
          } catch (e) {
            ctx.logger.error('解析未完成状态信息失败:', e)
          }
        }
      }

      return null
    } catch (error) {
      ctx.logger.error('检测未完成MCP调用失败:', error)
      return null
    }
  }

  /**
   * 从消息内容中提取tool_call信息
   * @param {string} content - 消息内容
   * @returns {Object|null} tool_call信息
   */
  extractToolCallInfo(content) {
    try {
      // 从 :::tool_call 指令中提取JSON信息
      const match = content.match(/:::tool_call\{\.tool_call\}\s*([\s\S]*?)\s*:::/)
      if (!match) {
        return null
      }

      const toolCallInfo = JSON.parse(match[1])
      return toolCallInfo
    } catch (e) {
      console.error('[chat_js] 提取tool_call信息失败:', e)
      return null
    }
  }
}

module.exports = ChatService
