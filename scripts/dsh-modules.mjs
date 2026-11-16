// 定位「DSH 安装目录下的 node_modules」—— 供仓库脚本加载 DSH 自身的模块做校验。
//
// 解析顺序：
//   1. 环境变量 DSH_INSTALL_MODULES / DSH_MODULES（应指向 <DSH>/node_modules）
//   2. 从 $DSH_HOME/profiles/<profile>/package.json 用 Node 模块解析反查真实安装位置
//      （profile 依次尝试 DSH_PROFILE、web、default，再兜底扫 profiles 下的其它目录）
// 全部失败时抛出带指引的错误，不做任何写死路径的回退 —— 宁可显式报错，也不要静默用错版本。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}

// 这些脚本需要加载的包，任意一个能解析成功即可反推出 node_modules 位置。
const PROBE_SPECIFIERS = ['@deepseek-ai/dsh-persona', 'js-yaml'];

function findNodeModules(resolvedFile) {
  let dir = path.dirname(resolvedFile);
  for (;;) {
    if (path.basename(dir) === 'node_modules') return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function candidateProfiles(home) {
  const names = [];
  const add = (n) => { if (n && !names.includes(n)) names.push(n); };
  add(process.env.DSH_PROFILE);
  add('web');
  add('default');
  try {
    for (const e of fs.readdirSync(path.join(home, 'profiles'), { withFileTypes: true })) {
      if (e.isDirectory()) add(e.name);
    }
  } catch { /* profiles 目录不存在时忽略 */ }
  return names;
}

export function dshModulesDir() {
  const override = process.env.DSH_INSTALL_MODULES || process.env.DSH_MODULES;
  if (override) return override;

  const home = dshHome();
  for (const profile of candidateProfiles(home)) {
    const anchor = path.join(home, 'profiles', profile, 'package.json');
    if (!fs.existsSync(anchor)) continue;
    const req = createRequire(anchor);
    for (const spec of PROBE_SPECIFIERS) {
      try {
        const dir = findNodeModules(req.resolve(spec));
        if (dir) return dir;
      } catch { /* 换下一个 specifier，再换下一个 profile */ }
    }
  }

  throw new Error(
    '无法定位 DSH 安装目录下的 node_modules。\n'
    + '  请设置 DSH_INSTALL_MODULES=<DSH 安装目录>/node_modules 后重试；\n'
    + `  或设置 DSH_HOME 指向 DSH 根目录（当前解析为 ${home}）。`
  );
}

// 部署检查要看的**profile 目录**——本仓库的 bundle/patch 装在哪一个 profile 里。
//
// 沿革：verify 脚本曾把 profile 名写死成 `web`，而那只是 2026-11-06 留下的空骨架
// （4 个文件、2 个 bundle）。真正在用的 `desktop` 有 14 个 bundle、装了
// qq-mode-console 与 qq-agent-presets。写死名字的后果是 5 条部署断言全在查空气：
// 看着报了 ❌，其实查的根本不是跑着的那个 profile。
//
// 解析顺序：
//   1. DSH_PROFILE（显式指定，最高优先级）
//   2. 扫 $DSH_HOME/profiles/*，按「像不像本仓库的部署目标」打分选最高分
//   3. 同分时选 package.json mtime 最新的那个
export function dshProfileDir() {
  const home = dshHome();
  const explicit = process.env.DSH_PROFILE;
  if (explicit) {
    const dir = path.join(home, 'profiles', explicit);
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      throw new Error(`DSH_PROFILE=${explicit} 指向的 profile 不存在：${dir}`);
    }
    return dir;
  }

  const roots = [];
  try {
    for (const e of fs.readdirSync(path.join(home, 'profiles'), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const dir = path.join(home, 'profiles', e.name);
      if (fs.existsSync(path.join(dir, 'package.json'))) roots.push(dir);
    }
  } catch { /* profiles 目录不存在时落到下面的报错 */ }

  if (roots.length === 0) {
    throw new Error(
      '无法定位 DSH profile 目录。\n'
      + '  请设置 DSH_PROFILE=<profile 名> 后重试；\n'
      + `  或设置 DSH_HOME 指向 DSH 根目录（当前解析为 ${home}）。`
    );
  }

  const score = (dir) => {
    let s = 0;
    let mtime = 0;
    try {
      const pkgFile = path.join(dir, 'package.json');
      mtime = fs.statSync(pkgFile).mtimeMs;
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      const bundles = pkg?.dsh?.profile?.bundles ?? [];
      const deps = pkg?.dependencies ?? {};
      // 本仓库自己的 bundle 是最强信号：它只在自己被部署到的 profile 里。
      if (bundles.includes('qq-agent-presets') || deps['qq-agent-presets']) s += 100;
      if (bundles.includes('qq-mode-console') || deps['qq-mode-console']) s += 50;
      if (fs.existsSync(path.join(dir, 'node_modules', 'qq-agent-presets'))) s += 40;
      if (fs.existsSync(path.join(dir, 'node_modules'))) s += 10;
      s += bundles.length;
    } catch {
      return { s: -1, mtime };
    }
    return { s, mtime };
  };

  const ranked = roots
    .map((dir) => ({ dir, ...score(dir) }))
    .sort((a, b) => b.s - a.s || b.mtime - a.mtime);

  return ranked[0].dir;
}
