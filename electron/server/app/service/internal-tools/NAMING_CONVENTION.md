# 内置工具 Name 规范

## 1. 命名规则

### 1.1 内置工具命名格式

```
internal_{groupName}_{action}
```

**规则：**
- 必须以 `internal_` 前缀开头
- 使用小写字母和下划线
- 名称格式：`internal_` + 分组名 + `_` + 操作名
- **分组名**：通过文件夹组织（如 `file`、`code`、`system`）
- **操作名**：通过文件名定义（如 `read`、`write`、`search`、`execute`）

### 1.2 文件夹组织结构

```
internal-tools/
├── file/                    # 文件操作分组
│   ├── read.js            # → internal_file_read
│   ├── write.js           # → internal_file_write
│   └── delete.js          # → internal_file_delete
├── code/                    # 代码操作分组
│   ├── search.js           # → internal_code_search
│   └── analyze.js          # → internal_code_analyze
└── system/                  # 系统操作分组
    ├── execute.js          # → internal_system_execute
    └── info.js             # → internal_system_info
```

**规则：**
- **文件夹名 = 分组名**（如 `file`、`code`、`system`）
- **文件名 = 操作名**（如 `read.js`、`write.js`、`search.js`）
- **最终工具名称 = `internal_{group}_{name}`**（自动组合）

### 1.3 当前内置工具列表

| 工具名称 | 分组 | 文件路径 | 功能描述 |
|---------|------|---------|---------|
| `internal_file_read` | file | `file/read.js` | 读取文件内容 |
| `internal_file_write` | file | `file/write.js` | 写入文件内容 |
| `internal_file_list` | file | `file/list.js` | 列出目录内容 |
| `internal_file_delete` | file | `file/delete.js` | 删除文件或目录 |
| `internal_file_mkdir` | file | `file/mkdir.js` | 创建目录 |
| `internal_file_move` | file | `file/move.js` | 移动文件或目录 |
| `internal_file_copy` | file | `file/copy.js` | 复制文件或目录 |
| `internal_code_search` | code | `code/search.js` | 在项目中搜索代码 |
| `internal_system_execute` | system | `system/execute.js` | 执行系统命令 |

### 1.4 命名示例

✅ **正确的命名：**

**文件定义：**
```javascript
// file/read.js
const tool = {
  name: 'read',  // 只写操作名
  description: '读取文件内容',
  handler: async (args, ctx) => { ... }
}

// 最终工具名称：internal_file_read
```

**工具名称：**
- `internal_file_read` - 读取文件（file 分组）
- `internal_file_write` - 写入文件（file 分组）
- `internal_file_delete` - 删除文件（file 分组）
- `internal_code_search` - 搜索代码（code 分组）
- `internal_code_analyze` - 分析代码（code 分组）
- `internal_system_execute` - 执行命令（system 分组）
- `internal_system_info` - 获取系统信息（system 分组）

❌ **错误的命名：**
- 在文件中定义 `internal_file_read` - 应该只写 `read`，分组由文件夹决定
- 使用大写字母 - 应该使用小写
- 使用连字符 - 应该使用下划线

### 1.5 分组命名规范

| 分组名 | 用途 | 示例工具 | 文件路径 |
|-------|------|----------|----------|
| `file` | 文件操作 | `internal_file_read`, `internal_file_write`, `internal_file_list`, `internal_file_delete`, `internal_file_mkdir`, `internal_file_move`, `internal_file_copy` | `file/read.js`, `file/write.js`, `file/list.js`, `file/delete.js`, `file/mkdir.js`, `file/move.js`, `file/copy.js` |
| `code` | 代码操作 | `internal_code_search`, `internal_code_analyze`, `internal_code_format` | `code/search.js`, `code/analyze.js`, `code/format.js` |
| `system` | 系统操作 | `internal_system_execute`, `internal_system_info`, `internal_system_env` | `system/execute.js`, `system/info.js`, `system/env.js` |
| `network` | 网络操作 | `internal_network_request`, `internal_network_download` | `network/request.js`, `network/download.js` |
| `database` | 数据库操作 | `internal_database_query`, `internal_database_update` | `database/query.js`, `database/update.js` |

### 1.6 文件管理工具详解

#### `internal_file_list` - 列出目录内容

列出指定目录的内容，支持递归列出子目录。

**参数：**
- `path` (string, 可选): 目录路径，默认为项目根目录
- `recursive` (boolean, 可选): 是否递归列出子目录，默认为 false

**返回：**
- 返回目录中所有文件和子目录的列表，包含名称、路径、类型、大小和修改时间

**示例：**
```javascript
{
  "tool_calls": [{
    "function": {
      "name": "internal_file_list",
      "arguments": {
        "path": "src",
        "recursive": false
      }
    }
  }]
}
```

#### `internal_file_delete` - 删除文件或目录

删除指定的文件或目录，支持递归删除非空目录。

**参数：**
- `path` (string, 必需): 文件或目录路径
- `recursive` (boolean, 可选): 是否递归删除目录，默认为 false

**返回：**
- 删除成功的信息

**示例：**
```javascript
{
  "tool_calls": [{
    "function": {
      "name": "internal_file_delete",
      "arguments": {
        "path": "temp/file.txt"
      }
    }
  }]
}
```

#### `internal_file_mkdir` - 创建目录

创建新的目录，支持递归创建父目录。

**参数：**
- `path` (string, 必需): 目录路径
- `recursive` (boolean, 可选): 是否递归创建父目录，默认为 true

**返回：**
- 创建成功的信息

**示例：**
```javascript
{
  "tool_calls": [{
    "function": {
      "name": "internal_file_mkdir",
      "arguments": {
        "path": "src/components"
      }
    }
  }]
}
```

#### `internal_file_move` - 移动文件或目录

移动文件或目录到新位置。

**参数：**
- `source` (string, 必需): 源路径
- `destination` (string, 必需): 目标路径

**返回：**
- 移动成功的信息

**示例：**
```javascript
{
  "tool_calls": [{
    "function": {
      "name": "internal_file_move",
      "arguments": {
        "source": "old/file.txt",
        "destination": "new/file.txt"
      }
    }
  }]
}
```

#### `internal_file_copy` - 复制文件或目录

复制文件或目录到新位置，支持递归复制目录。

**参数：**
- `source` (string, 必需): 源路径
- `destination` (string, 必需): 目标路径

**返回：**
- 复制成功的信息

**示例：**
```javascript
{
  "tool_calls": [{
    "function": {
      "name": "internal_file_copy",
      "arguments": {
        "source": "src/file.txt",
        "destination": "backup/file.txt"
      }
    }
  }]
}
```

## 2. 工具结构规范

### 2.1 工具对象结构

每个内置工具必须包含以下字段：

```javascript
const tool = {
  name: 'internal_tool_name',           // 必需：工具名称
  description: '工具功能描述',           // 必需：工具描述
  inputSchema: {                        // 必需：输入参数的 JSON Schema
    type: 'object',
    properties: {
      // 参数定义
    },
    required: ['param1'],              // 必需参数列表
  },
  handler: async (args, ctx) => {      // 必需：工具处理函数
    // 实现逻辑
    return {
      content: [
        {
          type: 'text',
          text: '工具执行结果',
        },
      ],
    }
  },
  metadata: {                           // 可选：工具元数据
    type: 'internal',
    source: 'toolFileName.js',
  },
}
```

### 2.2 返回值格式

工具必须返回符合 MCP 格式的结果：

```javascript
{
  content: [
    {
      type: 'text',
      text: '工具执行结果',
    },
  ],
}
```

### 2.3 错误处理

在工具中抛出错误时，使用 `Error` 对象：

```javascript
if (error) {
  throw new Error(`操作失败: ${error.message}`)
}
```

## 3. 工具调用流程

### 3.1 调用链路

```
用户请求
    ↓
ChatService.handleStream()
    ↓
检测到 tool_calls
    ↓
ChatService.handleRunToolCall()
    ↓
ToolsService.runTools(toolName, toolArgs)
    ↓
判断工具类型
    ├─ internal_* → McpService.callInternalTool()
    └─ mcp_* → McpService.callTool(serverKey, originalName)
    ↓
执行工具
    ├─ 内部工具：直接执行 JavaScript 函数
    └─ 外部工具：通过 MCP 协议调用外部服务器
    ↓
返回结果
    ↓
ChatService 保存结果并继续对话
```

### 3.2 ToolsService.runTools() 逻辑

```javascript
async runTools(name, args) {
  // 1. 检查是否是内部工具
  if (name.startsWith('internal_')) {
    return await this.ctx.service.mcp.callInternalTool(name, args)
  }

  // 2. 检查是否是外部 MCP 工具
  if (name.startsWith('mcp_')) {
    const { serverKey, originalName } = this.parseMcpToolName(name)
    return await this.ctx.service.mcp.callTool(serverKey, originalName, args)
  }

  // 3. 未知工具类型
  throw new Error(`未知的工具: ${name}`)
}
```

## 4. 工具获取流程

### 4.1 ToolsService.getTools() 逻辑

```javascript
async getTools() {
  // 1. 确保 MCP 服务已初始化（包括内部工具）
  await this.ctx.service.mcp.ensureInitialized()

  // 2. 获取外部 MCP 服务器的工具
  const installedServers = await this.ctx.service.mcp.getInstalledServers()
  const runningServers = installedServers.filter(server => 
    server.status === 'running' && server.config?.enabled !== false
  )

  const allMcpTools = []
  for (const server of runningServers) {
    const serverTools = await this.ctx.service.mcp.getTool(server.key)
    allMcpTools.push(...serverTools.tools)
  }

  // 3. 添加内部工具
  const internalTools = this.ctx.service.mcp.getInternalTools()
  allMcpTools.push(...internalTools)

  // 4. 转换为 OpenAI 格式
  return this.convertMcpToolsToOpenaiTools(allMcpTools)
}
```

### 4.2 内部工具初始化流程

```javascript
// McpService.initInternalTools()
async initInternalTools() {
  // 1. 创建内部工具加载器
  const internalToolLoader = new InternalToolLoader(this.ctx)

  // 2. 加载所有内部工具
  const tools = internalToolLoader.loadAllTools()

  // 3. 保存到全局缓存
  for (const [name, tool] of tools.entries()) {
    GLOBAL_CACHE.internalTools.set(name, tool)
  }
}

// InternalToolLoader.loadAllTools()
loadAllTools() {
  // 1. 读取 internal-tools 目录中的所有 .js 文件
  const files = fs.readdirSync(this.toolsDir)
  const toolFiles = files.filter(file => 
    file.endsWith('.js') && 
    file !== 'index.js' &&
    !file.startsWith('.')
  )

  // 2. 加载每个工具文件
  for (const file of toolFiles) {
    const toolModule = require(filePath)
    this.tools.set(tool.name, tool)
  }

  return this.tools
}
```

## 5. 工具加载流程

### 5.1 加载器逻辑

```javascript
// InternalToolLoader.loadToolsFromDirectory(dirPath, group)
loadToolsFromDirectory(dirPath, group = null) {
  const files = fs.readdirSync(dirPath)
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      // 如果是目录，递归加载子目录
      // 目录名作为分组名（如 file、code、system）
      this.loadToolsFromDirectory(fullPath, file)
    } else if (file.endsWith('.js') && file !== 'index.js' && !file.startsWith('.')) {
      // 如果是 .js 文件，加载工具
      this.loadToolFile(fullPath, group)
    }
  }
}

// InternalToolLoader.loadToolFile(filePath, group)
loadToolFile(filePath, group = null) {
  const toolModule = require(filePath)
  
  // 组合完整的工具名称：internal_{group}_{name}
  const fullToolName = group ? `internal_${group}_${toolModule.name}` : `internal_${toolModule.name}`
  
  // 注册工具
  this.tools.set(fullToolName, tool)
  
  // 添加到分组
  if (group) {
    if (!this.groups.has(group)) {
      this.groups.set(group, [])
    }
    this.groups.get(group).push(fullToolName)
  }
}
```

### 5.2 加载示例

```
加载流程：
internal-tools/
├── file/                    # 文件夹名 = 分组名
│   ├── read.js            # 文件名 = 操作名
│   └── write.js
├── code/
│   └── search.js
└── system/
    └── execute.js

↓ 加载器处理

1. 遍历 internal-tools/ 目录
2. 发现 file/ 目录，递归进入，group = 'file'
3. 发现 file/read.js，加载工具，组合名称：internal_file_read
4. 发现 file/write.js，加载工具，组合名称：internal_file_write
5. 发现 code/ 目录，递归进入，group = 'code'
6. 发现 code/search.js，加载工具，组合名称：internal_code_search
7. 发现 system/ 目录，递归进入，group = 'system'
8. 发现 system/execute.js，加载工具，组合名称：internal_system_execute

↓ 最终结果

工具列表：
- internal_file_read
- internal_file_write
- internal_code_search
- internal_system_execute

分组信息：
{
  file: ['internal_file_read', 'internal_file_write'],
  code: ['internal_code_search'],
  system: ['internal_system_execute']
}
```

## 6. 添加新工具

### 6.1 创建工具文件

在 `internal-tools` 目录下创建新的 `.js` 文件：

```javascript
const fs = require('fs')

/**
 * 工具描述
 */
const myTool = {
  name: 'internal_my_tool',
  description: '工具描述',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '参数1描述',
      },
    },
    required: ['param1'],
  },
  handler: async (args, ctx) => {
    const { param1 } = args
    
    // 实现你的逻辑
    const result = await someAsyncOperation(param1)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  },
}

module.exports = myTool
```

### 6.2 使用上下文

通过 `ctx` 参数可以访问 Egg.js 的服务和工具：

```javascript
handler: async (args, ctx) => {
  // 访问其他服务
  const searchService = ctx.service.search
  const results = await searchService.search(query)
  
  // 记录日志
  ctx.logger.info('工具执行中...')
  
  // 访问数据库模型
  const users = await ctx.model.User.findAll()
  
  return { content: [...] }
}
```

## 7. 调试

查看日志以了解工具加载和执行情况：

```
[InternalToolLoader] 发现 4 个工具文件
[InternalToolLoader] 已加载工具: internal_read_file
[InternalToolLoader] 已加载工具: internal_write_file
[InternalToolLoader] 已加载工具: internal_search_code
[InternalToolLoader] 已加载工具: internal_execute_command
[InternalToolLoader] 成功加载 4 个内部工具
```

## 8. 注意事项

1. **性能优化**: 内部工具直接执行，性能优于 MCP 工具
2. **错误处理**: 始终使用 try-catch 包裹可能出错的代码
3. **日志记录**: 使用 `ctx.logger` 记录重要信息
4. **参数验证**: 在执行前验证必需参数
5. **安全性**: 注意文件路径和命令执行的安全性
6. **命名规范**: 严格遵循 `internal_` 前缀的命名规则
