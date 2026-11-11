# 什么情况会叫醒她（唤醒策略清单）

代码入口：`src/wake-policy.js`（闸门默认值 + 判断）、`src/topic-continuity.js`（话题接续），
配置在 `config.json` 的 `socialV2.wake.*`。

## 一、唤醒来源

| 来源 | 说明 | 会被哪道闸拦 |
| --- | --- | --- |
| `atMention` / `nameMention` / `question` / `poke` | 被 @、被叫名字（群友名字先抹掉，避免把 master 的名片当关键词）、被提问、被拍 | 只受限频，冷启动跳过管不着 |
| `keywords` / `speakerIds` | 命中关键词、指定群友说话 | 同上 |
| `anyMessage` | 活跃模式：任何新消息；**监控期内不触发** | 限频 |
| `timeout` | 她自己设的定时/有限睡眠到点 | 软名额；监控窗到期不再发唤醒 |
| `replyCheck` | 发完消息后 30 秒检查有没有人接 | 软名额 |
| `proactiveCheck` | 主动冒泡机会（默认 30~90 分钟；冷启动期打 0.2 折而不是跳过） | 硬名额 |
| 概率 | 普通消息按 `probability` 掷骰（三个群 0.01） | 冷启动跳过 + 限频 |

## 二、监控期（2026-11-05 取代旧「观察窗」）

接续结束后（或她回完话却既没开接续、也没设收尾时）进 **3 分钟监控期**（`forceObserveAfterReplyMs`，turn 结束兜底；2026-11-06 起不再因「刚回过话就请求潜水」强行插监控期）：

- 期间**不再因为闲聊被叫醒**——消息照常记未读，但不重建 prompt、不调模型；
- 点名类（@/名字/关键词/提问/引用/拍一拍）照常叫醒，优先级最高；
- 期满**安静进潜水，不发 `timeout` 唤醒**；
- 设 `triggers.anyMessage = true` 并给 `sleepUntil`（2026-11-06 起不再写 `windowWatch`，监控窗只认 `anyMessage`），到期由 `expireFiniteSleepV2` 归一成 `infinite=true / sleepUntil=null / anyMessage=false`。

旧版（`anyMessage` 常开）实测 5 分钟醒 7 次、约 ¥0.08~0.11；现在是 0。

## 三、话题接续 / 一直醒着（2026-11-05 起，2026-11-06 升级为「活人模式」）

她发完言 → 桥接让她「醒着」（`socialV2.wake.topicContinuation`，配置见下）：

```json
{ "enabled": true, "idleWindowMs": 900000, "batchWindowMs": 12000,
  "silentBatchWindowMs": 60000, "judgeByModel": true, "maxSilentBatches": 3,
  "minScore": 0.3, "minHits": 1,
  "maxTotalMs": 14400000, "anchorTexts": 6,
  "sleepPhrases": ["去睡了", "我先睡", "先睡了", "睡觉去了", "下潜了", "晚安", "睡了"],
  "dailySoftBudgetCny": 2.5 }
```

- **话题判定默认交给模型**（`judgeByModel: true`，2026-11-06 master m04843）：每批消息都追加，
  接不接由她看完自己决定；接续提示词里明确写「换了话题或插不上话就什么都别做」。
  代价是沉默时也在付钱（60 秒一批），换取她能接住同义改写、指代和语气；
- `judgeByModel: false` 才退回旧模式：本地词表（中文二元组）打分，`score >= 0.3` 才算接上，
  偏了直接停（省钱的硬模式，接不住同义改写）；
- 消息按 **12 秒**合批（她沉默时 60 秒），通过 `deliverPromptNow(key, prompt, { continuation: true })`
  **追加**到同一会话——**不重建 wake prompt**（记忆/规则/黑话都不重发，缓存是热的），每批约 ¥0.004~0.006；
- **连续 3 批没开口就收工**（`maxSilentBatches`，master m04982）：她不说话就不再白送第四批，直接切回潜水等点名；
- 冷场 15 分钟（`idleWindowMs`）是上限：有人接话就续期（单轮总上限 `maxTotalMs` 4 小时），没人说话就静默失效；
- 她**只看不说**时合批放慢到 **60 秒一批**（`silentBatchWindowMs`，约省 3/4）；
  判定=`awaitingReplyAt > lastAiAt`，她一开口就恢复 12 秒；
- 日志「话题偏了…」只在 `judgeByModel: false` 时出现；默认模式下看「追加 N 条（模型判定…）」；
- 她说「去睡了 / 晚安」→ `maybeSleepFromPhraseV2`：接续结束 + 进深潜收工。
  **刻意不挂定时唤醒**（到点专门叫醒一次纯烧钱），只留 triggers —— @/名字/关键词/提问/拍一拍 照样叫醒；
- `mark_read` / 设置唤醒配置 / 真唤醒到来都会结束接续；
- **定时静默**（`state/silence-schedule.json`，工作日 09–12 / 14–18 高峰档）开始时：
  `silenceTick` 把还在跑的接续全部 `endContinuationV2(key, 'silence')`；`startContinuationV2` 在静默里直接不开，
  `flushContinuationV2` 投递前再查一次 `scheduledSilenceFor`（接续走的是 `deliverPromptNow`，
  绕过了 `sendWakePromptV2` 的静默闸门，所以必须单独拦）。静默期间消息只记未读，点名类照旧标 `silenceMissedDirect`
  等静默结束补一次唤醒（master m05329）；
- 追加成功的消息会从未读里剔除（`dropDeliveredUnreadV2`），下次真唤醒不会再看一遍；
- 日用量粗估写 `state/usage-daily.json`（`{date,batches,wakes,estCny}`，每批 ¥0.005 / 每次唤醒 ¥0.012）；
  到 `dailySoftBudgetCny` 只在 wake prompt 里加一行提醒她自己歇，**不拦**；
- 只对 `group:` 生效，私聊仍是每条都醒。

## 四、每道闸

1. **合并窗口** `batchWindowMs`（默认 12000）：同一话题消息先攒 12 秒再决定要不要醒。
2. **硬性名额** `maxWakePerMinute` / `maxWakePerHour`（默认 1 / 15）：**天花板**，不是"超了就丢"——
   超了每 60 秒重试一次直到有名额腾出来（重试本身不花钱）。
3. **软名额** `maxSoftWakePerHour`（默认 20，0=不限）：观察窗/定时/主动机会单独计数，不挤硬名额。
   点名类唤醒（`addressedWake`）**不吃软名额**，避免"被 @ 却被软配额卡住"。
4. **重试分级** `retryWakePriorityV2`：`atMention` 60 > 提问/名字/关键词/指定发言人 50 > anyMessage/poke 30 >
   其余 20 > 定时类 10。高优先级顶掉正在排队的低优先级原因；定时类撞限频**直接丢弃不排队**。
5. **止损** `noActionLimit`（默认 2）：连着 2 次醒了没说话，自动进无限期潜水。
6. **回复守卫**：~~刚回过话就标读收尾，强制改成监控期~~ —— 2026-11-06（master m05450）**已删除**。
   接续机制接管了「刚聊完别马上失联」，这条旧规则只会把人按进只记不醒的监控期，
   把她请求的无限期潜水改写掉、把别人后面的话全挡掉（01:20「你可以睡了」没回就是它）。
   同日（12:11）还把提示词 `preSleepLine` 里的老指令一起改了：旧版教她「话题还在继续就设 3 分钟监控期」，
   而她一调 `qq_set_wake_config` 就会触发 `endContinuationV2(key,'set_wake_config')` 把接续关掉，
   后面别人说话只能靠一次全新唤醒兜住（12:05–12:10 实测三轮全量唤醒 ¥0.47）。
   现在只在她明确要睡（`infinite:true`）或改唤醒条件时才调这个工具，普通收尾用 `qq_mark_read` 或不管。
7. **冷启动跳过** `coldStartSkipMinutes`（默认 180）：距上次唤醒超 3 小时，概率唤醒跳过、群拍一拍跳过
   （私聊不跳），主动机会只打 0.2 折。硬触发不受影响。
8. **启动补扫** `rescanMissedMentionsV2`：连上后 8 秒扫各群最近 15 条未读，发现 @ 自己/叫自己名字就补一次
   `atMention` 唤醒（防重启丢掉内存里的重试定时器后彻底吞 @）。
9. **定时静默** `silence`：静默时段内一律不唤醒（定时任务除外），接续批次也一并收工。
10. **会话繁忙**：上一回合没跑完时，唤醒原因先暂存（最多 20 条），跑完再补。

## 五、状态字段

`state/social-v2.json` 每个会话桶里：

- `wakeTimes`：硬名额用的时间戳（最近 200 条）
- `softWakeTimes`：软名额时间戳（最近 200 条）
- `wakeConfig`：当前唤醒条件（mode / infinite / sleepUntil / triggers / lastWakeAt / wakeCount；`windowWatch` 字段 2026-11-06 已删）
- `rateLimitReason`：正在排队等待的原因（配优先级用，解除时清空）
- `continuation`：接续记录（`active` / `untilMs` / `anchors` / `pending` / `closeReason` /
  `silent` / `lastAiAt` / `awaitingReplyAt`）；**不在 `saveSocialV2State` 白名单里**，重启即丢（可接受）
- `state/usage-daily.json`：日用量粗估（`date` / `batches` / `wakes` / `estCny`），跨天自动清零

两个坑：`socialV2.conversations` 是 **Map**，`Object.entries()` 永远空，遍历要用 `.entries()` / `.values()`；
`loadSocialV2State()` 只填充模块级 `socialV2`，**没有返回值**。

## 六、怎么看

- 日志 `state/bridge.log`：`唤醒 …（原因）`、`唤醒频率超限`、`限频解除`、`冷启动跳过概率唤醒`、
  监控期到期、`[接续] 进入接续期 / 追加 N 条 / 话题偏了（仅 judgeByModel=false）`、`补扫未读结束：N 个群有未读，补唤醒 M 个`
- 控制台 `http://127.0.0.1:3100` 有每会话的唤醒配置与最近唤醒
- 账单 `state/token-usage.jsonl`
