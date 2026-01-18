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
      
      const oldCwd = process.cwd()
      process.chdir(absolutePath)
      const newCwd = process.cwd()
      
      this.ctx.logger.info(`[ProjectService] 设置项目路径: ${absolutePath}`)
      this.ctx.logger.info(`[ProjectService] 工作目录已切换: ${oldCwd} -> ${newCwd}`)
      
      return { success: true, path: absolutePath, oldCwd, newCwd }
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 设置项目路径失败:', error)
      throw error
    }
  }

  /**
   * 获取当前项目路径
   * @returns {string} 项目路径
   */
  getProjectPath() {
    try {
      console.log(`[ProjectService] 调用 getProjectPath，PROJECT_CONFIG_FILE: ${PROJECT_CONFIG_FILE}`)
      
      if (!fs.existsSync(PROJECT_CONFIG_FILE)) {
        console.warn(`[ProjectService] 项目配置文件不存在: ${PROJECT_CONFIG_FILE}`)
        // 返回当前工作目录作为默认路径
        const cwd = process.cwd()
        console.log(`[ProjectService] 返回当前工作目录作为默认路径: ${cwd}`)
        return cwd
      }

      const content = fs.readFileSync(PROJECT_CONFIG_FILE, 'utf-8')
      console.log(`[ProjectService] 读取配置文件内容: ${content}`)
      
      const config = JSON.parse(content)
      const projectPath = config.currentPath || process.cwd()
      console.log(`[ProjectService] getProjectPath 返回: ${projectPath}`)
      
      return projectPath
    } catch (error) {
      console.error('[ProjectService] 获取项目路径失败:', error)
      // 出错时也返回当前工作目录
      const cwd = process.cwd()
      console.log(`[ProjectService] 出错时返回当前工作目录: ${cwd}`)
      return cwd
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

  /**
   * 获取指定路径的直接子目录/文件（每次只返回一层）
   * @param {string} dirPath 目录路径
   * @returns {Array} 直接子目录/文件列表
   */
  getDirectoryChildren(dirPath) {
    try {
      const absolutePath = this.resolvePath(dirPath)
      
      // 添加日志：记录调用参数
      console.log(`[ProjectService] 调用 getDirectoryChildren，dirPath: ${dirPath}, absolutePath: ${absolutePath}`)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        console.error(`[ProjectService] 路径超出项目范围: ${absolutePath}`)
        throw new Error(`路径超出项目范围 : ${absolutePath}`)
      }

      const stat = fs.statSync(absolutePath)
      if (!stat.isDirectory()) {
        console.error(`[ProjectService] 路径不是目录: ${absolutePath}`)
        throw new Error(`路径不是目录: ${absolutePath}`)
      }

      const files = fs.readdirSync(absolutePath)
      console.log(`[ProjectService] 目录 ${absolutePath} 下找到 ${files.length} 个文件/目录: ${files.join(', ')}`)
      
      const result = []

      for (const file of files) {
        const filePath = path.join(absolutePath, file)
        const fileStat = fs.statSync(filePath)
        
        const item = {
          name: file,
          path: filePath,
          type: fileStat.isDirectory() ? 'directory' : 'file',
          size: fileStat.size,
          mtime: fileStat.mtime.getTime(),
          hasChildren: fileStat.isDirectory()
        }
        
        result.push(item)
      }

      console.log(`[ProjectService] getDirectoryChildren 返回 ${result.length} 项`)
      return result
    } catch (error) {
      console.error('[ProjectService] 获取目录子项失败:', error)
      throw error
    }
  }

  /**
   * 读取文件内容
   * @param {string} filePath 文件路径
   * @returns {string} 文件内容
   */
  readFile(filePath) {
    try {
      const absolutePath = this.resolvePath(filePath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      const stat = fs.statSync(absolutePath)
      if (!stat.isFile()) {
        throw new Error(`路径不是文件: ${absolutePath}`)
      }

      return fs.readFileSync(absolutePath, 'utf-8')
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 读取文件失败:', error)
      throw error
    }
  }

  /**
   * 写入文件内容
   * @param {string} filePath 文件路径
   * @param {string} content 文件内容
   */
  writeFile(filePath, content) {
    try {
      const absolutePath = this.resolvePath(filePath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      const dirPath = path.dirname(absolutePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      fs.writeFileSync(absolutePath, content, 'utf-8')
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 写入文件失败:', error)
      throw error
    }
  }

  /**
   * 创建文件
   * @param {string} filePath 文件路径
   * @param {string} content 文件内容（可选）
   */
  createFile(filePath, content = '') {
    try {
      const absolutePath = this.resolvePath(filePath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      if (fs.existsSync(absolutePath)) {
        throw new Error(`文件已存在: ${absolutePath}`)
      }

      const dirPath = path.dirname(absolutePath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      fs.writeFileSync(absolutePath, content, 'utf-8')
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 创建文件失败:', error)
      throw error
    }
  }

  /**
   * 创建目录
   * @param {string} dirPath 目录路径
   */
  createDirectory(dirPath) {
    try {
      const absolutePath = this.resolvePath(dirPath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      if (fs.existsSync(absolutePath)) {
        throw new Error(`目录已存在: ${absolutePath}`)
      }

      fs.mkdirSync(absolutePath, { recursive: true })
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 创建目录失败:', error)
      throw error
    }
  }

  /**
   * 删除文件
   * @param {string} filePath 文件路径
   */
  deleteFile(filePath) {
    try {
      const absolutePath = this.resolvePath(filePath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      const stat = fs.statSync(absolutePath)
      if (!stat.isFile()) {
        throw new Error(`路径不是文件: ${absolutePath}`)
      }

      fs.unlinkSync(absolutePath)
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 删除文件失败:', error)
      throw error
    }
  }

  /**
   * 删除目录
   * @param {string} dirPath 目录路径
   */
  deleteDirectory(dirPath) {
    try {
      const absolutePath = this.resolvePath(dirPath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absolutePath)) {
        throw new Error(`路径超出项目范围: ${absolutePath}`)
      }

      const stat = fs.statSync(absolutePath)
      if (!stat.isDirectory()) {
        throw new Error(`路径不是目录: ${absolutePath}`)
      }

      fs.rmSync(absolutePath, { recursive: true, force: true })
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 删除目录失败:', error)
      throw error
    }
  }

  /**
   * 重命名文件/目录
   * @param {string} oldPath 旧路径
   * @param {string} newPath 新路径
   */
  renameFile(oldPath, newPath) {
    try {
      const absoluteOldPath = this.resolvePath(oldPath)
      const absoluteNewPath = this.resolvePath(newPath)
      
      // 验证路径是否在项目范围内
      if (!this.validatePath(absoluteOldPath) || !this.validatePath(absoluteNewPath)) {
        throw new Error(`路径超出项目范围`)
      }

      if (!fs.existsSync(absoluteOldPath)) {
        throw new Error(`源路径不存在: ${absoluteOldPath}`)
      }

      const dirPath = path.dirname(absoluteNewPath)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      fs.renameSync(absoluteOldPath, absoluteNewPath)
    } catch (error) {
      this.ctx.logger.error('[ProjectService] 重命名文件/目录失败:', error)
      throw error
    }
  }
}

module.exports = ProjectService
