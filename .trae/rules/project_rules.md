# 项目规则

## 项目信息
- 项目名称: eechat
- 项目类型: Electron + Vue3 聊天应用
- 包管理器: pnpm

## 项目启动
用户自己启动，你无需管理
### 前端开发
**无需单独启动**
启动 Vite 开发服务器（默认端口 3344）

### 后端服务器
**无需单独启动**
启动 Egg.js 后端服务器（在 electron/server 目录）

## 项目结构
- `electron/main/` - Electron 主进程代码
  - `index.ts` - 主进程入口文件
  - `ipc.ts` - IPC 通信处理
  - `updater.ts` - 自动更新
- `electron/preload/` - 预加载脚本
- `electron/server/` - Egg.js 后端服务器
  - `app/controller/` - 控制器层
  - `app/service/` - 服务层
  - `app/model/` - 数据模型
  - `app/router.js` - 路由配置
- `src/` - Vue3 前端代码
  - `components/` - 组件
  - `api/` - API 请求
  - `assets/` - 静态资源
- `packages/` - Monorepo 子包
  - `agents/` - Agent 相关
  - `rag/` - RAG 相关
  - `ui/` - UI 组件库

## 构建和打包
### 类型检查
```bash
vue-tsc --noEmit
```

### 构建前端
```bash
vite build
```

### 打包应用
- Windows: `pnpm run build:win`
- macOS: `pnpm run build:mac`
- Linux: `pnpm run build:linux`
- 通用打包: `pnpm run package`

## 其他命令
- 预览构建: `pnpm run preview`
- 文档开发: `pnpm run docs:dev`
- i18n 提取: `pnpm run i18n:extract`

## 技术栈
- 前端: Vue3 + TypeScript + Vite + TailwindCSS
- 后端: Egg.js + Node.js
- 桌面: Electron
- 状态管理: Pinia
- 路由: Vue Router
- UI 组件: Radix Vue + Reka UI
- 数据库: SQLite3 (egg-sequelize)

## 进程通信架构

### 1. Electron 主进程 ↔ 渲染进程（Vue3）
- **通信方式**：Electron IPC（进程间通信）
- **渲染进程调用主进程**：
  - 使用 `window.ipcRenderer.invoke(channel, ...args)` 发送请求
  - 主进程通过 `ipcMain.handle(channel, handler)` 处理请求
- **主进程主动推送**：
  - 使用 `win.webContents.send(channel, ...args)` 推送消息
  - 渲染进程通过 `window.ipcRenderer.on(channel, listener)` 监听

### 2. Electron 主进程 ↔ Egg.js 后端服务器
- **启动方式**：
  - 开发模式：通过 `spawn('npx', ['egg-bin', 'dev', ...])` 启动子进程（支持热更新）
  - 生产模式：通过 `egg.start({ baseDir, env })` 启动服务器
- **监听端口**：7002
- **通信方式**：
  - 通过 `global.eggApp` 全局变量访问 Egg.js 应用实例
  - 使用 `app.messenger` 进行进程间消息传递
  - 示例：`global.eggApp.messenger.sendToApp('restart-filesystem-mcp', folderPath)`
- **生命周期管理**：
  - 启动：在 `app.whenReady()` 中调用 `startEggServer()`
  - 停止：在 `app.on('window-all-closed')` 中调用 `stopEggServer()`

### 3. 渲染进程 ↔ Egg.js 后端服务器
- **通信方式**：HTTP 请求
- **基础 URL**：`http://127.0.0.1:7002`
- **API 路由**：定义在 `electron/server/app/router.js`
- **主要接口**：
  - `/api/chat/*` - 聊天相关
  - `/api/message/*` - 消息管理
  - `/api/llm/*` - LLM 模型配置
  - `/api/mcp/*` - MCP 服务器管理
  - `/api/rag/*` - RAG 知识库
  - `/api/ollama/*` - Ollama 本地模型
  - `/api/tts/*` - 语音合成

### 4. 预加载脚本（Preload）
- **文件位置**：`electron/preload/index.ts`
- **作用**：在渲染进程中安全地暴露 Electron API
- **暴露的 API**：
  - `window.ipcRenderer` - IPC 通信接口
  - `window.electron` - 平台信息等

### 5. 进程通信示例
```typescript
// 渲染进程调用主进程
const result = await window.ipcRenderer.invoke('get-app-paths')

// 主进程处理请求
ipcMain.handle('get-app-paths', () => {
  return { config: '...', database: '...' }
})

// 主进程调用 Egg.js 服务
if (global.eggApp && global.eggApp.messenger) {
  global.eggApp.messenger.sendToApp('restart-mcp-server')
}

// Egg.js 监听消息
app.messenger.on('restart-filesystem-mcp', async (folderPath) => {
  // 处理重启逻辑
})

// 渲染进程调用后端 API
const response = await fetch('http://127.0.0.1:7002/api/llm/providers')
```

## 开发注意事项
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 规范
- 使用 pnpm workspace 管理依赖
- 主进程和渲染进程通过 IPC 通信
- Egg.js 服务器在主进程启动时自动启动，无需单独启动

# log
统一使用console.log进行日志输出
