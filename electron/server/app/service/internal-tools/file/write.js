const fs = require('fs')
const path = require('path')

/**
 * 文件写入工具
 */
const writeFileTool = {
  name: 'write',
  description: '写入文件内容',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径',
      },
      content: {
        type: 'string',
        description: '文件内容',
      },
    },
    required: ['path', 'content'],
  },
  handler: async (args, ctx) => {
    const { path: filePath, content } = args
    
    try {
      const projectService = ctx.service.project
      
      const absoluteFilePath = path.resolve(filePath)
      
      const projectPath = projectService.getProjectPath()
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        const relativePath = path.relative(absoluteProjectPath, absoluteFilePath)
        
        if (relativePath.startsWith('..')) {
          throw new Error(
            `安全错误：文件路径不在项目范围内\n` +
            `项目路径: ${absoluteProjectPath}\n` +
            `请求路径: ${absoluteFilePath}\n` +
            `请先打开项目文件夹`
          )
        }
      }
      
      const stat = fs.existsSync(absoluteFilePath) ? fs.statSync(absoluteFilePath) : null
      
      if (stat && stat.isDirectory()) {
        throw new Error(`路径是目录，不是文件: ${absoluteFilePath}`)
      }
      
      const dir = path.dirname(absoluteFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      fs.writeFileSync(absoluteFilePath, content, 'utf-8')
      
      ctx.logger.info(`[internal_file_write] 写入文件成功: ${absoluteFilePath}`)
      
      return {
        content: [
          {
            type: 'text',
            text: `文件已成功写入: ${absoluteFilePath}`,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_write] 写入文件失败:`, error)
      throw new Error(`写入文件失败: ${error.message}`)
    }
  },
}

module.exports = writeFileTool
