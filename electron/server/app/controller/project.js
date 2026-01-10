const { Controller } = require('egg')

class ProjectController extends Controller {
  /**
   * 设置项目路径
   */
  async setProjectPath() {
    const { ctx } = this
    const { path } = ctx.request.body

    try {
      const result = await ctx.service.project.setProjectPath(path)
      ctx.body = ctx.helper.success(result)
    } catch (error) {
      ctx.logger.error('[ProjectController] 设置项目路径失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 获取当前项目路径
   */
  async getProjectPath() {
    const { ctx } = this

    try {
      const projectPath = await ctx.service.project.getProjectPath()
      ctx.body = ctx.helper.success({ projectPath })
    } catch (error) {
      ctx.logger.error('[ProjectController] 获取项目路径失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }

  /**
   * 验证路径是否在项目范围内
   */
  async validatePath() {
    const { ctx } = this
    const { path } = ctx.request.body

    try {
      const isValid = await ctx.service.project.validatePath(path)
      ctx.body = ctx.helper.success({ isValid, path })
    } catch (error) {
      ctx.logger.error('[ProjectController] 验证路径失败:', error)
      ctx.body = ctx.helper.error(error.message)
    }
  }
}

module.exports = ProjectController
