const OpenAI = require('openai')
const BaseLLMService = require('./base')
const https = require('https')

class DeepseekService extends BaseLLMService {
  constructor(ctx) {
    super(ctx)
    this.provider = 'deepseek'
  }

  async createClient(config) {
    if (!config || !config.baseUrl || !config.apiKey) {
      throw new Error(this.ctx.__('chat.key_empty'))
    }
    return new OpenAI({
      // apiKey: this.decrypt(config.apiKey),
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      httpAgent: https.globalAgent,
    })
  }

  async testConnection(config, model) {
    try {
      const client = await this.createClient(config)
      const model_id = model.id.includes(':')
        ? model.id.split(model.provider_id + ':').pop()
        : model.id
      const response = await client.chat.completions.create({
        model: model_id,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      })
      if(!response.choices || response.choices.length == 0) {
        if(response.error) {
          if(response.error.metadata && response.error.metadata.raw) {
            try {
              const json = JSON.parse(response.error.metadata.raw)
              throw new Error(json.error)
            } catch (error) {
              
            }
            throw new Error(response.error.metadata.raw)
          }
          throw new Error(response.error)
        }
      }
      return response.choices.length > 0
    } catch (error) {
      if (error.status == 401) {
        throw new Error(this.ctx.__('connection.auth_failed') + `(${error.status})`)
      } else {
        throw new Error(this.ctx.__('connection.test_failed') + error.message)
      }
    }
  }

  async listModels() {
    // 使用基类的 listModels 方法
    return super.listModels()
  }

  async chat(model, messages, config, sessionSettings, tools, docs) {
    const { ctx } = this
    try {
      const configSaved = await this.getConfig(model.provider_id)
      console.log('[common_js]', configSaved)
      const client = await this.createClient(configSaved)
      const model_id = model.id.includes(':')
        ? model.id.split(model.provider_id + ':').pop()
        : model.id
      /**
       * 使用 MessageService 转换消息格式
       * 去除 reasoning_content 标签，合并相同角色消息
       */
      const mergedMessages = ctx.service.message.toModelMsg(messages)

      // 检查 messages 中是否已经有 system 消息（前端可能已经添加了选中的提示词）
      const hasSystemMessage = mergedMessages.length > 0 && mergedMessages[0].role === 'system'
      
      let messagesWithSystemPrompt
      if (hasSystemMessage) {
        // 如果已经有 system 消息，直接使用（前端已经添加了选中的提示词）
        messagesWithSystemPrompt = mergedMessages
      } else {
        // 如果没有 system 消息，构建并添加系统提示词
        const systemPrompts = this.ctx.service.prompt.buildSystemPrompt(
          sessionSettings.systemPrompt,
          docs,
          tools,
          // customPrompts
        );

        messagesWithSystemPrompt = [
          { role:'system', content: systemPrompts },
          ...mergedMessages,
        ]
      }

      // const messagesWithSystemPrompt = sessionSettings.systemPrompt
      //   ? [
      //       { role: 'system', content: sessionSettings.systemPrompt },
      //       ...mergedMessages,
      //     ]
      //   : mergedMessages

      // console.log('[common_js]', sessionSettings)

      // 如果 config 中有 promptConfig，使用它；否则使用 sessionSettings
      const promptConfig = config?.promptConfig || {}
      const params = {
        model: model_id,
        messages: messagesWithSystemPrompt,
        stream: true,
        // max_tokens: 2048,
        temperature: promptConfig.temperature ?? sessionSettings.temperature,
        top_p: promptConfig.top_p ?? sessionSettings.top_p,
        presence_penalty: promptConfig.presence_penalty ?? sessionSettings.presence_penalty,
        frequency_penalty: promptConfig.frequency_penalty ?? sessionSettings.frequency_penalty,
      }
      // console.log(params)
      if (tools && tools.length > 0) {
        params.tools =
          this.ctx.service.tools.convertMcpToolsToOpenaiTools(tools)
      }
      const response = await client.chat.completions.create(params)
      // return response.choices[0].message.content
      return response
    } catch (error) {
      throw new Error(`${error.message}`)
    }
  }

  async chatNoStream(messages, model, provider_id) {
    const { ctx } = this
    try {
      const configSaved = await this.getConfig(model.provider_id)
      const client = await this.createClient(configSaved)
      const model_id = model.id.includes(':')
        ? model.id.split(model.provider_id + ':').pop()
        : model.id
      const response = await client.chat.completions.create({
        model: model_id,
        messages,
        stream: false,
        // max_tokens: 2048,
        // temperature: 0.7,
      })
      return response
    } catch (error) {
      ctx.logger.error(error)
      throw new Error(error.message)
    }
  }
}

module.exports = DeepseekService
