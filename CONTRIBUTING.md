# 参与贡献

## 提问题

1. 先翻 [`docs/guides/TROUBLESHOOTING.md`](docs/guides/TROUBLESHOOTING.md)。
2. 再搜 [Issues](https://github.com/h-D-ACE/dsh-qq/issues)——有人问过就直接跟帖。
3. 还没有就按模板开 Issue：Bug 报告 / 功能建议。贴日志前把 QQ 号、群号、本机路径打码。

不会用、想交流配置、想晒自己的机器人，去 [Discussions](https://github.com/h-D-ACE/dsh-qq/discussions)，别开 Issue。

## 提 PR

- 只改代码/文档，**不要提交** `config.json`、`state/`、`*.log`、`*.bak-*`（`.gitignore` 已挡，别强推）。
- 提交前跑：`node scripts/test-audit.mjs`，要求 73/73。
- 改了 `dsh/agent-presets/**` 下的提示词，要同时跑 `node scripts/build-agent-preset-patches.mjs` 重新生成补丁。
- 改了 `package.json` 版本号时，记得同步 `plugins/qq-mode-console/package.json` 与 `interface-platform/package.json`（`test-platform` 会查）。
- 一个 PR 只做一件事，描述里写清「为什么」，附上验证方式（跑过什么、看到什么）。

## 安全问题

权限边界见 [`RULES.md`](RULES.md)。发现可能是漏洞的问题，不要开公开 Issue，先私信仓库所有者。
