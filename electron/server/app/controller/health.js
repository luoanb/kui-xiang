const { Controller } = require('egg');

class HealthController extends Controller {
  /**
   * 健康检查接口
   * 用于前端检测后端服务是否已启动完成
   */
  async check() {
    const { ctx } = this;
    
    try {
      // 返回服务状态信息
      ctx.body = ctx.helper.success({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'egg-server',
        version: '1.0.0',
        uptime: process.uptime(),
      });
    } catch (error) {
      ctx.logger.error('健康检查失败:', error);
      ctx.body = ctx.helper.error('健康检查失败', -1);
    }
  }

  /**
   * 简单ping接口，用于快速检测服务是否可达
   */
  async ping() {
    const { ctx } = this;
    ctx.body = ctx.helper.success({
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = HealthController;