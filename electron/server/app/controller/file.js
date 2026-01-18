const { Controller } = require('egg')

class FileController extends Controller {
  /**
   * 获取指定路径的直接子目录/文件
   * GET /api/file/children?path=xxx
   */
  async getChildren() {
    try {
      const { ctx } = this
      const { path: dirPath } = ctx.query
      
      console.log(`[FileController] getChildren 请求，path: ${dirPath}`)
      
      const projectPath = await ctx.service.project.getProjectPath()
      console.log(`[FileController] 获取到项目路径: ${projectPath}`)
      
      if (!projectPath) {
        console.error('[FileController] 未设置项目路径')
        ctx.body = ctx.helper.error('未设置项目路径')
        return
      }

      const children = await ctx.service.project.getDirectoryChildren(dirPath || projectPath)
      
      console.log(`[FileController] getChildren 返回 ${children.length} 项`)
      
      ctx.body = ctx.helper.success({
        path: dirPath || projectPath,
        children
      })
    } catch (error) {
      console.error('[FileController] 获取目录子项失败:', error)
      ctx.body = ctx.helper.error(error.message || '获取目录子项失败')
    }
  }

  /**
   * 读取文件内容
   * GET /api/file/read?path=xxx
   */
  async readFile() {
    try {
      const { ctx } = this
      const { path: filePath } = ctx.query
      
      if (!filePath) {
        ctx.body = ctx.helper.error('文件路径不能为空')
        return
      }

      const content = await ctx.service.project.readFile(filePath)
      
      ctx.body = ctx.helper.success({
        path: filePath,
        content
      })
    } catch (error) {
      this.ctx.logger.error('[FileController] 读取文件失败:', error)
      this.ctx.body = ctx.helper.error(error.message || '读取文件失败')
    }
  }

  /**
   * 写入文件内容
   * POST /api/file/write
   * Body: { path: string, content: string }
   */
  async writeFile() {
    try {
      const { ctx } = this
      const { path: filePath, content } = ctx.request.body
      
      if (!filePath) {
        ctx.body = ctx.helper.error('文件路径不能为空')
        return
      }

      await ctx.service.project.writeFile(filePath, content)
      
      ctx.body = ctx.helper.success(null, '文件写入成功')
    } catch (error) {
      this.ctx.logger.error('[FileController] 写入文件失败:', error)
      this.ctx.body = ctx.helper.error(error.message || '写入文件失败')
    }
  }

  /**
   * 创建文件/目录
   * POST /api/file/create
   * Body: { path: string, type: 'file' | 'directory', content?: string }
   */
  async createFile() {
    try {
      const { ctx } = this
      const { path: filePath, type, content } = ctx.request.body
      
      if (!filePath || !type) {
        ctx.body = ctx.helper.error('文件路径和类型不能为空')
        return
      }

      if (type === 'file') {
        await ctx.service.project.createFile(filePath, content || '')
      } else if (type === 'directory') {
        await ctx.service.project.createDirectory(filePath)
      } else {
        ctx.body = ctx.helper.error('无效的类型，必须是 file 或 directory')
        return
      }
      
      ctx.body = ctx.helper.success(null, `${type === 'file' ? '文件' : '目录'}创建成功`)
    } catch (error) {
      this.ctx.logger.error('[FileController] 创建文件/目录失败:', error)
      this.ctx.body = ctx.helper.error(error.message || '创建文件/目录失败')
    }
  }

  /**
   * 删除文件/目录
   * DELETE /api/file/delete?path=xxx&type=file|directory
   */
  async deleteFile() {
    try {
      const { ctx } = this
      const { path: filePath, type } = ctx.query
      
      if (!filePath || !type) {
        ctx.body = ctx.helper.error('文件路径和类型不能为空')
        return
      }

      if (type === 'file') {
        await ctx.service.project.deleteFile(filePath)
      } else if (type === 'directory') {
        await ctx.service.project.deleteDirectory(filePath)
      } else {
        ctx.body = ctx.helper.error('无效的类型，必须是 file 或 directory')
        return
      }
      
      ctx.body = ctx.helper.success(null, `${type === 'file' ? '文件' : '目录'}删除成功`)
    } catch (error) {
      this.ctx.logger.error('[FileController] 删除文件/目录失败:', error)
      this.ctx.body = ctx.helper.error(error.message || '删除文件/目录失败')
    }
  }

  /**
   * 重命名文件/目录
   * PUT /api/file/rename
   * Body: { oldPath: string, newPath: string }
   */
  async renameFile() {
    try {
      const { ctx } = this
      const { oldPath, newPath } = ctx.request.body
      
      if (!oldPath || !newPath) {
        ctx.body = ctx.helper.error('旧路径和新路径不能为空')
        return
      }

      await ctx.service.project.renameFile(oldPath, newPath)
      
      ctx.body = ctx.helper.success(null, '重命名成功')
    } catch (error) {
      this.ctx.logger.error('[FileController] 重命名文件/目录失败:', error)
      this.ctx.body = ctx.helper.error(error.message || '重命名文件/目录失败')
    }
  }
}

module.exports = FileController
