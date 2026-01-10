const paths = require('./config/paths');
const path = require('path');
const fs = require('fs');
const { SocksProxyAgent } = require('socks-proxy-agent');
const https = require('https');
const http = require('http');

// 在任何代理设置之前保存原始agent
const ORIGINAL_AGENTS = {
  https: https.globalAgent,
  http: http.globalAgent
};

// 将原始agent暴露给其他模块使用
global.ORIGINAL_AGENTS = ORIGINAL_AGENTS;

/**
 * 初始化SOCKS代理设置
 */
function initializeProxy() {
  try {
    const configFile = path.join(paths.configPath, 'proxy.config.json');
    
    if (fs.existsSync(configFile)) {
      const configContent = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.enabled) {
        let proxyUrl;
        
        if (config.username && config.password) {
          proxyUrl = `socks5://${config.username}:${config.password}@${config.host}:${config.port}`;
        } else {
          proxyUrl = `socks5://${config.host}:${config.port}`;
        }
        
        if (proxyUrl) {
          const agent = new SocksProxyAgent(proxyUrl);
          https.globalAgent = agent;
          http.globalAgent = agent;
          
          console.log('SOCKS代理已启用:', {
            host: config.host,
            port: config.port
          });
        }
      } else {
        // 恢复到真正的原始agent
        https.globalAgent = ORIGINAL_AGENTS.https;
        http.globalAgent = ORIGINAL_AGENTS.http;
        console.log('[app_js]', '代理已禁用');
      }
    } else {
      console.log('[app_js]', '未找到代理配置文件，使用默认设置');
    }
  } catch (error) {
    console.error('初始化代理设置失败:', error);
  }
}

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  configWillLoad() {
    this.app.logger.info("[AppDataPath]:", paths.appDataPath);
  }

  async didLoad() {
  }

  async willReady() {
    try {
      // 初始化代理
      initializeProxy();
      // 检查数据库目录
      const dbDir = path.dirname(this.app.config.sequelize.storage);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // 同步数据库结构
      await this.app.model.sync({ 
        alter: true,
        force: false,
        hooks: {
          beforeSync: async (options) => {
            this.app.logger.info('开始同步数据库结构...');
          },
          afterSync: async (options) => {
            this.app.logger.info('数据库结构同步完成');
          }
        }
      });
      
      this.app.logger.info('数据库结构同步成功');
      
      // 切换到用户选择的项目路径
      const projectService = this.app.service.project;
      const projectPath = projectService.getProjectPath();
      
      if (projectPath) {
        this.app.logger.info(`[工作目录] 切换到项目路径: ${projectPath}`);
        process.chdir(projectPath);
        this.app.logger.info(`[工作目录] 当前工作目录: ${process.cwd()}`);
      } else {
        this.app.logger.info('[工作目录] 未设置项目路径，使用默认工作目录');
      }
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        this.app.logger.warn('检测到备份表冲突，尝试使用替代方案同步...');
        try {
          await this.app.model.sync({ force: false });
          this.app.logger.info('数据库结构同步成功(替代方案)');
        } catch (retryError) {
          this.app.logger.error('数据库结构同步失败(替代方案):', retryError);
        }
      } else {
        this.app.logger.error('数据库结构同步失败:', error);
      }
    }
  }

  async didReady() {
    try {
      const updateDatabase = require('./scripts/updateDatabase');
      await updateDatabase(this.app.logger);
      this.app.logger.info('数据库初始化/更新成功');
      // 尝试在 didReady 中初始化 MCP，确保在生命周期中尽早触发
      try {
        console.log('[MCP] 尝试在 didReady 中触发初始化')
        try {
          // 创建一个匿名 ctx，使用 ctx.service 可以触发服务的懒加载
          const ctx = this.app.createAnonymousContext()
          try {
            const svcKeys = ctx && ctx.service ? Object.keys(ctx.service) : []
            console.log('[MCP] ctx.service keys:', svcKeys)
          } catch (e) {
            console.log('[MCP] 无法列出 ctx.service keys', e)
          }

          console.log('[MCP] 尝试通过 ctx.service 访问 mcp:', !!(ctx && ctx.service && ctx.service.mcp))

          if (ctx && ctx.service && ctx.service.mcp) {
            await ctx.service.mcp.ensureInitialized()
            console.log("[MCP] filesystem初始化");
            if (this.app.messenger) {
              this.app.messenger.on('restart-filesystem-mcp', async (folderPath) => {
                this.app.logger.info('[MCP] 收到重启 filesystem MCP 的请求，路径:', folderPath)
                try {
                  const result = await ctx.service.mcp.restartFilesystemServer()
                  this.app.logger.info('[MCP] filesystem MCP 重启结果:', result)
                } catch (error) {
                  this.app.logger.error('[MCP] 重启 filesystem MCP 失败:', error)
                }
              })
            }
            this.app.logger.info('[MCP] didReady (via ctx) 初始化完成')
          } else {
            this.app.logger.info('[MCP] didReady (via ctx) 未找到 mcp service，跳过')
          }
        } catch (err) {
          this.app.logger.error('[MCP] didReady 初始化失败:', err)
        }
      } catch (err) {
        this.app.logger.error('[MCP] didReady 初始化失败:', err)
      }
    } catch (error) {
      this.app.logger.error('数据库初始化/更新失败:', error);
    }
  }

  async serverDidReady() {
    // http / https server 已启动
  }

  async beforeClose() {
    this.app.logger.info('[AppBootHook] 应用即将关闭')
  }
}

module.exports = AppBootHook;
