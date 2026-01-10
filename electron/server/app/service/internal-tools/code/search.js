/**
 * 搜索代码工具
 */
const searchCodeTool = {
  name: 'search',
  description: '在项目中搜索代码',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      searchPath: {
        type: 'string',
        description: '搜索路径（可选）',
      },
    },
    required: ['query'],
  },
  handler: async (args, ctx) => {
    const { query, searchPath } = args
    try {
      const searchService = ctx.service.search
      const results = await searchService.search(query, searchPath)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      }
    } catch (error) {
      throw new Error(`搜索代码失败: ${error.message}`)
    }
  },
}

module.exports = searchCodeTool
