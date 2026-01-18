const { Service } = require('egg')
const fs = require('fs')
const path = require('path')
const os = require('os')

const TEAM_CONFIG_FILE = path.join(os.homedir(), '.kui-xiang', 'team.config.json')

let customTeamPath = null

const getTeamRootPrompt=(rootPrompt,positions)=>`
<team>
<workflow>
${rootPrompt}
</workflow>
<positions>
请在对话结束时@其他合适的团队职位，使用以下格式：
<tool>
  工具名称: [internal_team_position]
  参数: [参数JSON格式]: {"position_name": "职位名称",'question':"待处理事项，可以是任务描述、问题、请求等"}
</tool>
**注意：**
- 团队职务请严格参照一下列表，严禁使用不属于一下列表提供的角色。
- 依照团队职务的职责分工分界，专人专事，每个角色仅允许负责输入自己工作。
- 不属于自己的工作，请根据分工@对应的团队成员

以下是团队职位列表：
${positions}
</positions>
</team>
`

const userPrompt = {
  name: 'user',
  desc: '用户',
  team_division: '最高决策者，拥有需求最终决定权和解释权;或者设计重大安全事项,比如删除文件等,需要用户确认',
  body: '请汇总一下所有需要我确认的信息然后结束当前对话'
}

class TeamService extends Service {
  constructor(ctx) {
    super(ctx)
    this.supportedExtensions = ['.md', '.mdc', '.xml']
  }

  /**
   * 获取用户目录下的 team 文件夹路径
   * @returns {string} team 文件夹路径
   */
  getUserTeamPath() {
    return path.join(os.homedir(), '.kui-xiang', 'team')
  }

  /**
   * 获取项目根目录下的 team 文件夹路径
   * @returns {string|null} team 文件夹路径，如果项目未设置则返回 null
   */
  getProjectTeamPath() {
    const projectPath = this.ctx.service.project.getProjectPath()
    if (!projectPath) {
      return null
    }
    return path.join(projectPath, 'team')
  }

  /**
   * 解析 .md/.mdc 文件的 frontmatter
   * @param {string} content - 文件内容
   * @returns {Object|null} 解析结果 { name, desc, team_division, body }
   */
  parseFrontMatter(content) {
    // Normalize line endings to handle both Windows and Unix formats
    const normalizedContent = content.replace(/\r\n/g, '\n')
    const lines = normalizedContent.split('\n')
    if (lines.length < 3 || lines[0].trim() !== '---') {
      return null
    }

    const frontMatterEnd = lines.indexOf('---', 1)
    if (frontMatterEnd === -1) {
      return null
    }

    const frontMatterLines = lines.slice(1, frontMatterEnd)
    const bodyLines = lines.slice(frontMatterEnd + 1)
    const body = bodyLines.join('\n').trim()

    const result = {
      name: '',
      desc: '',
      team_division: '',
      body
    }

    for (const line of frontMatterLines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      if (key === 'desc') {
        result.desc = value
      } else if (key === 'name') {
        result.name = value
      } else if (key === 'team-division' || key === 'teamDivision') {
        result.team_division = value
      }
    }

    return result
  }

  /**
   * 解析 .xml 文件
   * @param {string} content - 文件内容
   * @returns {Object|null} 解析结果 { name, desc, team_division, body }
   */
  parseXml(content) {
    // Normalize line endings to handle both Windows and Unix formats
    const normalizedContent = content.replace(/\r\n/g, '\n')
    const outerTagMatch = normalizedContent.match(/<([^>]+)>([\s\S]*)<\/\1>/i)
    if (!outerTagMatch) {
      return null
    }

    const tagName = outerTagMatch[1]
    const innerContent = outerTagMatch[2]

    const metaMatch = innerContent.match(/<meta>([\s\S]*?)<\/meta>/i)
    if (!metaMatch) {
      return null
    }

    const metaContent = metaMatch[1]

    const nameMatch = metaContent.match(/<name>([\s\S]*?)<\/name>/i)
    const descMatch = metaContent.match(/<desc>([\s\S]*?)<\/desc>/i)
    const teamDivisionMatch = metaContent.match(/<team-division>([\s\S]*?)<\/team-division>/i)

    const bodyMatch = innerContent.match(/<meta>[\s\S]*?<\/meta>([\s\S]*)/i)
    const body = bodyMatch ? bodyMatch[1].trim() : ''

    const result = {
      name: nameMatch ? nameMatch[1].trim() : tagName,
      desc: descMatch ? descMatch[1].trim() : '',
      team_division: teamDivisionMatch ? teamDivisionMatch[1].trim() : '',
      body
    }

    return result
  }

  /**
   * 解析团队职位文件
   * @param {string} filePath - 文件路径
   * @returns {Object|null} 解析结果
   */
  parseTeamRoleFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const ext = path.extname(filePath).toLowerCase()

      let result = null

      if (ext === '.xml') {
        result = this.parseXml(content)
        console.log(`[TeamService] 解析XML文件 ${path.basename(filePath)}:`, result ? '成功' : '失败')
      } else if (ext === '.md' || ext === '.mdc') {
        result = this.parseFrontMatter(content)
        console.log(`[TeamService] 解析Markdown文件 ${path.basename(filePath)}:`, result ? '成功' : '失败')
      }

      if (result) {
        result.filePath = filePath
        result.fileName = path.basename(filePath)
        this.ctx.logger.info(`[TeamService] 成功解析团队职位文件: ${path.basename(filePath)}`)
      } else {
        console.log(`[TeamService] 解析文件失败 ${path.basename(filePath)}，扩展名: ${ext}`)
      }

      return result
    } catch (error) {
      this.ctx.logger.error(`[TeamService] 解析文件失败 ${filePath}:`, error)
      console.log(`[TeamService] 读取文件异常 ${path.basename(filePath)}:`, error.message)
      return null
    }
  }

  /**
   * 读取 team 文件夹中的所有职位文件
   * @param {string} teamPath - team 文件夹路径
   * @returns {Array} 职位列表
   */
  readTeamRoleFiles(teamPath) {
    const roles = []
    const roleMap = new Map() // 用于去重，key为职位名称

    try {
      if (!fs.existsSync(teamPath)) {
        this.ctx.logger.info(`[TeamService] team 文件夹不存在: ${teamPath}`)
        return roles
      }

      const entries = fs.readdirSync(teamPath, { withFileTypes: true })
      console.log('[TeamService] team 文件夹中的所有文件:', entries.map(e => e.name))

      // 首先收集所有文件，按优先级排序：xml > mdc > md
      const files = []
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          console.log('[TeamService] 检查文件:', entry.name, '扩展名:', ext, '是否支持:', this.supportedExtensions.includes(ext))
          if (this.supportedExtensions.includes(ext)) {
            const filePath = path.join(teamPath, entry.name)
            // 分配优先级：xml=3, mdc=2, md=1
            const priority = ext === '.xml' ? 3 : ext === '.mdc' ? 2 : 1
            files.push({ filePath, ext, priority, name: entry.name })
          }
        }
      }

      // 按优先级降序排序，这样高优先级的文件会先处理
      files.sort((a, b) => b.priority - a.priority)

      // 处理文件，高优先级的会覆盖低优先级的
      for (const file of files) {
        try {
          const result = this.parseTeamRoleFile(file.filePath)
          if (result && result.name) {
            // 如果已经存在同名职位，且当前文件优先级更高，则替换
            const existing = roleMap.get(result.name)
            if (!existing || file.priority > existing.priority) {
              roleMap.set(result.name, { ...result, priority: file.priority, fileName: file.name })
              console.log(`[TeamService] 添加/更新职位: ${result.name} (来自 ${file.name}, 优先级: ${file.priority})`)
            } else {
              console.log(`[TeamService] 跳过职位: ${result.name} (已有更高优先级文件: ${existing.fileName})`)
            }
          }
        } catch (error) {
          this.ctx.logger.error(`[TeamService] 处理文件失败 ${file.filePath}:`, error)
          console.error(`[TeamService] 处理文件失败 ${file.name}:`, error.message)
        }
      }

      // 将Map转换为数组
      for (const [name, role] of roleMap) {
        roles.push(role)
      }
    } catch (error) {
      this.ctx.logger.error(`[TeamService] 读取 team 文件夹失败 ${teamPath}:`, error)
      console.error(`[TeamService] 读取 team 文件夹失败 ${teamPath}:`, error.message)
    }

    console.log('[TeamService] 最终加载到的职位数量:', roles.length)
    return roles
  }

  /**
   * 获取所有团队职位（包括用户目录和项目目录）
   * @returns {Array} 所有职位列表
   */
  getAllTeamRoles() {
    const allRoles = []

    try {
      // 读取用户目录下的团队文件
      const userTeamPath = this.getUserTeamPath()
      console.log('[TeamService] 用户 team 路径:', userTeamPath)
      const userRoles = this.readTeamRoleFiles(userTeamPath)
      console.log('[TeamService] 用户目录加载到', userRoles.length, '个职位')
      allRoles.push(...userRoles)

      // 读取项目目录下的团队文件
      const projectPath = this.ctx.service.project.getProjectPath()
      console.log('[TeamService] 项目 team 路径:', projectPath)
      if (projectPath) {
        const teamPath = path.join(projectPath, '.kui-xiang', 'team')
        const projectRoles = this.readTeamRoleFiles(teamPath)
        console.log('[TeamService] 项目目录加载到', projectRoles.length, '个职位')
        allRoles.push(...projectRoles)
      }

      this.ctx.logger.info(`[TeamService] 共加载 ${allRoles.length} 个团队职位`)
      console.log('[TeamService_getAllTeamRoles] 共加载', allRoles.length, '个团队职位')
    } catch (error) {
      this.ctx.logger.error(`[TeamService] 获取团队职位失败:`, error)
      console.error('[TeamService] 获取团队职位失败:', error)
    }
    return allRoles
  }

  /**
   * 获取根提示词（team.md 或 team.xml）
   * @returns {string|null} 根提示词内容
   */
  getRootPrompt() {
    const projectPath = this.ctx.service.project.getProjectPath()
    if (!projectPath) {
      return null
    }

    const teamPath = path.join(projectPath, '.kui-xiang', 'team')
    const supportedFiles = ['team.md', 'team.mdc', 'team.xml']

    for (const fileName of supportedFiles) {
      const filePath = path.join(teamPath, fileName)
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          this.ctx.logger.info(`[TeamService] 找到根提示词文件: ${fileName}`)
          return content
        } catch (error) {
          this.ctx.logger.error(`[TeamService] 读取根提示词文件失败 ${filePath}:`, error)
        }
      }
    }

    return null
  }

  /**
   * 根据名称获取对应的提示词（完整内容）
   * @param {string} name - 职位名称
   * @returns {string|null} 提示词内容
   */
  getTeamRoleByName(name) {
    if (!name) {
      this.ctx.logger.warn('[TeamService] getTeamRoleByName: name 参数为空')
      return null
    }
    if(name === 'user'){
      return userPrompt.body
    }
    const allRoles = this.getAllTeamRoles()
    const role = allRoles.find(r => r.name === name)
    console.log(`[TeamService] 查找职位: ${name}`, allRoles);
    
    if (!role) {
      this.ctx.logger.warn(`[TeamService] 未找到职位: ${name}`)
      return null
    }

    return role.body
  }

  /**
   * 获取主提示词（使用 XML 语法组合根提示词和具体的团队提示词的简介）
   * @returns {string} 组合后的提示词
   */
  getTeamPrompt() {
    const rootPrompt = this.getRootPrompt()
    const allRoles = this.getAllTeamRoles()

    const parts = []
    if (allRoles.length > 0) {
      for (const role of allRoles) {
        // 仅需要meta信息
        const roleInfo = `<${role.name}>
    <meta>
       <name>${role.name}</name>
       <desc>${role.desc}</desc>
       <team-division>
           ${role.team_division}
       </team-division>
    </meta>
</${role.name}>`
        parts.push(roleInfo)
      }
    }

    const result = getTeamRootPrompt(rootPrompt, parts.join('\n'))
    // this.ctx.logger.info(`[TeamService] 成功构建团队提示词，包含 ${allRoles.length} 个职位`)
    console.log('[TeamService] 成功构建团队提示词，包含', allRoles.length, '个职位');
    console.log('[TeamService] 团队提示词:', result);
    
    return result
  }
}

module.exports = TeamService
