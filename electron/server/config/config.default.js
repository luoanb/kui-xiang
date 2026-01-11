const path = require('path')
const paths = require('./paths')

module.exports = appInfo => {
  const config = (exports = {})

  // 使用环境变量来区分环境
  const isProd = process.env.NODE_ENV === 'production'

  // 基础配置
  config.keys = appInfo.name + '_1740383378737_8971'
  config.middleware = []

  // 跨域配置
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  }

  // 根据环境配置不同的端口
  config.cluster = {
    listen: {
      port: isProd ? 7001 : 7002,
    },
  }

  // 安全配置
  config.security = {
    csrf: {
      enable: false,
    },
    xframe: {
      enable: false,
    },
    domainWhiteList: ['*'],
  }

  // 日志
  config.logger = {
    dir: path.join(paths.logsPath, 'eechat-server'),
    allowDebugAtProd: false,
    level: 'NONE', 
    consoleLevel: 'NONE',
    encoding: "utf-8",
    when: 'D',
    keepFileExt: true,
    maxFiles: 10,
    outputJSON: false, // 以可读格式输出，而不是 JSON
    disableConsoleAfterReady: true, // 确保应用启动后控制台输出不被禁用
  }

  // 添加数据库配置
  config.sequelize = {
    dialect: 'sqlite',
    storage: paths.databasePath,
    // storage: path.join(app.getPath('userData'), 'database', 'database.db'),
    // storage: path.join(__dirname, '../database/database.db'),
    define: {
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      underscored: true,
      constraints: false, // 禁用外键约束
    },
    logging: false, // 关闭 SQL 日志
    // logging: console.log,
    // sync: process.env.NODE_ENV !== 'production', // 非生产环境下自动同步
  }
  config.cors = {
    // credentials: true,
    // origin: ctx => ctx.get('origin'),
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
  }

  config.i18n = {
    defaultLocale: 'en-US',
    writeCookie: false,
    queryField: 'locale',
    cookieField: 'locale',
    cookieMaxAge: '1y',
  }

  // 文件上传
  config.multipart = {
    fileSize: '100mb',
    mode: 'file',
    tmpdir: path.join(paths.tmpPath, 'upload'),
    whitelist: [
      '.pdf',
      '.docx',
      '.doc',
      '.txt',
      '.md',
      '.csv',
      '.xlsx',
      '.xls',
      '.pptx',
      '.ppt',
      '.html',
      '.json',
    ],
    cleanSchedule: {
      // run tmpdir clean job on every day 04:30 am
      // cron: '0 30 4 * * *',
      // disable: true,
    },
  }

  return config
}
