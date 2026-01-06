import { app, BrowserWindow, shell, ipcMain, screen, session, globalShortcut } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'child_process'
import { AppUpdater, registerUpdaterHandlers } from './updater'
// import { registerLlamaHandlers } from './playground/nodeLlamaCpp'
import { Playground } from './playground/playground'
import { Analytics } from './analytics'
import { Ipc } from './ipc'
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = app.isPackaged ? 'production' : 'development'
}

// import log from 'electron-log/main'
import log, { AppLog } from './utils/logger'

// 捕获未处理的异常
process.on('uncaughtException', error => {
  log.error('未捕获的异常:', error)
})

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  let cmd
  if (process.platform === 'win32') {
    cmd = 'taskkill /F /IM eechat.exe'
    spawn('cmd.exe', ['/c', cmd], { detached: true, stdio: 'ignore' })
  } else if (process.platform === 'darwin') {
    cmd = 'pkill -9 eechat'
    spawn('bash', ['-c', cmd], { detached: true, stdio: 'ignore' })
  } else if (process.platform === 'linux') {
    cmd = 'pkill -9 eechat'
    spawn('bash', ['-c', cmd], { detached: true, stdio: 'ignore' })
  }
}

app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI')

let win: BrowserWindow | null = null
let updater: AppUpdater | null = null
// let nodeLlamaCpp: any
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const windowWidth = Math.min(1200, width * 0.8)
  const windowHeight = Math.min(800, height * 0.8)
  new Analytics()
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    width: windowWidth,
    height: windowHeight,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#666666',
      // height: 64,
    },
    webPreferences: {
      preload,
      webSecurity: false,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  win.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // 开发模式下始终打开开发者工具
    win.webContents.openDevTools()
    
    // 开发模式下，确保 DevTools 可以访问 Memory 面板
    if (process.env.NODE_ENV !== 'production') {
      // 延迟打开，确保页面加载完成
      win.webContents.once('did-finish-load', () => {
        // 输出提示信息
        console.log('\n=== Chrome DevTools 内存分析指南 ===')
        console.log('1. 打开 DevTools (F12 或 Ctrl+Shift+I)')
        console.log('2. 切换到 "Memory" 标签')
        console.log('3. 选择 "Heap snapshot" 或 "Allocation instrumentation on timeline"')
        console.log('4. 点击 "Take snapshot" 记录内存快照')
        console.log('5. 操作应用后再次快照，对比差异')
        console.log('6. 使用 IPC: window.electronAPI.invoke("get-renderer-memory-info") 获取内存信息')
        console.log('=====================================\n')
      })
    }
  } else {
    win.loadFile(indexHtml)
    // 生产模式下也可以通过环境变量控制是否打开开发者工具
    if (process.env.OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools()
    }
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344
  win.webContents.on('will-navigate', (event, url) => {
    // 阻止应用内导航
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  // 初始化更新器
  // if (app.isPackaged) {
    updater = new AppUpdater(win)
    registerUpdaterHandlers(updater)
  // }
  // 保存返回的 llamaService 实例
  // const nodeLlamaCpp = registerLlamaHandlers()
  // console.log('Llama handlers registered successfully')
}

let appServer: any = null
const egg = require('egg')
async function startEggServer(pathArg): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    const isDev = process.env.NODE_ENV !== 'production'
    log.info('isDev:', isDev)
    const baseDir = isDev
      ? path.join(__dirname, '../../electron/server')
      : path.join(process.resourcesPath, 'app.asar.unpacked')
    
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
    
    // 获取系统代理设置
    try {
      // 使用 Electron 的 session API 获取系统代理
      const proxySettings = await session.defaultSession.resolveProxy('https://www.google.com')
      log.info('系统代理设置:', proxySettings)
      
      if (proxySettings && proxySettings !== 'DIRECT') {
        // 解析代理字符串，格式通常为 "PROXY host:port" 或 "DIRECT"
        const match = proxySettings.match(/PROXY\s+([^;\s]+)/)
        if (match && match[1]) {
          const proxyUrl = `http://${match[1]}`
          log.info(`设置系统代理: ${proxyUrl}`)
          process.env.http_proxy = proxyUrl
          process.env.https_proxy = proxyUrl
        }
      }
      
      appServer = await egg.start({
        baseDir: baseDir,
        // mode: 'single',
        // typescript: false,
        env: process.env.NODE_ENV // Pass the NODE_ENV string instead of the entire process.env object
      })
      appServer.listen(7002)
      log.info(`Server started on ${7002}`)
      resolve()
    } catch (error) {
      reject(error)
    }
  })
}
async function stopEggServer(): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    try {
      console.log('[index_ts]', appServer)

      await appServer.close()
      console.log('[index_ts]', `Server stoped`)
    } catch (error) {
      log.error(error)
      reject(error)
    }
  })
}

const initUpdate = () => {
  if (app.isPackaged && updater) {
    setTimeout(() => {
      updater.checkUpdate()
    }, 3000)
  }
}

// 内存监控函数
function startMemoryMonitor() {
  if (process.env.NODE_ENV !== 'production') {
    const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)
    
    setInterval(() => {
      const mem = process.memoryUsage()
      
      log.info('[Memory Monitor]', {
        rss: `${formatMB(mem.rss)} MB`,
        heapUsed: `${formatMB(mem.heapUsed)} MB`,
        heapTotal: `${formatMB(mem.heapTotal)} MB`,
        external: `${formatMB(mem.external)} MB`,
        arrayBuffers: `${formatMB(mem.arrayBuffers)} MB`
      })
      
      // 内存警告阈值
      if (mem.heapUsed > 500 * 1024 * 1024) { // 500MB
        log.warn('[Memory Monitor] 警告: 堆内存使用超过 500MB')
      }
      if (mem.rss > 1024 * 1024 * 1024) { // 1GB
        log.warn('[Memory Monitor] 警告: RSS 内存使用超过 1GB')
      }
    }, 10000) // 每 10 秒监控一次
    
    log.info('[Memory Monitor] 内存监控已启动')
  }
}

// 监控渲染进程内存（通过 DevTools API）
function monitorRendererMemory() {
  if (win && !win.isDestroyed() && process.env.NODE_ENV !== 'production') {
    win.webContents.executeJavaScript(`
      (() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })()
    `).then((mem: any) => {
      if (mem) {
        const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)
        log.info('[Renderer Memory]', {
          used: `${formatMB(mem.usedJSHeapSize)} MB`,
          total: `${formatMB(mem.totalJSHeapSize)} MB`,
          limit: `${formatMB(mem.jsHeapSizeLimit)} MB`,
          usage: `${((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(2)}%`
        })
        
        // 渲染进程内存警告
        if (mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.8) {
          log.warn('[Renderer Memory] 警告: 渲染进程内存使用超过 80%')
        }
      }
    }).catch((err) => {
      // 忽略错误，可能是页面未加载完成
    })
  }
}

// 在 app ready 时启动 EggJS
app.whenReady().then(async () => {
  try {
    startMemoryMonitor()
    createWindow()
    
    // 启动渲染进程内存监控
    if (process.env.NODE_ENV !== 'production') {
      // 等待窗口加载完成后开始监控
      if (win) {
        win.webContents.once('did-finish-load', () => {
          // 每 10 秒监控一次渲染进程内存
          setInterval(() => {
            monitorRendererMemory()
          }, 10000)
        })
      }
    }
    
    await startEggServer('')
    initUpdate()
    const playground = new Playground(win)
    
    // 注册全局快捷键来切换开发者工具
    // F12 或 Ctrl+Shift+I (Windows/Linux) / Cmd+Option+I (macOS)
    globalShortcut.register('F12', () => {
      if (win) {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools()
        } else {
          win.webContents.openDevTools()
        }
      }
    })
    
    // Ctrl+Shift+I (Windows/Linux)
    if (process.platform !== 'darwin') {
      globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (win) {
          if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools()
          } else {
            win.webContents.openDevTools()
          }
        }
      })
    } else {
      // Cmd+Option+I (macOS)
      globalShortcut.register('Command+Option+I', () => {
        if (win) {
          if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools()
          } else {
            win.webContents.openDevTools()
          }
        }
      })
    }
    
    log.info('开发者工具快捷键已注册: F12 或 Ctrl+Shift+I (Windows/Linux) / Cmd+Option+I (macOS)')
  } catch (error) {
    console.error('Failed to start EggJS server:', error)
  }
})

// 在应用退出时关闭 EggJS 进程
app.on('window-all-closed', () => {
  // win = null
  console.log('[index_ts]', 'window-all-closed')
  // 注销所有全局快捷键
  globalShortcut.unregisterAll()
  appServer.close()
  app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// 初始化 Ipc 实例
new Ipc()

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

// 切换开发者工具的 IPC 处理器
ipcMain.handle('toggle-devtools', () => {
  if (win) {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools()
      return false
    } else {
      win.webContents.openDevTools()
      return true
    }
  }
  return false
})

// 打开开发者工具
ipcMain.handle('open-devtools', () => {
  if (win) {
    win.webContents.openDevTools()
    return true
  }
  return false
})

// 关闭开发者工具
ipcMain.handle('close-devtools', () => {
  if (win) {
    win.webContents.closeDevTools()
    return true
  }
  return false
})

// ipcMain.handle('exec', async (_, command) => {
//   const { exec } = require('child_process')
//   return new Promise((resolve, reject) => {
//     exec(command, (error, stdout, stderr) => {
//       if (error) {
//         reject(error)
//         return
//       }
//       resolve(stdout)
//     })
//   })
// })

// 添加打开外部链接的 handler
ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url)
})

// 添加打开下载页面的 handler
ipcMain.handle('open-url', (_, url) => {
  return shell.openExternal(url)
})

// 保存窗口原始状态
let originalBounds = null

// 处理迷你模式切换
ipcMain.handle('set-mini-mode', (event, isMini) => {
  console.log('[index_ts]', 'set-mini-mode');
  
  // const win = BrowserWindow.fromWebContents(event.sender)
  // if (!win) return false
  
  if (isMini) {
    originalBounds = win.getBounds()
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const miniHeight = Math.floor(height * 2 / 3); // 屏幕高度的2/3
    const miniWidth = Math.floor(miniHeight * 350 / 700); // 按照350:700的比例计算宽度
    // win.setAlwaysOnTop(true)
    win.setMinimizable(false)
    win.setMaximizable(false)
    // win.setResizable(false)
    win.setSize(miniWidth, miniHeight)
    win.setPosition(width - miniWidth - 20, Math.floor((height - miniHeight) / 2))
    // win.setOpacity(0.96)
    return true
  } else {
    // 恢复原始窗口状态
    win.setAlwaysOnTop(false)
    win.setMinimizable(true)
    win.setMaximizable(true)
    win.setResizable(true)
    
    if (originalBounds) {
      win.setBounds(originalBounds)
      originalBounds = null
    } else {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize
      const windowWidth = Math.min(1200, width * 0.8)
      const windowHeight = Math.min(800, height * 0.8)
      // 先设置不透明度
      // win.setOpacity(1)
      // 计算居中位置
      const x = Math.floor((width - windowWidth) / 2)
      const y = Math.floor((height - windowHeight) / 2)
      win.setBounds({
        x: x,
        y: y,
        width: windowWidth,
        height: windowHeight
      })
    }
    return true
  }
})

// 处理窗口置顶状态切换
ipcMain.handle('toggle-always-on-top', (event) => {
  if (!win) return false
  
  const isAlwaysOnTop = win.isAlwaysOnTop()
  win.setAlwaysOnTop(!isAlwaysOnTop)
  
  return !isAlwaysOnTop
})

// startEggServer
ipcMain.handle('startEggServer', async (_, pathArg) => {
  try {
    const res = await startEggServer(pathArg)
    return res
  } catch (error) {
    console.error('Failed to start EggJS server:', error)
    return error
  }
})
// stopEggServer
ipcMain.handle('stopEggServer', async (_, pathArg) => {
  try {
    const res = await stopEggServer()
    return res
  } catch (error) {
    console.error('Failed to stop EggJS server:', error)
    return error
  }
})

// 获取主进程内存信息
ipcMain.handle('get-memory-info', () => {
  const mem = process.memoryUsage()
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers
  }
})

// 获取渲染进程内存信息
ipcMain.handle('get-renderer-memory-info', async () => {
  if (!win || win.isDestroyed()) {
    return null
  }
  
  try {
    const mem = await win.webContents.executeJavaScript(`
      (() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })()
    `)
    return mem
  } catch (error) {
    log.error('[Memory] 获取渲染进程内存信息失败:', error)
    return null
  }
})

// 强制垃圾回收（仅在开发模式下，需要启动时添加 --expose-gc 标志）
ipcMain.handle('force-gc', () => {
  if (process.env.NODE_ENV !== 'production' && global.gc) {
    global.gc()
    log.info('[Memory] 已执行强制垃圾回收')
    return true
  }
  return false
})

app.on('render-process-gone', (event, webContents, details) => {
  const mem = process.memoryUsage()
  const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)
  
  log.error('渲染进程崩溃:', {
    reason: details.reason,
    exitCode: details.exitCode,
    memory: {
      rss: `${formatMB(mem.rss)} MB`,
      heapUsed: `${formatMB(mem.heapUsed)} MB`,
      heapTotal: `${formatMB(mem.heapTotal)} MB`
    }
  })
  app.exit()
})

// 添加更详细的错误处理
process.on('unhandledRejection', (reason, promise) => {
  log.error('未处理的 Promise 拒绝:- 原因:', reason);
  
  // 创建一个对话框显示错误
  // if (win) {
  //   const { dialog } = require('electron')
  //   dialog.showErrorBox(
  //     '应用程序错误',
  //     `发生未处理的错误:\n${reason instanceof Error ? reason.stack : String(reason)}`
  //   );
  // }
});
