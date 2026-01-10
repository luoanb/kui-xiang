# MCP 内部工具使用示例

## 概述

MCP 服务现已支持内部工具（Function Calling）和外部 MCP 工具的混合架构。内部工具直接在项目内执行，性能更高；外部 MCP 工具通过 MCP 协议调用，支持跨进程通信。

## 架构设计

```
┌─────────────────────────────────┐
│     AI Model Layer              │
└──────────────┬──────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼─────────┐
│   Internal  │  │   External     │
│   Tools     │  │   Services     │
│(Function    │  │   (MCP)        │
│  Calling)   │  │                │
└─────────────┘  └────────────────┘
```

## 内置内部工具

系统已预置以下内部工具：

### 1. internal_read_file
读取文件内容

```javascript
const result = await ctx.service.mcp.callToolUnified('internal_read_file', {
  path: '/path/to/file.txt'
})
```

### 2. internal_write_file
写入文件内容

```javascript
const result = await ctx.service.mcp.callToolUnified('internal_write_file', {
  path: '/path/to/file.txt',
  content: 'Hello, World!'
})
```

### 3. internal_search_code
在项目中搜索代码

```javascript
const result = await ctx.service.mcp.callToolUnified('internal_search_code', {
  query: 'function_name',
  path: '/optional/search/path'
})
```

### 4. internal_execute_command
执行系统命令

```javascript
const result = await ctx.service.mcp.callToolUnified('internal_execute_command', {
  command: 'npm install',
  cwd: '/path/to/project'
})
```

## 工具管理

### 工具文件结构

内部工具现在通过文件系统管理，位于 `electron/server/app/service/internal-tools/` 目录：

```
internal-tools/
├── index.js           # 工具加载器
├── README.md          # 工具开发文档
├── readFile.js        # 文件读取工具
├── writeFile.js       # 文件写入工具
├── searchCode.js      # 代码搜索工具
└── executeCommand.js  # 命令执行工具
```

### 自动加载

工具会在 MCP 服务初始化时自动加载，无需手动注册。只需在 `internal-tools/` 目录下创建新的工具文件即可。

## 使用方法

### 方法 1: 使用统一调用接口（推荐）

```javascript
// 调用内部工具
const result1 = await ctx.service.mcp.callToolUnified('internal_read_file', {
  path: './config.json'
})

// 调用 MCP 工具
const result2 = await ctx.service.mcp.callToolUnified('mcp_filesystem_read_file', {
  path: './data.txt'
})
```

### 方法 2: 直接调用内部工具

```javascript
const result = await ctx.service.mcp.callInternalTool('internal_read_file', {
  path: './config.json'
})
```

### 方法 3: 调用 MCP 工具（传统方式）

```javascript
const result = await ctx.service.mcp.callTool('filesystem', 'read_file', {
  path: './data.txt'
})
```

## 获取所有工具列表

```javascript
const { tools, cacheVersion } = await ctx.service.mcp.listAllTools()

// 工具列表包含内部工具和 MCP 工具
tools.forEach(tool => {
  console.log(`工具名称: ${tool.name}`)
  console.log(`工具描述: ${tool.description}`)
  console.log(`工具类型: ${tool.metadata?.type}`)
})
```

## 自定义内部工具

### 创建新工具

在 `electron/server/app/service/internal-tools/` 目录下创建新的工具文件：

```javascript
// myTool.js
const myTool = {
  name: 'internal_my_custom_tool',
  description: '我的自定义工具',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '参数1'
      }
    },
    required: ['param1']
  },
  handler: async (args, ctx) => {
    const { param1 } = args
    
    // 实现你的逻辑
    const result = await someAsyncOperation(param1)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    }
  }
}

module.exports = myTool
```

### 工具格式规范

每个工具必须包含以下字段：

- `name` (string, 必需): 工具名称，必须以 `internal_` 开头
- `description` (string, 必需): 工具描述
- `inputSchema` (object, 必需): 输入参数的 JSON Schema
  - `type`: "object"
  - `properties`: 参数定义
  - `required`: 必需参数列表
- `handler` (function, 必需): 工具处理函数
  - 参数: `args` (object) - 工具调用参数
  - 参数: `ctx` (object) - Egg.js 上下文对象
  - 返回: Promise<Object> - 工具执行结果
- `metadata` (object, 可选): 工具元数据

### 返回值格式

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

### 使用上下文

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

## 工具命名规范

### 内部工具
- 前缀：`internal_`
- 示例：`internal_read_file`, `internal_write_file`

### MCP 工具
- 前缀：`mcp_{serverKey}_`
- 示例：`mcp_filesystem_read_file`, `mcp_puppeteer_navigate`

## 性能对比

| 操作 | 内部工具 | MCP 工具 |
|------|---------|---------|
| 文件读取 | ~1ms | ~10-50ms |
| 文件写入 | ~1ms | ~10-50ms |
| 代码搜索 | ~5-10ms | ~20-100ms |
| 命令执行 | ~10-50ms | ~50-200ms |

## 最佳实践

1. **优先使用内部工具**：对于高频、低延迟的操作，优先使用内部工具
2. **统一调用接口**：使用 `callToolUnified` 方法，简化调用逻辑
3. **错误处理**：始终使用 try-catch 处理工具调用错误
4. **工具缓存**：利用工具缓存机制，减少重复调用
5. **日志记录**：查看日志了解工具执行情况
6. **模块化开发**：每个工具独立文件，便于维护和测试

## 示例：完整的工作流

```javascript
class MyService extends Service {
  async processFile(filePath) {
    try {
      // 1. 读取文件（内部工具）
      const readResult = await this.ctx.service.mcp.callToolUnified(
        'internal_read_file',
        { path: filePath }
      )
      
      const content = readResult.content[0].text
      
      // 2. 处理内容
      const processed = this.processContent(content)
      
      // 3. 写入文件（内部工具）
      const writeResult = await this.ctx.service.mcp.callToolUnified(
        'internal_write_file',
        { 
          path: filePath.replace('.txt', '_processed.txt'),
          content: processed
        }
      )
      
      return {
        success: true,
        message: '文件处理完成'
      }
    } catch (error) {
      this.ctx.logger.error('文件处理失败:', error)
      throw error
    }
  }
  
  processContent(content) {
    // 实现你的处理逻辑
    return content.toUpperCase()
  }
}
```

## 故障排查

### 问题：内部工具未找到
**解决方案**：确保已调用 `ensureInitialized()` 方法初始化内部工具

### 问题：MCP 工具调用失败
**解决方案**：检查 MCP 服务器是否正常运行，查看日志了解详细错误

### 问题：工具执行超时
**解决方案**：增加超时时间或优化工具实现

### 问题：新工具未加载
**解决方案**：
1. 确认工具文件位于 `internal-tools/` 目录
2. 确认工具文件以 `.js` 结尾
3. 重启 MCP 服务以重新加载工具
4. 查看日志确认工具加载状态

## 扩展阅读

- [MCP 协议文档](https://modelcontextprotocol.io/)
- [Function Calling 最佳实践](https://platform.openai.com/docs/guides/function-calling)
- [内部工具开发文档](./internal-tools/README.md)
- [项目架构设计](./architecture.md)
