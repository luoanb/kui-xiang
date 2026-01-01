# 代码内逻辑启动流程图

下面的图展示了项目中关键代码的启动顺序与内部逻辑（Electron 主进程、EggJS 引导、IPC 注册、前端挂载与 IPC/HTTP 交互）。

```mermaid
%%{init: { 'theme': 'default' }}%%
```mermaid

```mermaid
flowchart TB
  subgraph Electron Main Process
    A1[app.whenReady()] --> A2[createWindow()]
    A2 --> A3[BrowserWindow 创建 & webPreferences preload]
    A3 --> A4{VITE_DEV_SERVER_URL?}
    A4 -->|是| A5[win.loadURL(VITE_DEV_SERVER_URL)]
    A4 -->|否| A6[win.loadFile(dist/index.html)]
    A5 --> A7[win.webContents.openDevTools() 可选]
    A6 --> A8[可选打开 DevTools]
    A3 --> A9[win.webContents.on('did-finish-load')\n send 'main-process-message']
    A2 --> B1[initialize AppUpdater]
    A2 --> B2[new Ipc() 初始化 ipcMain handlers]
    A2 --> B3[Playground 初始化]
    A2 --> B4[globalShortcut 注册快捷键]
    A2 --> C1[startEggServer()]
    C1 --> C2[session.resolveProxy() 获取系统代理]
    C2 --> C3[设置 process.env.http_proxy/https_proxy]
    C1 --> C4[egg.start({ baseDir })]
    C4 --> C5[appServer.listen(7002)]
    C4 --> C6[global.eggApp = appServer]
  end

  subgraph EggJS Boot
    D1[AppBootHook.configWillLoad()] --> D2[AppBootHook.willReady()]
    D2 --> D3[initializeProxy()]
    D2 --> D4[检查并创建数据库目录]
    D2 --> D5[await this.app.model.sync({ alter: true })]
    D5 --> D6[同步成功或处理 UniqueConstraintError 重试]
    D6 --> D7[AppBootHook.didReady() -> updateDatabase scripts]
    D7 --> D8[serverDidReady -> HTTP server 已启动]
  end

  subgraph IPC Handlers
    I1[new Ipc().init()] --> I2[ipcMain.handle('get-app-version')]
    I2 --> I3[路径/文件管理 handlers]
    I3 --> I4[下载管理 handlers 使用 downloader 工厂]
    I4 --> I5[read/save mcp config handlers]
    I5 --> I6[restart-mcp-server -> global.eggApp.messenger.sendToApp]
    I4 --> I7[download-tool -> downloader.downloadTool()\n 监听 taskCompleted/taskFailed]
  end

  subgraph Frontend
    R1[src/main.ts createApp() & mount('#app')] --> R2[postMessage removeLoading]
    R2 --> R3[调用 init() (src/lib/init.js)]
    R3 --> R4[引用 ./demos/ipc -> 使用 window.ipcRenderer.invoke]
    R4 --> R5[调用 ipc: start-download-task, startEggServer 等]
    R5 -->|HTTP| R6[调用后端 API (http://localhost:7002)]
    R5 -->|IPC| M1[与主进程通信: open-win, toggle-devtools, open-url, set-mini-mode]
  end

  A1 --> D1
  C5 --> R6
  I4 --> downloader[downloader 实例]
  style downloader fill:#f9f,stroke:#333,stroke-width:1px

```

简要说明：
- Electron 启动后走 `app.whenReady()` -> `createWindow()`，决定加载开发 server 或打包文件；同时初始化 `Ipc`、`AppUpdater`、`Playground`、快捷键，并调用 `startEggServer()` 启动内嵌的 EggJS（监听 7002）。
- EggJS 的 `AppBootHook` 在 `willReady()` 中执行代理与数据库初始化与 `model.sync()`，在 `didReady()` 中运行 `scripts/updateDatabase`。
- `Ipc` 在构造时注册大量 `ipcMain.handle`，包含下载管理、工具下载、配置读写与重启 MCP 服务器的能力，下载使用 `downloader` 工厂并监听完成/失败事件。
- 前端在挂载后会调用 `init()` 与 `./demos/ipc`，通过 `window.ipcRenderer.invoke` 与主进程交互，并通过 HTTP 调用本地 Egg 后端的 API。
