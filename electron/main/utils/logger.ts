import { createRequire } from 'node:module'
import { app } from 'electron'
import path from 'path'

const require = createRequire(import.meta.url)
const log = require('electron-log')

// Windows 下设置控制台输出编码
if (process.platform === 'win32') {
  try {
    if (process.stdout && typeof process.stdout.write === 'function') {
      process.stdout.setEncoding('utf8')
    }
    if (process.stderr && typeof process.stderr.write === 'function') {
      process.stderr.setEncoding('utf8')
    }
  } catch (error) {
    // 忽略错误
  }
}

// 配置日志
log.transports.file.resolvePathFn = variables =>
  path.join(app.getPath('userData'), 'logs', 'eechat-app', variables.fileName)
log.transports.file.level = 'debug'
log.transports.file.encoding = 'utf8'

// 确保控制台输出启用
log.transports.console.level = 'debug'
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

Object.assign(console, log.functions)

// 创建应用范围的日志实例
export const AppLog = log.scope('APP')
export const McpLog = log.scope('MCP')

// 导出日志实例供其他模块使用
export default log