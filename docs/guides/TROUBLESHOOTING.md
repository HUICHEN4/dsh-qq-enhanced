# 常见问题排查

按症状查。每条都是「看到什么 → 查哪里 → 改什么」。

## 1. QQ 连不上

**日志**：`WebSocket closed before opening` / `token 自愈失败：连不上 OneBot HTTP API（http://127.0.0.1:3000）`

- QQ 后端（NapCat / SnowLuma）没起，或 3000 / 3001 端口被占。
- 控制中心点「QQ 后端」启动，等日志出现 `QQ 后端（NapCat 4.x）已连接` 再去群里发消息。
- Windows 上用 `netstat -ano | findstr :3001` 确认监听；端口冲突改 `config.json` 的 `oneBot` 配置。

## 2. 进了群但不说话

- 查唤醒闸门：`config.json` → `socialV2.wake.recommendedProbability`（默认 `0.02`）。
- 连续几次被唤醒却没动作后，桥接会把 `probability` 自动归零（`noActionCount` 机制），看控制台该会话的 `wakeConfig`。
- 会话处于 `diving` 且条件没命中就不会醒，属正常；想立刻验证可让群里 @ 一下。

## 3. 一句话要等很久 / 一轮很多步

活人模式是一步一动作：看未读、看图、分几条发、等对方补话，都会各占一步。

- 多气泡：`socialV2` 里 `burstEnabled` 控制是否分条发。
- 等待预算：每轮最多 2 次 / 90 秒（`socialV2.wait.maxPerTurn` / `maxMsPerTurn`），超了就收尾。
- 真要压回合数，关掉分条和看图，代价是人味。

## 4. 花钱比预期快

命中率通常已到 97% 以上，钱主要花在「步数 × 上下文」：每轮多走一步，就多读一遍上下文。

- 看账本：控制台「令牌统计」，原始数据在 `state/token-usage.jsonl`。
- 上下文到 120K 左右、或摘要块明显变多时，换会话（控制台 →「会话」→「清除上下文」）。
- 换会话会重新冷启动一次，一天别超过一两次。

## 5. 说话复读、不像人

- 唤醒提示里的【你最近说过】要等她发过言之后才会出现，刚换会话的头一两轮没有。
- 人格提示词在 `dsh/agent-presets/qq-chat-v2/agent.cordis.yml`，改完必须**重启 DSH**（preset 补丁在 DSH 启动时缓存）。
- 改完提示词要重新执行 `node scripts/build-agent-preset-patches.mjs` 生成补丁。

## 6. 改了 config.json 不生效

- 桥接侧改动要重启桥接（控制中心「重启桥接」）。
- 改预设/提示词要重启 DSH，不只是重启桥接。

## 7. 控制台打不开

- 控制中心监听 `3099`、桥接 `3100`；令牌在 `state/control-center-token` 与 `state/console-token`。
- 端口被旧进程占住时，先结束残留 `node` 进程再启动。

## 8. 数据在哪，怎么备份

- 会话：`state/sessions.json` 与 DSH 的 `sessions/`；记忆：`state/social-v2.json`；账本：`state/token-usage.jsonl`。
- 备份整个 `state/` 就够。回收站（`state` 里的 `_trash` 逻辑）不要手动清空。

查不到就开 Issue，贴日志（记得打码 QQ 号）。
