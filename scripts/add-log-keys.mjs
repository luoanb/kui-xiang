#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 简单 codemod: 在没有前置关键词的 console.log 前添加 [FILE]
// 用法: node scripts/add-log-keys.mjs [--dry]

const DRY = process.argv.includes('--dry')
const root = process.cwd()
const pathsArgIndex = process.argv.findIndex(a => a === '--paths')
let paths = null
if (pathsArgIndex !== -1 && process.argv[pathsArgIndex + 1]) {
  paths = process.argv[pathsArgIndex + 1].split(',').map(p => path.resolve(process.cwd(), p))
}
const exts = ['.js', '.ts', '.mjs', '.vue']

function walk(dir) {
  const files = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue
      files.push(...walk(p))
      } else if (exts.includes(path.extname(p))) {
        if (!paths) {
          files.push(p)
        } else {
          for (const rp of paths) {
            if (p.startsWith(rp)) {
              files.push(p)
              break
            }
          }
        }
    }
  }
  return files
}

function hasKeyword(argText) {
  // 判断 console.log 第一个参数是否为字符串字面量并以 [ 开头
  const trimmed = argText.trim()
  if (/^['\"]\[.+?\].*/.test(trimmed)) return true
  if (/^`\[.+?\].*/.test(trimmed)) return true
  return false
}

function transformCode(code, filePath) {
  // 简单正则找 console.log(...)，注意忽略注释内的
  // 这不是完整的 parser，但对大多数情况有效
  const lines = code.split('\n')
  let changed = false
  const out = lines.map((line, idx) => {
    if (!line.includes('console.log')) return line
    // 排除注释行
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return line
    // 匹配 console.log( ... )
    const m = line.match(/console\.log\s*\((.*)\)\s*;?\s*$/)
    if (!m) return line
    const args = m[1]
    if (hasKeyword(args)) return line
    // 生成 key 基于文件名
    const base = path.basename(filePath)
    const key = '[' + base.replace(/\W+/g, '_') + ']'
    // 新行
    const newLine = line.replace(/console\.log\s*\((.*)\)/, `console.log('${key}', $1)`)
    changed = true
    return newLine
  }).join('\n')
  return { changed, out }
}

const files = walk(root)
const results = []
for (const f of files) {
  try {
    const src = fs.readFileSync(f, 'utf8')
    const { changed, out } = transformCode(src, f)
    if (changed) {
      results.push(f)
      if (!DRY) {
        fs.writeFileSync(f, out, 'utf8')
        console.log('Updated:', f)
      } else {
        console.log('Would update:', f)
      }
    }
  } catch (e) {
    console.error('ERR', f, e.message)
  }
}

console.log('Done. files processed:', results.length)
