# 内部工具

本目录包含所有内部工具（Function Calling），这些工具直接在项目内执行，性能更高。

## 工具列表

- `readFile.js` - 读取文件内容
- `writeFile.js` - 写入文件内容
- `searchCode.js` - 在项目中搜索代码
- `executeCommand.js` - 执行系统命令

## 添加新工具

### 1. 创建工具文件

在 `internal-tools` 目录下创建一个新的 `.js` 文件，例如 `myTool.js`：

```javascript
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

### 2. 工具格式规范

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

### 3. 返回值格式

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

### 4. 错误处理

在工具中抛出错误时，使用 `Error` 对象：

```javascript
if (error) {
  throw new Error(`操作失败: ${error.message}`)
}
```

### 5. 使用上下文

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

## 工具示例

### 文件操作工具

```javascript
const fs = require('fs')

const fileTool = {
  name: 'internal_read_file',
  description: '读取文件内容',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['path'],
  },
  handler: async (args, ctx) => {
    const { path: filePath } = args
    const content = fs.readFileSync(filePath, 'utf-8')
    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    }
  },
}

module.exports = fileTool
```

### 数据库查询工具

```javascript
const dbTool = {
  name: 'internal_query_user',
  description: '查询用户信息',
  inputSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'number',
        description: '用户ID',
      },
    },
    required: ['userId'],
  },
  handler: async (args, ctx) => {
    const { userId } = args
    const user = await ctx.model.User.findByPk(userId)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(user, null, 2),
        },
      ],
    }
  },
}

module.exports = dbTool
```

## 工具命名规范

- 内部工具必须以 `internal_` 开头
- 使用小写字母和下划线
- 名称应清晰描述工具功能
- 示例：
  - `internal_read_file` ✅
  - `internal_write_file` ✅
  - `internal_search_code` ✅
  - `my_tool` ❌ (缺少前缀)
  - `InternalReadFile` ❌ (使用大写)

## 工具加载

工具会在 MCP 服务初始化时自动加载，无需手动注册。如果需要重新加载工具，可以重启 MCP 服务。

## 调试

查看日志以了解工具加载和执行情况：

```
[InternalToolLoader] 发现 4 个工具文件
[InternalToolLoader] 已加载工具: internal_read_file
[InternalToolLoader] 已加载工具: internal_write_file
[InternalToolLoader] 已加载工具: internal_search_code
[InternalToolLoader] 已加载工具: internal_execute_command
[InternalToolLoader] 成功加载 4 个内部工具
```

## 注意事项

1. **性能优化**: 内部工具直接执行，性能优于 MCP 工具
2. **错误处理**: 始终使用 try-catch 包裹可能出错的代码
3. **日志记录**: 使用 `ctx.logger` 记录重要信息
4. **参数验证**: 在执行前验证必需参数
5. **安全性**: 注意文件路径和命令执行的安全性
