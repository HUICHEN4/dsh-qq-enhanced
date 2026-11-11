// 只读的 Electron ASAR 读取器：从 app.asar 里按路径取文件文本。
//
// 为什么需要它：DSH 0.2.2 起自带插件包（`dsh/node_modules/@deepseek-ai/*`）
// 全部打包进安装目录下的 `resources/app.asar`，磁盘上不再有可遍历的包目录。
// `scripts/dsh-tool-names.mjs` 的工具名对账因此会「扫到 0 个包」——不是没装，
// 是找错地方了。本模块只做一件事：把 asar 当成只读 zip 目录来用。
//
// ASAR 布局（Electron pickle）：
//   [0..3]   uint32 = 4（下一段的 pickle 长度字段）
//   [4..7]   uint32 = headerSize
//   [8..11]  uint32 = headerJsonSize
//   [12..]   headerJson（UTF-8，含文件表：path → { offset, size, unpacked? }）
//   [8+headerSize ..]  各文件的原始字节，offset 相对此起点
// 文件表里 `unpacked: true` 的条目在 `app.asar.unpacked/` 下，本读取器按需两处都查。
import fs from 'node:fs';
import path from 'node:path';

/**
 * 找 app.asar：优先环境变量，其次从当前 node 可执行文件向上找 `<dir>/resources/app.asar`。
 * （DSH 自带的 node 位于 `<安装目录>/resources/runtime/.../node.exe`，所以向上几层就能命中。）
 */
export function findAppAsar() {
  const explicit = process.env.DSH_ASAR || process.env.DSH_APP_ASAR;
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`DSH_ASAR 指向的文件不存在：${explicit}`);
    return explicit;
  }
  const installDir = process.env.DSH_INSTALL_DIR;
  if (installDir) {
    const cand = path.join(installDir, 'resources', 'app.asar');
    if (fs.existsSync(cand)) return cand;
  }
  let dir = path.dirname(process.execPath);
  for (let i = 0; i < 8; i += 1) {
    const cand = path.join(dir, 'resources', 'app.asar');
    if (fs.existsSync(cand)) return cand;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/**
 * 打开一个 asar，返回只读视图。
 * @returns {{ path: string, listFiles: (predicate?: (p: string) => boolean) => string[],
 *             readBuffer: (rel: string) => Buffer | null, readText: (rel: string) => string | null }}
 */
export function openAsar(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  const head = Buffer.alloc(12);
  fs.readSync(fd, head, 0, 12, 0);
  const headerSize = head.readUInt32LE(4);
  const headerBuf = Buffer.alloc(headerSize);
  fs.readSync(fd, headerBuf, 0, headerSize, 8);
  const jsonSize = headerBuf.readUInt32LE(4);
  const tree = JSON.parse(headerBuf.subarray(8, 8 + jsonSize).toString('utf8'));
  const contentOffset = 8 + headerSize;

  const files = new Map();
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const full = prefix ? `${prefix}/${name}` : name;
      if (entry.files) walk(entry, full);
      else files.set(full, entry);
    }
  };
  walk(tree, '');
  const unpackedRoot = `${asarPath}.unpacked`;

  return {
    path: asarPath,
    listFiles(predicate = () => true) {
      return [...files.keys()].filter(predicate).sort();
    },
    readBuffer(rel) {
      const entry = files.get(rel);
      if (!entry) return null;
      if (entry.unpacked) {
        try { return fs.readFileSync(path.join(unpackedRoot, ...rel.split('/'))); } catch { return null; }
      }
      const buf = Buffer.alloc(entry.size);
      fs.readSync(fd, buf, 0, entry.size, contentOffset + Number(entry.offset));
      return buf;
    },
    readText(rel) {
      const buf = this.readBuffer(rel);
      return buf ? buf.toString('utf8') : null;
    },
  };
}
