const fs = require('fs')
const path = require('path')

const copyTool = {
  name: 'copy',
  description: '复制文件或目录',
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
      
      ctx.logger.info(`[链路起点] 用户选择的项目路径: ${projectPath}`)
      ctx.logger.info(`[链路起点] 源路径: ${sourcePath}`)
      ctx.logger.info(`[链路起点] 目标路径: ${destPath}`)
      ctx.logger.info(`[链路解析] 解析后源路径: ${absoluteSourcePath}`)
      ctx.logger.info(`[链路解析] 解析后目标路径: ${absoluteDestPath}`)
      
      if (projectPath) {
        const absoluteProjectPath = path.resolve(projectPath)
        const sourceRelative = path.relative(absoluteProjectPath, absoluteSourcePath)
        const destRelative = path.relative(absoluteProjectPath, absoluteDestPath)
        
        ctx.logger.info(`[链路中间] 项目绝对路径: ${absoluteProjectPath}`)
        ctx.logger.info(`[链路中间] 源相对路径: ${sourceRelative}`)
        ctx.logger.info(`[链路中间] 目标相对路径: ${destRelative}`)
        
        if (sourceRelative.startsWith('..') || destRelative.startsWith('..')) {
          throw new Error(
            '安全错误：路径不在项目范围内\n' +
            `项目路径: ${absoluteProjectPath}\n` +
            `源路径: ${absoluteSourcePath}\n` +
            `目标路径: ${absoluteDestPath}\n` +
            '请先打开项目文件夹'
          )
        }
      } else {
        ctx.logger.info(`[链路终点] 未设置项目路径，使用默认工作目录`)
      }
      
      if (!fs.existsSync(absoluteSourcePath)) {
        throw new Error(`源路径不存在: ${absoluteSourcePath}`)
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
        throw new Error(`目标路径已存在: ${absoluteDestPath}`)
      }
      
      if (sourceStat.isDirectory()) {
        const copyDir = (src, dst) => {
          const files = fs.readdirSync(src)
          for (const file of files) {
            const srcPath = path.join(src, file)
            const dstPath = path.join(dst, file)
            const stat = fs.statSync(srcPath)
            
            if (stat.isDirectory()) {
              if (!fs.existsSync(dstPath)) {
                fs.mkdirSync(dstPath, { recursive: true })
              }
              copyDir(srcPath, dstPath)
            } else {
              fs.copyFileSync(srcPath, dstPath)
            }
          }
        }
        copyDir(absoluteSourcePath, absoluteDestPath)
      } else {
        fs.copyFileSync(absoluteSourcePath, absoluteDestPath)
      }
      
      ctx.logger.info(`[internal_file_copy] 复制成功: ${absoluteSourcePath} -> ${absoluteDestPath}`)
      
      return {
        content: [
          {
            type: 'text',
            text: `已成功复制: ${absoluteSourcePath} -> ${absoluteDestPath}`,
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_copy] 复制失败:`, error)
      throw new Error(`复制失败: ${error.message}`)
    }
  },
}

module.exports = copyTool
