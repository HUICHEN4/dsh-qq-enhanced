/**
 * ESM loader：让 `import('@deepseek-ai/dsh-persona')` 这类裸说明符能落到
 * `resources/app.asar` 里的 `dsh/node_modules/**` 上。
 *
 * 为什么需要它：DSH 0.2.2 起自带包（@deepseek-ai/*）不再解包到 profile 的
 * node_modules，全部留在安装目录的 app.asar 里（`grep -c dsh-persona app.asar`
 * = 121，而 `profiles/<p>/node_modules/@deepseek-ai/` 只剩 cosmokit、
 * schemastery）。`scripts/dsh-modules.mjs` 的 `dshModulesDir()` 用 js-yaml 反查
 * node_modules 根，能查到 profile 那份，但该目录里没有 dsh-persona ⇒
 * `verify-dsh-020-adaptation.mjs` 从 0.2.2 起必然 ERR_MODULE_NOT_FOUND。
 *
 * 用法（必须在做动态 import 之前注册，钩子跑在 loader 线程里）：
 *
 *   import { register } from 'node:module'
 *   register(new URL('./asar-module-loader.mjs', import.meta.url))
 *
 * 命中规则：
 *   · 裸说明符：先在 asar 的 `dsh/node_modules/` 里找（文件 → 包目录取
 *     package.json 的 main/exports → 补 .js/.mjs/.cjs → /index.*），找到就返回
 *     `app.asar/dsh/node_modules/...` 的 file:// URL；找不到原样交给下一个钩子，
 *     所以 profile 里的普通依赖（js-yaml 等）照旧走常规解析。
 *   · asar 内部的相对导入：按普通路径规则拼，命中 asar 就返回 asar URL。
 *   · load：从 asar 读源码，按扩展名/包 type 给 module 或 commonjs 格式。
 *
 * 不做的事：不支持 exports 条件导出（只取 default/import/require 与 main）、
 * 不支持 .node 原生模块（asar 里的这类条目本来就在 app.asar.unpacked 里，
 * 由 asar-reader 处理，此处直接报错而不是静默加载半截）。
 * @module scripts/asar-module-loader
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { findAppAsar, openAsar } from './asar-reader.mjs'

const ASAR_PATH = findAppAsar()
const ASAR_URL = ASAR_PATH ? pathToFileURL(ASAR_PATH).href : null
const INNER_MODULES = 'dsh/node_modules/'

let asarView = null
let fileSet = null
function asar() {
  if (!asarView) {
    asarView = openAsar(ASAR_PATH)
    fileSet = new Set(asarView.listFiles(() => true))
  }
  return asarView
}

function isFile(rel) {
  if (!ASAR_URL) return false
  return fileSet ? fileSet.has(rel) : asar().listFiles((p) => p === rel).length > 0
}

function asarUrl(rel) {
  return `${ASAR_URL}/${rel.split(path.sep).join('/')}`
}

function relOf(url) {
  if (!ASAR_URL || !url.startsWith(`${ASAR_URL}/`)) return null
  return decodeURIComponent(url.slice(ASAR_URL.length + 1)).split('/').join('/')
}

/** 在 asar 里按 Node 的常规顺序把 rel 解析成真实文件。 */
function resolveInAsar(rel) {
  const candidates = []
  const push = (p) => { if (p && !candidates.includes(p)) candidates.push(p) }
  push(rel)
  const ext = path.extname(rel)
  if (!ext) for (const e of ['.js', '.mjs', '.cjs', '.json']) push(rel + e)
  for (const p of candidates) if (isFile(p)) return p
  // 目录：读 package.json 的 main / exports['.']，再退到 index.*
  const pkgPath = `${rel}/package.json`
  if (isFile(pkgPath)) {
    let pkg = null
    try { pkg = JSON.parse(asar().readText(pkgPath)) } catch { pkg = null }
    const main = pickEntry(pkg)
    if (main) {
      const mainRel = path.posix.normalize(path.posix.join(rel, main))
      const hit = resolveInAsar(mainRel)
      if (hit) return hit
    }
  }
  for (const e of ['.js', '.mjs', '.cjs']) if (isFile(`${rel}/index${e}`)) return `${rel}/index${e}`
  return null
}

/** 从 package.json 里挑一个入口字段（exports 只取 "." 的 default/import/require）。 */
function pickEntry(pkg) {
  if (!pkg || typeof pkg !== 'object') return null
  const exp = pkg.exports
  const fromExports = (v) => {
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return v.map(fromExports).find(Boolean) ?? null
    if (v && typeof v === 'object') {
      for (const k of ['default', 'import', 'require', 'node']) {
        const hit = fromExports(v[k])
        if (hit) return hit
      }
    }
    return null
  }
  if (typeof exp === 'string') return exp
  if (exp && typeof exp === 'object' && exp['.'] !== undefined) {
    const hit = fromExports(exp['.'])
    if (hit) return hit
  }
  for (const k of ['module', 'main']) if (typeof pkg[k] === 'string') return pkg[k]
  return null
}

/** 包是否声明了 type:module（决定 load 的 format）。 */
function packageType(rel) {
  let dir = rel
  while (dir.includes('/')) {
    dir = dir.slice(0, dir.lastIndexOf('/'))
    const pkgPath = `${dir}/package.json`
    if (isFile(pkgPath)) {
      try { return JSON.parse(asar().readText(pkgPath)).type === 'module' } catch { return false }
    }
  }
  return false
}

export async function resolve(specifier, context, nextResolve) {
  if (ASAR_URL) {
    const parentRel = relOf(context.parentURL ?? '')
    // ① 裸说明符：先问 asar 的 dsh/node_modules
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('file:')) {
      const hit = resolveInAsar(INNER_MODULES + specifier)
      if (hit) return { url: asarUrl(hit), shortCircuit: true }
    } else if (parentRel) {
      // ② asar 内部相对/绝对导入
      const target = specifier.startsWith('file:')
        ? relOf(specifier)
        : path.posix.normalize(path.posix.join(path.posix.dirname(parentRel), specifier))
      if (target) {
        const hit = resolveInAsar(target)
        if (hit) return { url: asarUrl(hit), shortCircuit: true }
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  const rel = relOf(url)
  if (!rel) return nextLoad(url, context)
  if (rel.endsWith('.json')) {
    const source = asar().readText(rel)
    return { format: 'json', source, shortCircuit: true }
  }
  const ext = path.extname(rel)
  if (ext === '.node') {
    throw new Error(`asar-module-loader: 不支持从 asar 直接 import 原生模块 ${rel}（应走 app.asar.unpacked）`)
  }
  const source = asar().readText(rel)
  const format = ext === '.cjs' ? 'commonjs' : ext === '.mjs' ? 'module' : packageType(rel) ? 'module' : 'commonjs'
  return { format, source, shortCircuit: true }
}
