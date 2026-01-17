'use strict';

const Service = require('egg').Service;
const fs = require('fs');
const path = require('path');

const getPrompt = (systemPrompt, docsPrompt, toolsPrompt, teamPrompt) => {
  return `
<>
<docs>
${docsPrompt}
</docs>
<tools>
${toolsPrompt}
</tools>
<workflow>
**你需要严格按照一下规则执行**
${systemPrompt}
${teamPrompt}
</workflow>
</>
`
}

class PromptService extends Service {
  constructor(ctx) {
    super(ctx);
  }

  /**
   * 按优先级查找提示词文件夹
   * 优先级：.kui-xiang/rules > .cursor/rules > .trae/rules
   * @param {string} projectPath - 项目路径
   * @returns {string|null} 找到的提示词文件夹路径，未找到返回 null
   */
  findPromptFolder(projectPath) {
    const folders = [
      '.kui-xiang/rules',
      '.cursor/rules',
      '.trae/rules'
    ];

    for (const folder of folders) {
      const folderPath = path.join(projectPath, folder);
      if (fs.existsSync(folderPath)) {
        this.ctx.logger.info(`[PromptService] 找到提示词文件夹: ${folderPath}`);
        return folderPath;
      }
    }

    this.ctx.logger.info('[PromptService] 未找到提示词文件夹');
    return null;
  }

  /**
   * 读取提示词文件夹中的所有文件
   * @param {string} folderPath - 提示词文件夹路径
   * @returns {Array<{name: string, content: string}>} 文件列表
   */
  readPromptFiles(folderPath) {
    const files = [];
    const supportedExtensions = ['.md', '.mdc', '.xml'];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            const filePath = path.join(folderPath, entry.name);
            const content = fs.readFileSync(filePath, 'utf-8');
            const name = path.basename(entry.name, ext);
            files.push({ name, content });
            this.ctx.logger.info(`[PromptService] 读取提示词文件: ${entry.name}`);
          }
        }
      }
    } catch (error) {
      this.ctx.logger.error(`[PromptService] 读取提示词文件夹失败: ${error.message}`);
    }

    return files;
  }

  /**
   * 使用 XML 格式整合所有提示词
   * @param {Array<{name: string, content: string}>} promptFiles - 提示词文件列表
   * @returns {string} 整合后的提示词
   */
  mergePromptsToXml(promptFiles) {
    if (!promptFiles || promptFiles.length === 0) {
      return '';
    }

    const mergedContent = promptFiles.map(file => {
      return `<${file.name}>\n${file.content}\n</${file.name}>`;
    }).join('\n\n');

    return mergedContent;
  }

  /**
   * 从项目文件夹加载提示词
   * @param {string} projectPath - 项目路径
   * @returns {string} 整合后的提示词，未找到返回空字符串
   */
  loadProjectPrompts(projectPath) {
    if (!projectPath) {
      this.ctx.logger.info('[PromptService] 项目路径为空，跳过加载提示词');
      return '';
    }

    const promptFolder = this.findPromptFolder(projectPath);
    if (!promptFolder) {
      return '';
    }

    const promptFiles = this.readPromptFiles(promptFolder);
    if (promptFiles.length === 0) {
      this.ctx.logger.info('[PromptService] 提示词文件夹为空');
      return '';
    }

    const mergedPrompts = this.mergePromptsToXml(promptFiles);
    this.ctx.logger.info(`[PromptService] 成功加载 ${promptFiles.length} 个提示词文件`);

    return mergedPrompts;
  }

  /**
   * 构建系统提示词
   * @param {string} systemPrompt - 用户设置的系统提示词
   * @param {Array} docs - 知识库文档
   * @param {Array} tools - 工具列表
   * @param {Object} customPrompts - 自定义提示词
   * @return {string} - 构建后的系统提示词
   */
  buildSystemPrompt(systemPrompt, docs, tools, customPrompts) {
    // 获取语言设置
    const acceptLanguage = this.ctx.get('Accept-Language') || '';
    const isChinese = acceptLanguage.includes('zh-CN') || acceptLanguage.includes('zh');

    let finalPrompt = '';

    // 加载项目文件夹中的提示词
    const projectPath = this.ctx.service.project.getProjectPath();
    const projectPrompts = this.loadProjectPrompts(projectPath);
    if (projectPrompts) {
      finalPrompt = projectPrompts;
    }

    // 添加用户设置的系统提示词
    if (systemPrompt) {
      finalPrompt = finalPrompt ? `${finalPrompt}\n\n${systemPrompt}` : systemPrompt;
    }

    let docsPrompt = ''
    // 添加知识库文档提示词
    if (docs && docs.matches && docs.matches.length > 0) {
      const docsList = docs.matches
      const question = docs.query
      docsPrompt = this.buildDocsPrompt(docsList, question, isChinese);
      // finalPrompt = finalPrompt ? `${finalPrompt}\n\n${docsPrompt}` : docsPrompt;
    }

    // 添加工具提示词
    let toolsPrompt = ''
    if (tools && tools.length > 0) {
      toolsPrompt = this.buildToolsPrompt(tools, isChinese);
      // finalPrompt = finalPrompt ? `${finalPrompt}\n\n${toolsPrompt}` : toolsPrompt;
    }

    // // 添加自定义提示词
    // if (customPrompts) {
    //   const customPrompt = this.buildCustomPrompt(customPrompts, isChinese);
    //   finalPrompt = finalPrompt ? `${finalPrompt}\n\n${customPrompt}` : customPrompt;
    // }

    // 添加团队提示词
    const teamPrompt = this.ctx.service.team.getTeamPrompt();
    // if (teamPrompt) {
    //   finalPrompt = finalPrompt ? `${finalPrompt}\n\n${teamPrompt}` : teamPrompt;
    // }

    // this.ctx.logger.info(`[PromptService] 成功构建系统提示词`,finalPrompt);
    // console.log(`[PromptService] 成功构建系统提示词`,finalPrompt);
    // return finalPrompt;
    const p = getPrompt(finalPrompt,docsPrompt,toolsPrompt,teamPrompt)
    // this.ctx.logger.info(`[PromptService] 成功构建系统提示词`,p);
    console.log(`[PromptService] 系统提示词长度`,p.length);
    
    return p
  }

  /**
   * 构建知识库文档提示词
   * @param {Array} docs - 知识库文档
   * @param {boolean} isChinese - 是否为中文
   * @return {string} - 构建后的知识库文档提示词
   */
  buildDocsPrompt(docs, question, isChinese) {
    if (!docs || docs.length === 0) {
      return '';
    }

    // 构建上下文内容
    // const context = docs.map((doc, index) => {
    //   return `【${index + 1}】${doc.content || doc.text || ''}`;
    // }).join('\n\n');
    const context = JSON.stringify(docs);

    // 根据语言选择提示词模板
    if (isChinese) {
      return `
#背景#
你是一名经验专业的知识库助手，你的任务是根据以下资料，简洁、专业地回答用户问题。如果资料中没有包含足够信息，请直接回答"无法根据现有资料回答"。

#资料#
${context}

#目的#
根据资料，简洁、专业地回答用户问题。

#问题#
${question}

#输出#
:::docs{.docs-block}
[{"id": "文档id", "title":"文档title"}]
:::
你的回答内容

#示例#
:::docs{.docs-block}
[{"id": "1", "title":"资料文档.doc"}]
:::

根据根据知识库搜索结果的分析，以下是xxx:
##1. 回答内容标题
回答内容。:::{.docs-inline}[{"id": "1", "title":"引用资料资料文档.doc"}]:::

##2. 回答内容标题
回答内容。

#注意#
- 请不要在回答中包含资料中不存在的内容。
- 如果你引用了资料中的内容，请在你每句回答的后面使用指令，":::" 符号为英文半角，如
:::docs{.docs-block}
[{"id": "1", "title":"资料文档.doc"}]
:::
输出引用内容。

`;
    } else {
      return `You are a helpful assistant with access to the following context:

<context>
${context}
</context>

Answer the question below using only the information from the context. Be as concise and accurate as possible. If the context does not contain enough information, respond with "I don't know based on the provided information."

Question: ${question}`;
    }
  }

  /**
   * 构建工具提示词
   * @param {Array} tools - 工具列表
   * @param {boolean} isChinese - 是否为中文
   * @return {string} - 构建后的工具提示词
   */
  buildToolsPrompt(tools, isChinese) {
    if (!tools || tools.length === 0) {
      return '';
    }

    // 构建工具描述
    const toolsDescription = tools.map((tool, index) => {
      return `${index + 1}. ${tool.name}: ${tool.description || ''}`;
    }).join('\n');

    // 根据语言选择提示词模板
    if (isChinese) {
      return `你可以使用以下工具来辅助完成任务：

${toolsDescription}

当你需要使用工具时，请使用以下格式：
<tool>
  工具名称: [工具名称]
  参数: [参数JSON格式]
</tool>`;
    } else {
      return `You have access to the following tools to assist with your tasks:

${toolsDescription}

When you need to use a tool, please use the following format:
<tool>
  name: [tool name]
  parameters: [parameters in JSON format]
</tool>`;
    }
  }

  /**
   * 构建自定义提示词
   * @param {Object} customPrompts - 自定义提示词
   * @param {boolean} isChinese - 是否为中文
   * @return {string} - 构建后的自定义提示词
   */
  buildCustomPrompt(customPrompts, isChinese) {
    if (!customPrompts) {
      return '';
    }

    // 根据语言选择对应的自定义提示词
    const prompt = isChinese ? 
      (customPrompts.zh || customPrompts.en || '') : 
      (customPrompts.en || customPrompts.zh || '');

    return prompt;
  }
}

module.exports = PromptService;