# 项目启动流程图

下面是 eechat 项目的启动流程图（Mermaid）：

```mermaid
%%{init: { 'theme': 'default' }}%%
```mermaid

```mermaid
%% 请在支持 mermaid 的渲染器中查看此图
```

```mermaid
flowchart LR
  A[开发者] --> B{选择模式}
  B -->|开发| C["pnpm dev<br/> (vite dev server)"]
  B -->|开发（后端）| D["pnpm run dev:server<br/> (eggjs on 7002)"]
  B -->|运行 Electron（Dev）| E["Electron 主进程<br/> (electron/main/index.ts)"]
  E --> F{VITE_DEV_SERVER_URL 存在?}
  F -->|是| G["loadURL(VITE_DEV_SERVER_URL)<br/> (前端热重载)"]
  F -->|否| H["loadFile(dist/index.html)<br/> (生产静态文件)"]
  E --> I["startEggServer()<br/> (启动 electron/server 的 EggJS，监听 7002)"]
  G --> J["前端 (src/main.ts)<br/> -> init() -> IPC"]
  H --> J
  D --> I
  C --> J
  subgraph 打包/生产
    K["pnpm run package / build:pord"]
    K --> L["vite build -> dist"]
    L --> M["electron-builder 打包 -> dist-electron"]
    M --> N["安装/运行打包的 App"]
    N --> H
    N --> I
  end
  J --> O["前端 <-> 主进程 (IPC)"]
  O --> P["后端 API (http://localhost:7002)"]
```

简要说明：
- 开发模式时，`pnpm dev` 启动 Vite 前端（由 `src/main.ts` 作为入口），`pnpm run dev:server` 启动 `electron/server` 内的 EggJS（端口 7002）。
- Electron 主进程在存在 `VITE_DEV_SERVER_URL` 时会加载 dev server，否则加载打包后的静态 `dist/index.html`。主进程会调用 `startEggServer()` 启动内嵌后端。
