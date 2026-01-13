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
    const lines = content.split('\n')
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
      } else if (key === 'team-division') {
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
    const outerTagMatch = content.match(/<([^>]+)>([\s\S]*)<\/\1>/i)
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
      } else if (ext === '.md' || ext === '.mdc') {
        result = this.parseFrontMatter(content)
      }

      if (result) {
        result.filePath = filePath
        result.fileName = path.basename(filePath)
        this.ctx.logger.info(`[TeamService] 成功解析团队职位文件: ${path.basename(filePath)}`)
      }

      return result
    } catch (error) {
      this.ctx.logger.error(`[TeamService] 解析文件失败 ${filePath}:`, error)
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

    if (!fs.existsSync(teamPath)) {
      this.ctx.logger.info(`[TeamService] team 文件夹不存在: ${teamPath}`)
      return roles
    }

    try {
      const entries = fs.readdirSync(teamPath, { withFileTypes: true })
      console.log('[TeamService] team 文件夹中的所有文件:', entries.map(e => e.name))

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          console.log('[TeamService] 检查文件:', entry.name, '扩展名:', ext, '是否支持:', this.supportedExtensions.includes(ext))
          if (this.supportedExtensions.includes(ext)) {
            const filePath = path.join(teamPath, entry.name)
            const result = this.parseTeamRoleFile(filePath)
            if (result) {
              roles.push(result)
            }
          }
        }
      }
    } catch (error) {
      this.ctx.logger.error(`[TeamService] 读取 team 文件夹失败 ${teamPath}:`, error)
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

    const teamPath = path.join(projectPath, )
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
        const roleInfo = `<${role.name}>
    <meta>
       <name>${role.name}</name>
       <desc>${role.desc}</desc>
       <team-division>
           ${role.team_division}
       </team-division>
    </meta>
    ${role.body}
</${role.name}>`
        parts.push(roleInfo)
      }
    }

    const result = getTeamRootPrompt(rootPrompt, parts.join('\n'))
    // this.ctx.logger.info(`[TeamService] 成功构建团队提示词，包含 ${allRoles.length} 个职位`)
    console.log('[TeamService] 成功构建团队提示词，包含', allRoles.length, '个职位');
    
    return result
  }
}

module.exports = TeamService
