const teamPositionTool = {
  name: 'position',
  description: '切换到指定的团队职位',
  inputSchema: {
    type: 'object',
    properties: {
      position_name: {
        type: 'string',
        description: '职位名称',
      },
      question: {
        type: 'string',
        description: '待处理事项，可以是任务描述、问题、请求等',
      },
    },
    required: ['position_name', 'question'],
  },
  handler: async (args, ctx) => {
    const { position_name, question } = args
    
    try {
      const teamService = ctx.service.team
      
      const rolePrompt = teamService.getTeamRoleByName(position_name)
      
      if (!rolePrompt) {
        throw new Error(`未找到职位: ${position_name}`)
      }
      
      ctx.logger.info(`[internal_team_position] 成功获取职位提示词: ${position_name}`)
      
      return {
        content: [
          {
            type: 'text',
            text: rolePrompt,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_team_position] 获取职位提示词失败:`, error)
      throw new Error(`获取职位提示词失败: ${error.message}`)
    }
  },
}

module.exports = teamPositionTool
