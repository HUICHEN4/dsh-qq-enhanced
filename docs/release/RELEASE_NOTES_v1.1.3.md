# qq-bridge-enhanced v1.1.3

在 v1.1.2 基础上的一次「说话更像人 + 发布卫生」更新，没有破坏性改动，老部署可以直接覆盖升级（`state/`、`config.json` 都保留）。

支持系统不变：**Windows、macOS、Linux**。逐条改动见 [CHANGELOG.md](../../CHANGELOG.md)。

## 1. 人格提示词瘦身

- 【反 AI 味】【保持主体性】【被吐槽时别炸毛】【话说得像人】【该说/不该说】合并成【像人】【立场】两块。
- 删掉互相打架的规则（「不是每个问题都要答」vs「被 @ 必须回」）和重复表达（「不是客服」写了三次、「可以不接」写了两次）。
- 同一段提示词从 1,647 字降到 865 字，人格文件从 29,340B 降到 27,147B。
- 效果：唤醒前缀更短，冷启动更便宜，模型不用在同一条指令的两个说法之间做选择。

## 2. 唤醒时带上「你最近说过」

- 每次唤醒在提示里附上最近 3 条自己发过的话（每条截 40 字）。
- 让 AI 自己看见上一轮的开头和句式，避免同一个「行，」「？」开头反复出现。
- 首次唤醒还没有发言记录时这一行不出现，不会占位。

## 3. 等待预算记账修复

- 修复：被权限拦截（403）的等待也消耗本轮等待额度，连续几次开关变化后，下一次等待直接返回 `budgetExhausted`。
- 现在只统计真正等下去的时长与次数；额度仍是每轮最多 2 次 / 90 秒，`purpose=reply` 的回复前短静默不受限。

## 4. 发布卫生

- `config.json` 不再入库，仓库只保留 `config.example.json`；`privacy-scan` 对已跟踪文件全绿。
- `panel-hidden.vbs`、`stop-hidden.vbs` 里写死的本机绝对路径改为按脚本自身位置推算，换盘符 / 换目录不再报错。
- `interface-platform/package.json`、`plugins/qq-mode-console/package.json` 版本号与主包对齐。
- `.gitignore` 采用上游版本（含 `state/`、`interface-platform/state/`、`config.json`、`/*.app/`）。

## 升级

```powershell
# 解压覆盖到原目录，保留不动：config.json、state/、roles/、audio/
pnpm install --frozen-lockfile
# 然后照常启动：control-center-hidden.vbs（Windows）或 start.sh
```

安装验证：在干净目录解压 v1.1.3 包 → `pnpm install --frozen-lockfile` 成功（postinstall 修补 `@snowluma/sdk` 13 个文件）→ `node scripts/test-audit.mjs` 全量自审通过。

## 校验

- `qq-bridge-enhanced-v1.1.3.zip`（323 个文件，来源 `git ls-files`）
- SHA-256 见同目录 `.sha256` 文件
