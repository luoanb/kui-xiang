// MCP调用状态常量
const MCP_STATE = {
  BUILDING_PARAMS: 'BUILDING_PARAMS', // 参数构建中
  PARAMS_COMPLETE_NOT_EXECUTED: 'PARAMS_COMPLETE_NOT_EXECUTED', // 参数完成但未执行
  EXECUTING: 'EXECUTING', // 工具执行中
  RESULT_RECEIVED_NOT_SAVED: 'RESULT_RECEIVED_NOT_SAVED', // 结果已返回但未保存
  RESULT_SAVED_NOT_PROCESSED: 'RESULT_SAVED_NOT_PROCESSED', // 结果已保存但AI未处理
  PROCESSING_RESULT: 'PROCESSING_RESULT', // AI处理结果中
}

module.exports.MCP_STATE = MCP_STATE

class ToolCallMerger {
  constructor() {
    this.toolCallMap = new Map() // key: index, value: { id, name, arguments }
  }

  handleChunk(chunk) {
    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta
    const finishReason = chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason

    // 如果是 tool_calls 流段
    if (delta && delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index

        if (!this.toolCallMap.has(index)) {
          this.toolCallMap.set(index, {
            id: toolCall.id,
            name: (toolCall.function && toolCall.function.name) || '',
            arguments: '',
          })
        }

        const current = this.toolCallMap.get(index)

        // 更新 name（有些模型 name 也是流式分段）
        if (toolCall.function && toolCall.function.name) {
          current.name = toolCall.function.name
        }

        // 拼接参数
        if (toolCall.function && toolCall.function.arguments) {
          current.arguments += toolCall.function.arguments
        }
      }
    }

    // 判断是否是 tool_call 结束
    if (finishReason === 'tool_calls' || finishReason === 'tool_use') {
      return this.getMergedToolCalls()
    }

    return null
  }

  /**
   * 检查是否有未完成的tool_call
   * @returns {boolean}
   */
  hasIncompleteToolCalls() {
    return this.toolCallMap.size > 0
  }

  /**
   * 获取未完成的tool_call信息
   * @returns {Array} 未完成的tool_call列表
   */
  getIncompleteToolCalls() {
    const incomplete = []
    for (const [, call] of this.toolCallMap.entries()) {
      // 检查参数是否可能是完整的JSON
      let isComplete = false
      try {
        JSON.parse(call.arguments || '{}')
        isComplete = true
      } catch (e) {
        // JSON不完整
        isComplete = false
      }

      incomplete.push({
        id: call.id,
        name: call.name,
        arguments: call.arguments,
        isComplete,
      })
    }
    return incomplete
  }

  /**
   * 尝试修复不完整的JSON
   * @param {string} jsonStr - 不完整的JSON字符串
   * @returns {string|null} 修复后的JSON字符串，如果无法修复返回null
   */
  tryFixIncompleteJSON(jsonStr) {
    if (!jsonStr || !jsonStr.trim()) return null

    let fixed = jsonStr.trim()

    // 统计括号和引号
    let openBraces = (fixed.match(/\{/g) || []).length
    let closeBraces = (fixed.match(/\}/g) || []).length
    let openBrackets = (fixed.match(/\[/g) || []).length
    let closeBrackets = (fixed.match(/\]/g) || []).length
    let openQuotes = (fixed.match(/"/g) || []).length

    // 如果最后一个字符是逗号，移除它
    if (fixed.endsWith(',')) {
      fixed = fixed.slice(0, -1)
    }

    // 如果最后一个字符是未闭合的字符串，尝试闭合
    if (openQuotes % 2 !== 0) {
      // 检查最后一个引号是否闭合
      const lastQuoteIndex = fixed.lastIndexOf('"')
      if (lastQuoteIndex >= 0) {
        const afterLastQuote = fixed.substring(lastQuoteIndex + 1)
        // 如果最后一个引号后面没有闭合引号，添加一个
        if (!afterLastQuote.includes('"')) {
          fixed += '"'
        }
      }
    }

    // 添加缺失的闭合括号
    while (closeBraces < openBraces) {
      fixed += '}'
      closeBraces++
    }
    while (closeBrackets < openBrackets) {
      fixed += ']'
      closeBrackets++
    }

    // 验证修复后的JSON是否有效
    try {
      JSON.parse(fixed)
      return fixed
    } catch (e) {
      // 如果仍然无法解析，返回null
      return null
    }
  }

  /**
   * 尝试修复并获取tool_calls（即使finish_reason不是tool_calls）
   * @returns {Array|null} 修复后的tool_calls数组，如果无法修复返回null
   */
  tryGetMergedToolCalls() {
    if (this.toolCallMap.size === 0) {
      return null
    }

    const merged = []
    let allComplete = true

    for (const [, call] of this.toolCallMap.entries()) {
      let parsedArgs = {}
      let isValid = false

      try {
        parsedArgs = JSON.parse(call.arguments || '{}')
        isValid = true
      } catch (e) {
        // 尝试修复不完整的JSON
        const fixed = this.tryFixIncompleteJSON(call.arguments)
        if (fixed) {
          try {
            parsedArgs = JSON.parse(fixed)
            isValid = true
            console.log('[ToolCallMerger] 成功修复JSON参数')
          } catch (e2) {
            console.error('[ToolCallMerger] 无法修复JSON:', call.arguments)
            allComplete = false
          }
        } else {
          allComplete = false
        }
      }

      if (isValid && call.name) {
        merged.push({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: parsedArgs,
          },
        })
      } else {
        allComplete = false
      }
    }

    // 只有当所有tool_call都完整时才返回
    return allComplete && merged.length > 0 ? merged : null
  }

  getMergedToolCalls() {
    const merged = []
    for (const [, call] of this.toolCallMap.entries()) {
      let parsedArgs = {}
      try {
        parsedArgs = JSON.parse(call.arguments || '{}')
      } catch (e) {
        console.error('❌ 解析 tool_call.arguments 失败：', call.arguments)
      }

      merged.push({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: parsedArgs,
        },
      })
    }

    return merged
  }

  reset() {
    this.toolCallMap.clear()
  }
}

module.exports = ToolCallMerger
