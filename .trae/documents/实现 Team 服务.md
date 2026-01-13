## Team 服务实现计划

### 1. 创建服务文件
- 在 `electron/server/app/service/` 目录下创建 `team.js`
- 继承 Egg.js Service 基类

### 2. 实现文件加载和解析逻辑
- **路径定义**：
  - 用户目录：`os.homedir()/.kui-xiang/team/*`
  - 根目录：`projectPath/team/*`
- **支持格式**：`.md`, `.mdc`, `.xml`
- **解析逻辑**：
  - `.md/.mdc`：解析 frontmatter（`---` 分隔），提取 `positions`, `name`, `cooperation`
  - `.xml`：解析 `<head>` 标签内的 `<positions>`, `<name>`, `<cooperation>`，`<body>` 为提示词主体
  - `team.md/xml`：无简介，直接读取完整内容

### 3. 实现核心方法
- **`getTeamRoleByName(name)`**：根据 name 获取对应的完整提示词内容
- **`getTeamPrompt()`**：使用 XML 语法组合根提示词和所有团队角色的简介

### 4. 依赖处理
- 使用 Node.js 内置模块：`fs`, `path`, `os`
- 手动实现 frontmatter 和 XML 解析（不引入额外依赖）