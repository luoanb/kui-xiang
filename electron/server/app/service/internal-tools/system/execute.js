const { exec } = require('child_process')
const path = require('path')

/**
 * 执行命令工具
 */
const executeCommandTool = {
  name: 'execute',
  description: '执行系统命令，默认在用户选择的项目路径下执行',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
      },
      cwd: {
        type: 'string',
        description: '工作目录（可选，不提供则使用用户选择的项目路径）',
      },
    },
    required: ['command'],
  },
  handler: async (args, ctx) => {
    const { command, cwd } = args
    
    try {
      let workingDir = cwd
      
      if (!workingDir) {
        const projectPath = ctx.service.project.getProjectPath()
        if (projectPath) {
          workingDir = projectPath
          ctx.logger.info(`[execute] 使用项目路径作为工作目录: ${workingDir}`)
        } else {
          workingDir = process.cwd()
          ctx.logger.info(`[execute] 未设置项目路径，使用当前工作目录: ${workingDir}`)
        }
      }
      
      return new Promise((resolve, reject) => {
        exec(command, { cwd: workingDir }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`命令执行失败: ${error.message}`))
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `stdout:\n${stdout}\n\nstderr:\n${stderr}`,
                },
              ],
            })
          }
        })
      })
    } catch (error) {
      throw new Error(`执行命令失败: ${error.message}`)
    }
  },
}

module.exports = executeCommandTool
