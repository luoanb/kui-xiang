const fs = require('fs')
const path = require('path')

const moveTool = {
  name: 'move',
  description: '移动文件或目录',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: '源路径',
      },
      destination: {
        type: 'string',
        description: '目标路径',
      },
    },
    required: ['source', 'destination'],
  },
  handler: async (args, ctx) => {
    const { source: sourcePath, destination: destPath } = args
    
    try {
      const projectService = ctx.service.project
      const absoluteSourcePath = path.resolve(sourcePath)
      const absoluteDestPath = path.resolve(destPath)
      
      const projectPath = projectService.getProjectPath()
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        const sourceRelative = path.relative(absoluteProjectPath, absoluteSourcePath)
        const destRelative = path.relative(absoluteProjectPath, absoluteDestPath)
        
        if (sourceRelative.startsWith('..') || destRelative.startsWith('..')) {
          throw new Error(
            '安全错误：路径不在项目范围内\n' +
            `项目路径: ${absoluteProjectPath}\n` +
            `源路径: ${absoluteSourcePath}\n` +
            `目标路径: ${absoluteDestPath}\n` +
            '请先打开项目文件夹'
          )
        }
      }
      
      if (!fs.existsSync(absoluteSourcePath)) {
        throw new Error(`源路径不存在: ${absoluteSourcePath}`)
      }
      
      const sourceStat = fs.statSync(absoluteSourcePath)
      const destDir = path.dirname(absoluteDestPath)
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }
      
      if (fs.existsSync(absoluteDestPath)) {
        const destStat = fs.statSync(absoluteDestPath)
        if (destStat.isDirectory()) {
          const files = fs.readdirSync(absoluteDestPath)
          if (files.length > 0) {
            throw new Error(`目标目录不为空: ${absoluteDestPath}`)
          }
        } else {
          throw new Error(`目标文件已存在: ${absoluteDestPath}`)
        }
      }
      
      fs.renameSync(absoluteSourcePath, absoluteDestPath)
      
      ctx.logger.info(`[internal_file_move] 移动成功: ${absoluteSourcePath} -> ${absoluteDestPath}`)
      
      return {
        content: [
          {
            type: 'text',
            text: `已成功移动: ${absoluteSourcePath} -> ${absoluteDestPath}`,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_move] 移动失败:`, error)
      throw new Error(`移动失败: ${error.message}`)
    }
  },
}

module.exports = moveTool
