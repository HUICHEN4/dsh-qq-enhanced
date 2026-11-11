// DSH 工具名抽取：**唯一实现**，供
//   · `scripts/scan-dsh-tool-names.mjs`（人工/升级时对账，打印清单）
//   · `scripts/test-preset-local-tools.mjs`（登记期断言，防拼错假名）
// 共同使用。
//
// 为什么要抽成模块：这两处过去各有一份实现，而测试那份是**模糊**的
// （`\bname:\s*['"]x['"]` 全文件乱扫 + 只认少数包名前缀 + 只读包根目录的
// cordis.patch.yml）。结果 0.2.0 对账时把 10 个**真实存在**的工具名误判成
// 「假名」——`dsh-mcp-resources` 与 `dsh-experimental-tool-agent-team` 不匹配它
// 的包名白名单，`subagent_codex` 写在 `dsh-web-app/presets/*.patch.yml` 而不是
// 包根。误判方向是危险的：它会逼人把真名字从守卫名单里删掉。
//
// 抽取规则（都要求**就近锚定**，不把 `systemPrompt.section({ name: 'tool:read' })`
// 这类非工具名当工具）：
//   ① `.register(defineTool({ … name: "X" … }))` —— DSH 所有工具包的注册形状
//   ② `toolName: "X"` / `toolName: z.string().default("X")` —— 配置化工具名
//      （dsh-tool-subagent 的 subagent / subagent_fork 就是这样声明的）
//   ③ YAML patch 里的 `toolName: X` 行（任意层级 *.patch.yml，含 presets/ 子目录）
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dshModulesDir, dshHome } from './dsh-modules.mjs';
import { findAppAsar, openAsar } from './asar-reader.mjs';

/** 名字形态：小写字母开头，允许下划线与连字符，长度合理。 */
export const TOOL_NAME_RE = /^[a-z][a-z0-9_-]{1,40}$/;

/** DSH 自带包所在目录（`<node_modules>/@deepseek-ai`）。 */
export function dshPackagesDir() {
  return process.env.DSH_TOOL_PACKAGES || path.join(dshModulesDir(), '@deepseek-ai');
}

/** 用户安装的第三方插件目录（也会注册工具：plugin-guard / 超级注入器等）。 */
export function dshPluginDirs() {
  const home = process.env.DSH_HOME
    || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.dsh') : null);
  return [home ? path.join(home, 'plugins') : null].filter((p) => p && fs.existsSync(p));
}

/**
 * profile 里安装的 bundle/插件包（dsh-ops、dsh-soul-md、dsh-vision-router…）。
 * 它们注册的工具（ops_*、memory_*、soul_*、vision_*）既不在 DSH 自带包里，
 * 也不在 DSH_HOME/plugins 里，只在 profile 的 node_modules——所以按
 * package.json 的 `dsh.profile.bundles` 名单逐个解析，不盲扫整个 node_modules。
 */
export function dshBundleDirs() {
  const home = dshHome();
  let profiles = [];
  try {
    profiles = fs.readdirSync(path.join(home, 'profiles'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { /* 无 profiles 目录 */ }
  const order = [process.env.DSH_PROFILE, 'desktop', 'web', 'default', ...profiles].filter(Boolean);
  const seen = new Set();
  for (const profile of order) {
    if (seen.has(profile)) continue;
    seen.add(profile);
    const anchor = path.join(home, 'profiles', profile, 'package.json');
    if (!fs.existsSync(anchor)) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(anchor, 'utf8')); } catch { continue; }
    const bundles = pkg?.dsh?.profile?.bundles ?? [];
    if (!bundles.length) continue;
    const req = createRequire(anchor);
    const dirs = [];
    for (const name of bundles) {
      try {
        dirs.push({ name, dir: path.dirname(req.resolve(`${name}/package.json`)) });
      } catch { /* 未安装/不暴露 package.json 的包跳过 */ }
    }
    if (dirs.length) return dirs;
  }
  return [];
}

function walkFiles(dir, out = [], depth = 0, maxDepth = 5) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < maxDepth) walkFiles(full, out, depth + 1, maxDepth); }
    else out.push(full);
  }
  return out;
}

/** 从一个 JS/TS 源文件里抽取工具名。 */
function extractFromSource(text, source, add) {
  for (const m of text.matchAll(/\.register\(\s*defineTool\(\{[\s\S]{0,400}?\bname:\s*["']([^"']+)["']/g)) {
    add(m[1], source);
  }
  for (const m of text.matchAll(/\btoolName:\s*["']([^"']+)["']/g)) add(m[1], source);
  for (const m of text.matchAll(/\btoolName:\s*[^;\n]*?\.default\(\s*["']([^"']+)["']/g)) add(m[1], source);
  // 独立的一次性工具文件（defineTool 不挂在 .register( 上时的兜底）
  for (const m of text.matchAll(/defineTool\(\{[\s\S]{0,200}?\bname:\s*["']([^"']+)["']/g)) {
    add(m[1], source);
  }
  // 纯对象字面量工具定义（dsh-vision-router：`const xTool = { name: 'vision_x', description: … }`
  // 或 `deepToolDefs.push({ name: 'vision_y', description: … })`，最后统一 ctx.tools.register(def)）。
  // 必须带 `parameters` 才算工具：技能注册（`{ name: 'official-plugins', description: … }`）
  // 与 RALPH_META 这类元数据也会命中 name+description，但它们不是工具。
  const objDef = /(?:=\s*|\.push\(\s*)\{\s*\n\s*name:\s*["']([a-z][a-z0-9_-]{1,40})["']\s*,\s*\n\s*description:/g;
  for (const m of text.matchAll(objDef)) {
    const head = text.slice(m.index, m.index + m[0].length + 4000);
    if (/\bparameters\s*:/.test(head)) add(m[1], source);
  }
}

/**
 * 有些包把工具名在运行时拼出来（dsh-ops：`TOOL_PREFIX = 'ops_'` +
 * `publicToolName(rawName)`），源码里没有 `ops_bash` 这样的字面量。
 * 返回该包声明的前缀（`ops_`），没有则 null。
 */
export function discoverDynamicPrefix(text) {
  const m = /\bTOOL_PREFIX\s*=\s*["']([A-Za-z][A-Za-z0-9]*_)["']/.exec(text);
  return m ? m[1] : null;
}

const DYNAMIC_PATTERNS = [
  /\bpublicToolName\(\s*["']([a-z][a-z0-9_]*)["']/g,
  /\brawName:\s*["']([a-z][a-z0-9_]*)["']/g,
];
// `const fileOrder = ['grep', 'glob', …]` —— 能力目录里的裸名字数组。
const FILE_ORDER_RE = /\bfileOrder\s*=\s*\[([\s\S]{0,1500}?)\]/g;
const QUOTED_NAME_RE = /["']([a-z][a-z0-9_]*)["']/g;
// `export const PARAMETERS = { batch: …, result: … }` —— PTC 能力按参数对象键命名。
const PARAMETERS_RE = /\bconst PARAMETERS\s*=\s*\{([\s\S]*?)\n\};/g;
const TOP_KEY_RE = /^ {4}([a-z][a-z0-9_]{2,40}):/gm;

/** 按包声明的前缀补全动态拼出的工具名。 */
export function extractDynamicNames(text, source, add, prefix = discoverDynamicPrefix(text)) {
  if (!prefix) return;
  for (const re of DYNAMIC_PATTERNS) {
    for (const m of text.matchAll(re)) add(prefix + m[1], source);
  }
  for (const m of text.matchAll(FILE_ORDER_RE)) {
    for (const q of m[1].matchAll(QUOTED_NAME_RE)) add(prefix + q[1], source);
  }
  for (const m of text.matchAll(PARAMETERS_RE)) {
    for (const k of m[1].matchAll(TOP_KEY_RE)) add(prefix + k[1], source);
  }
}

/** 从 YAML patch 里抽取配置化的工具名。 */
function extractFromPatch(text, source, add) {
  for (const m of text.matchAll(/^\s*(?:-\s*)?toolName:\s*([^\s#]+)\s*$/gm)) {
    add(m[1].replace(/^['"]|['"]$/g, ''), source);
  }
}

/**
 * 抽取已安装 DSH（及其插件）里出现的全部工具名。
 *
 * @param options.packagesDir - `@deepseek-ai` 目录；缺省按 {@link dshPackagesDir} 解析。
 * @param options.pluginDirs - 第三方插件目录列表；缺省按 {@link dshPluginDirs} 解析。
 * @returns `{ names: Map<name, Set<source>>, packages: string[] }`。
 *          `packages` 是实际扫过的包/插件名，便于诊断「一个都没扫到」。
 */
export function collectDshToolNames({ packagesDir, pluginDirs } = {}) {
  const names = new Map();
  const packages = [];
  const add = (name, source) => {
    if (!TOOL_NAME_RE.test(name)) return;
    if (!names.has(name)) names.set(name, new Set());
    names.get(name).add(source);
  };

  const roots = [];
  const pkgRoot = packagesDir ?? dshPackagesDir();
  if (fs.existsSync(pkgRoot)) roots.push({ dir: pkgRoot, filter: /^dsh-/ });
  for (const dir of pluginDirs ?? dshPluginDirs()) {
    // 用户的插件目录里全是插件包（含 .bak-* 备份，也一起扫：备份里的旧名字
    // 仍然说明这个名字曾经真实存在）。
    roots.push({ dir, filter: null });
  }

  // 记录「磁盘上的 DSH 自带包」是否真的抽到了名字：DSH 0.2.2 起这些包被打进
  // resources/app.asar，磁盘目录可能只剩空壳/少数包 —— 此时要回退去读 asar，
  // 否则会把所有真实工具名误判成「假名」。
  let dshDiskNames = 0;

  for (const { dir, filter } of roots) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    const before = names.size;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (filter && !filter.test(e.name)) continue;
      const pkgDir = path.join(dir, e.name);
      packages.push(e.name);
      for (const f of walkFiles(pkgDir)) {
        let text = '';
        try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
        if (/\.(js|mjs|cjs)$/.test(f) || f.endsWith('.d.ts')) extractFromSource(text, e.name, add);
        else if (/\.patch\.ya?ml$/.test(f)) extractFromPatch(text, e.name, add);
      }
    }
    if (filter) dshDiskNames = names.size - before;
  }

  // profile 里安装的 bundle 插件（非 @deepseek-ai 自带包）。
  // 两遍：先收源码，再从任一文件里认包级 TOOL_PREFIX，最后按前缀补动态名字
  // （dsh-ops 的 ops_* 是 `publicToolName()` 运行时拼的，字面量扫不到）。
  for (const { name, dir } of dshBundleDirs()) {
    packages.push(name);
    const texts = [];
    for (const f of walkFiles(dir)) {
      const isJs = /\.(js|mjs|cjs)$/.test(f) || f.endsWith('.d.ts');
      const isPatch = /\.patch\.ya?ml$/.test(f);
      if (!isJs && !isPatch) continue;
      let text = '';
      try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
      texts.push(text);
      if (isJs) extractFromSource(text, name, add);
      else extractFromPatch(text, name, add);
    }
    const prefix = texts.map(discoverDynamicPrefix).find(Boolean);
    if (prefix) {
      for (const text of texts) extractDynamicNames(text, name, add, prefix);
    }
  }

  let origin = 'disk';
  if (dshDiskNames === 0) {
    const asarPath = dshAsarPath();
    if (asarPath) {
      const asarPackages = scanAsarPackages(asarPath, add);
      if (asarPackages.length) {
        packages.push(...asarPackages);
        origin = 'asar';
      }
    }
  }
  return { names, packages, origin };
}

/** DSH 自带包所在的 app.asar 路径（没有安装 asar 的部署返回 null）。 */
export function dshAsarPath() {
  if (process.env.DSH_TOOL_ASAR) return process.env.DSH_TOOL_ASAR;
  try { return findAppAsar(); } catch { return null; }
}

/**
 * 从 app.asar 里扫 `dsh/node_modules/@deepseek-ai/dsh-*` 包的工具名。
 * 只读 `lib/**`、`presets/**` 与 `*.patch.y(a)ml`：工具定义只在这些位置，
 * 不把整个 asar（几百 MB）逐文件转成字符串。
 */
function scanAsarPackages(asarPath, add) {
  const PREFIX = 'dsh/node_modules/@deepseek-ai/';
  let asar;
  try { asar = openAsar(asarPath); } catch { return []; }
  const files = asar.listFiles((p) => p.startsWith(PREFIX));
  const scanned = new Set();
  const packageTexts = new Map();
  for (const file of files) {
    const rest = file.slice(PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash < 0) continue;
    const pkg = rest.slice(0, slash);
    if (!pkg.startsWith('dsh-')) continue;
    const inner = rest.slice(slash + 1);
    const isJs = /\.(js|mjs|cjs)$/.test(file) || file.endsWith('.d.ts');
    const isPatch = /\.patch\.ya?ml$/.test(file);
    if (!isJs && !isPatch) continue;
    // 工具定义只在 lib/ 与 presets/ 下；跳过 client/、assets/ 等大目录。
    if (!/^(lib|presets)\//.test(inner)) continue;
    let text = '';
    try { text = asar.readText(file) ?? ''; } catch { continue; }
    if (!text) continue;
    if (isJs) extractFromSource(text, pkg, add);
    else extractFromPatch(text, pkg, add);
    // 留一份按包分组，供动态前缀（TOOL_PREFIX = 'x_'）二次抽取。
    if (!packageTexts.has(pkg)) packageTexts.set(pkg, []);
    packageTexts.get(pkg).push(text);
    scanned.add(pkg);
  }
  for (const [pkg, texts] of packageTexts) {
    const prefix = texts.map(discoverDynamicPrefix).find(Boolean);
    if (prefix) for (const text of texts) extractDynamicNames(text, pkg, add, prefix);
  }
  return [...scanned];
}

/** 便利包装：只要名字集合。 */
export function dshToolNameSet(options) {
  return new Set(collectDshToolNames(options).names.keys());
}

/**
 * 「危险语义」判定：与本地执行 / 文件 / 进程 / 派生 agent / 宿主运行期相关的名字。
 * 守卫**必须**覆盖它们。纯模型侧无害工具由 {@link SAFE_MODEL_TOOLS} 显式排除。
 *
 * 这是**发现用**的启发式（宁可多报，人工再判），不是安全边界本身；
 * 边界是守卫的 restrict 名单 + 执行期白名单。
 */
export const DANGER_TOOL_RE = /(pwsh|bash|shell|exec|spawn|process|terminal|pty|read|write|edit|file|fs_|glob|grep|patch|str_replace|subagent|agent_|teammate|workflow|ralph|job|skill|present|goal|plan|todo|memory|snapshot|rollback|incident|plugin|cordis|dsh_|dev_|import|install|reload|inject|stage|config|workspace|session|export|office|slash|command|schedule|voice|speech|team|mcp_resource)/;

/** 明确无害、允许出现在仿真会话 schema 里的模型侧工具。 */
export const SAFE_MODEL_TOOLS = new Set(['ask_user_question', 'todo_write', 'compress']);
