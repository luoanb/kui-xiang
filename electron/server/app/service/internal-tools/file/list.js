const fs = require('fs')
const path = require('path')

/**
 * 列出目录工具
 */
const listTool = {
  name: 'list',
  description: '列出目录内容',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目录路径（默认为项目根目录）',
      },
      recursive: {
        type: 'boolean',
        description: '是否递归列出子目录',
      },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const { path: dirPath = '.', recursive = false } = args
    
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
      
      if (!fs.existsSync(absoluteDirPath)) {
        throw new Error(`目录不存在: ${absoluteDirPath}`)
      }
      
      const stat = fs.statSync(absoluteDirPath)
      if (!stat.isDirectory()) {
        throw new Error(`路径不是目录: ${absoluteDirPath}`)
      }
      
      const items = []
      
      if (recursive) {
        const walkDir = (currentPath) => {
          const files = fs.readdirSync(currentPath)
          for (const file of files) {
            const fullPath = path.join(currentPath, file)
            const fileStat = fs.statSync(fullPath)
            const relativePath = path.relative(absoluteDirPath, fullPath)
            
            items.push({
              name: file,
              path: relativePath,
              fullPath,
              type: fileStat.isDirectory() ? 'directory' : 'file',
              size: fileStat.size,
              modified: fileStat.mtime,
            })
            
            if (fileStat.isDirectory()) {
              walkDir(fullPath)
            }
          }
        }
        walkDir(absoluteDirPath)
      } else {
        const files = fs.readdirSync(absoluteDirPath)
        for (const file of files) {
          const fullPath = path.join(absoluteDirPath, file)
          const fileStat = fs.statSync(fullPath)
          const relativePath = path.relative(absoluteDirPath, fullPath)
          
          items.push({
            name: file,
            path: relativePath,
            fullPath,
            type: fileStat.isDirectory() ? 'directory' : 'file',
            size: fileStat.size,
            modified: fileStat.mtime,
          })
        }
      }
      
      ctx.logger.info(`[internal_file_list] 列出目录成功: ${absoluteDirPath}, 共 ${items.length} 项`)
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(items, null, 2),
          },
        ],
      }
    } catch (error) {
      ctx.logger.error(`[internal_file_list] 列出目录失败:`, error)
      throw new Error(`列出目录失败: ${error.message}`)
    }
  },
}

module.exports = listTool
