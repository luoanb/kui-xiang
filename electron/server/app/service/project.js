const { Service } = require('egg')
const fs = require('fs')
const path = require('path')
const paths = require('../../config/paths')

const PROJECT_CONFIG_FILE = path.join(paths.projectPath, 'project.json')

class ProjectService extends Service {
  constructor(ctx) {
    super(ctx)
    this.ensureProjectDir()
  }

  /**
   * 确保项目配置目录存在
   */
  ensureProjectDir() {
    if (!fs.existsSync(paths.projectPath)) {
      fs.mkdirSync(paths.projectPath, { recursive: true })
    }
  }

  /**
   * 设置当前项目路径
   * @param {string} projectPath 项目路径
   */
  setProjectPath(projectPath) {
    try {
      const absolutePath = path.resolve(projectPath)
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`项目路径不存在: ${absolutePath}`)
      }

      const stat = fs.statSync(absolutePath)
      if (!stat.isDirectory()) {
        throw new Error(`项目路径不是目录: ${absolutePath}`)
      }

      const config = {
        currentPath: absolutePath,
        lastUpdated: Date.now(),
      }

      fs.writeFileSync(PROJECT_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
      
      this.ctx.logger.info(`[ProjectService] 设置项目路径: ${absolutePath}`)
      return { success: true, path: absolutePath }
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 设置项目路径失败:', error)
      throw error
    }
  }

  /**
   * 获取当前项目路径
   * @returns {string|null} 项目路径
   */
  getProjectPath() {
    try {
      if (!fs.existsSync(PROJECT_CONFIG_FILE)) {
        return null
      }

      const content = fs.readFileSync(PROJECT_CONFIG_FILE, 'utf-8')
      const config = JSON.parse(content)
      return config.currentPath || null
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 获取项目路径失败:', error)
      return null
    }
  }

  /**
   * 验证路径是否在项目范围内
   * @param {string} filePath 要验证的文件路径
   * @returns {boolean} 是否在范围内
   */
  validatePath(filePath) {
    const projectPath = this.getProjectPath()
    
    if (!projectPath) {
      return false
    }

    const absoluteFilePath = path.resolve(filePath)
    const absoluteProjectPath = path.resolve(projectPath)

    const relativePath = path.relative(absoluteProjectPath, absoluteFilePath)
    
    this.ctx.logger.info(`[ProjectService] 验证路径: ${absoluteFilePath}`, {
      projectPath: absoluteProjectPath,
      relativePath,
      isValid: !relativePath.startsWith('..'),
    })

    return !relativePath.startsWith('..')
  }

  /**
   * 解析文件路径为绝对路径
   * @param {string} filePath 文件路径
   * @returns {string} 绝对路径
   */
  resolvePath(filePath) {
    return path.resolve(filePath)
  }
}

module.exports = ProjectService
