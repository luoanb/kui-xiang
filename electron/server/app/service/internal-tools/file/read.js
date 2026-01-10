const fs = require('fs')
const path = require('path')

/**
 * 文件读取工具
 */
const readFileTool = {
  name: 'read',
  description: '读取文件内容',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['path'],
  },
  handler: async (args, ctx) => {
    const { path: filePath } = args
    
    try {
      const projectService = ctx.service.project
      
      const projectPath = projectService.getProjectPath()
      
      let absoluteFilePath
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        
        if (path.isAbsolute(filePath)) {
          absoluteFilePath = path.resolve(filePath)
        } else {
          absoluteFilePath = path.resolve(absoluteProjectPath, filePath)
        }
        
        const relativePath = path.relative(absoluteProjectPath, absoluteFilePath)
        
        if (relativePath.startsWith('..')) {
          throw new Error(
            `安全错误：文件路径不在项目范围内\n` +
            `项目路径: ${absoluteProjectPath}\n` +
            `请求路径: ${absoluteFilePath}\n` +
            `请先打开项目文件夹`
          )
        }
      } else {
        absoluteFilePath = path.resolve(filePath)
      }
      
      if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(`文件不存在: ${absoluteFilePath}`)
      }
      
      const stat = fs.statSync(absoluteFilePath)
      if (stat.isDirectory()) {
        throw new Error(`路径是目录，不是文件: ${absoluteFilePath}`)
      }
      
      const content = fs.readFileSync(absoluteFilePath, 'utf-8')
      
      ctx.logger.info(`[internal_file_read] 读取文件成功: ${absoluteFilePath}`)
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_read] 读取文件失败:`, error)
      throw new Error(`读取文件失败: ${error.message}`)
    }
  },
}

module.exports = readFileTool
