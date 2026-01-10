const fs = require('fs')
const path = require('path')

/**
 * 创建目录工具
 */
const mkdirTool = {
  name: 'mkdir',
  description: '创建目录',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目录路径',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归创建父目录（默认为 true）',
      },
    },
    required: ['path'],
  },
  handler: async (args, ctx) => {
    const { path: dirPath, recursive = true } = args
    
    try {
      const projectService = ctx.service.project
      const absoluteDirPath = path.resolve(dirPath)
      
      const projectPath = projectService.getProjectPath()
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        const relativePath = path.relative(absoluteProjectPath, absoluteDirPath)
        
        if (relativePath.startsWith('..')) {
          throw new Error(
            `安全错误：路径不在项目范围内\n` +
            `项目路径: ${absoluteProjectPath}\n` +
            `请求路径: ${absoluteDirPath}\n` +
            `请先打开项目文件夹`
          )
        }
      }
      
      if (fs.existsSync(absoluteDirPath)) {
        throw new Error(`目录已存在: ${absoluteDirPath}`)
      }
      
      fs.mkdirSync(absoluteDirPath, { recursive })
      
      ctx.logger.info(`[internal_file_mkdir] 创建目录成功: ${absoluteDirPath}`)
      
      return {
        content: [
          {
            type: 'text',
            text: `目录已成功创建: ${absoluteDirPath}`,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_mkdir] 创建目录失败:`, error)
      throw new Error(`创建目录失败: ${error.message}`)
    }
  },
}

module.exports = mkdirTool
