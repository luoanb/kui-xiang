const fs = require('fs')
const path = require('path')

/**
 * 删除文件或目录工具
 */
const deleteTool = {
  name: 'delete',
  description: '删除文件或目录',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件或目录路径',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归删除目录（默认为 false）',
      },
    },
    required: ['path'],
  },
  handler: async (args, ctx) => {
    const { path: targetPath, recursive = false } = args
    
    try {
      const projectService = ctx.service.project
      const absoluteTargetPath = path.resolve(targetPath)
      
      const projectPath = projectService.getProjectPath()
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        const relativePath = path.relative(absoluteProjectPath, absoluteTargetPath)
        
        if (relativePath.startsWith('..')) {
          throw new Error(
            `安全错误：路径不在项目范围内\n` +
            `项目路径: ${absoluteProjectPath}\n` +
            `请求路径: ${absoluteTargetPath}\n` +
            `请先打开项目文件夹`
          )
        }
      }
      
      if (!fs.existsSync(absoluteTargetPath)) {
        throw new Error(`路径不存在: ${absoluteTargetPath}`)
      }
      
      const stat = fs.statSync(absoluteTargetPath)
      
      if (stat.isDirectory()) {
        if (recursive) {
          fs.rmSync(absoluteTargetPath, { recursive: true, force: true })
          ctx.logger.info(`[internal_file_delete] 递归删除目录成功: ${absoluteTargetPath}`)
        } else {
          const files = fs.readdirSync(absoluteTargetPath)
          if (files.length > 0) {
            throw new Error(`目录不为空，请使用 recursive: true 删除: ${absoluteTargetPath}`)
          }
          throw new Error(`目录不为空，请使用 recursive: true 删除: ${absoluteTargetPath}`)
        }
      } else {
        fs.unlinkSync(absoluteTargetPath)
        ctx.logger.info(`[internal_file_delete] 删除文件成功: ${absoluteTargetPath}`)
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `已成功删除: ${absoluteTargetPath}`,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_delete] 删除失败:`, error)
      throw new Error(`删除失败: ${error.message}`)
    }
  },
}

module.exports = deleteTool
