const { exec } = require('child_process')

/**
 * 执行命令工具
 */
const executeCommandTool = {
  name: 'execute',
  description: '执行系统命令',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
      },
      cwd: {
        type: 'string',
        description: '工作目录（可选）',
      },
    },
    required: ['command'],
  },
  handler: async (args, ctx) => {
    const { command, cwd } = args
    try {
      return new Promise((resolve, reject) => {
        exec(command, { cwd: cwd || process.cwd() }, (error, stdout, stderr) => {
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
