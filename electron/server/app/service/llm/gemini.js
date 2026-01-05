const OpenAI = require('openai')
const BaseLLMService = require('./base')
const https = require('https')

class GeminiService extends BaseLLMService {
  constructor(ctx) {
    super(ctx)
    this.provider = 'gemini'
  }

  async createClient(config) {
    if (!config || !config.baseUrl || !config.apiKey) {
      throw new Error(this.ctx.__('chat.key_empty'))
    }
    if(config.baseUrl.endsWith('/')) {
      config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1)
    }
    if(config.baseUrl === 'https://generativelanguage.googleapis.com') {
      config.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'
    }
    if(config.baseUrl == 'https://generativelanguage.googleapis.com/v1beta') {
      config.baseUrl += '/openai/'
    }
    return new OpenAI({
      // apiKey: this.decrypt(config.apiKey),
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      httpAgent: https.globalAgent,
      httpsAgent: https.globalAgent,
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
        // max_tokens: 1,
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
      console.log('[gemini_js]', configSaved)
      const client = await this.createClient(configSaved)
      const model_id = model.id.includes(':')
        ? model.id.split(model.provider_id + ':').pop()
        : model.id
      /**
       * 使用 MessageService 转换消息格式
       * 去除 reasoning_content 标签，合并相同角色消息
       */
      const mergedMessages = ctx.service.message.toModelMsg(messages)

      const systemPrompts = this.ctx.service.prompt.buildSystemPrompt(
        sessionSettings.systemPrompt,
        docs,
        tools,
        // customPrompts
      );

      const messagesWithSystemPrompt = [
        { role:'system', content: systemPrompts },
        ...mergedMessages,
      ]

      console.log('[gemini_js]', sessionSettings)

      const params = {
        model: model_id,
        messages: messagesWithSystemPrompt,
        stream: true,
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

module.exports = GeminiService
