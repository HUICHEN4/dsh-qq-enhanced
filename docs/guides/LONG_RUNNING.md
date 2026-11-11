# 长期运行：换会话、看成本、备份

跑得越久，上下文越长、每步越贵，AI 也越容易「记混」。这篇讲怎么维护，不涉及装和调。

---

## 一、什么时候该换会话

满足任意两条就换：

- 控制台「会话」里，该会话**上一步读的上下文超过 120K token**（一般 80K↔120K 来回锯齿就说明压缩块在堆了）；
- 该会话的摘要块（压缩记录）到 5 个以上；
- 单轮花费比前几天**翻倍**，但群里活跃度没变；
- AI 开始张冠李戴：叫错人、把旧话题当新话题、重复问已经答过的事。

**为什么**：每轮会往上下文里净增约 5K token（记忆、最近消息、摘要），48K 涨到 85K 大约 7–8 轮。上下文越大，每一步都要重读一遍——钱是按「步数 × 上下文」烧的，不是按命中率。

> 压缩由谁做、DSH 那边要配什么，见 [CONTEXT_COMPRESSION.md](CONTEXT_COMPRESSION.md)。

---

## 二、怎么换

**控制台（推荐）**：打开 <http://127.0.0.1:3099> →「会话」→ 找到那一行 →「清除上下文」。

等价接口（脚本/自动化用）：

```bash
curl -X POST http://127.0.0.1:3100/api/session/reset \
  -H "content-type: application/json" \
  -H "x-console-token: $(cat state/console-token)" \
  -d '{"key":"group:123456789"}'
# → {"ok":true,"key":"group:123456789","archived":"session-xxxxxxxx-..."}
```

它会做这几件事：

- 停掉旧会话正在跑的任务；
- 把旧会话**归档**（`archiveSession`），不是删除——历史还在，只是不再被唤醒注入；
- 清掉这个 key 的：会话映射、权限模式（回默认）、最近的收发记录、静默状态、等待租约、黑话窗口；
- **清掉 social-v2 里这个会话的记忆**（群友印象、正在聊的话题等）。

所以换会话不是「无损续命」，是「开新的一段关系」。想留住东西，见下一节。

---

## 三、换之前：先交接，再重置

顺序很重要：**重置会把这个会话的记忆一起删掉，所以必须先重置、再写记忆**。反过来做等于白写。

交接什么（挑 5～10 条就够）：

- 最近聊的话题（谁在追什么、哪件事没聊完）；
- 人物印象（谁是谁、脾气、称呼）；
- 群规则/梗（只有这个群懂的）。

两种写法：

1. **聊天里让她自己记**：私聊说「记住：老张不喜欢被叫群主」「在聊战雷苏系」，她会调 `qq_note_person` 记人物印象；
2. **接口**（先 reset，再写，能写话题/念头/印象三类）：

```bash
curl -X POST http://127.0.0.1:3100/api/socialV2/memory-append \
  -H "content-type: application/json" \
  -H "x-console-token: $(cat state/console-token)" \
  -d '{"key":"group:123456789","category":"activeTopic","content":"群里在聊战雷苏系坦克，我上次把 T-54 认成 IS 系被笑了"}'
```

写进去的内容会进下一个会话的第一条系统提示，等于「她记得」。

---

## 四、成本怎么看

- 控制台：「令牌与花费」看板（按天、按会话、峰谷价）；
- 原始账本：`state/token-usage.jsonl`，一步一条，字段 `cacheHit` / `cacheMiss` / `output`。

计价公式（价格以控制台设置为准，官方调价要自己改）：

```
cost = cacheHit/1e6 * 命中价 + cacheMiss/1e6 * 未命中价 + output/1e6 * 输出价
```

两点经验：

- **别盯着命中率**：正常跑起来命中率 97% 以上，再提也就省几分钱；
- **看步数和上下文**：同样一句话，一步回答和五步回答差 5 倍；上下文 40K 和 120K 又差 3 倍。省钱的顺序是：少走步数 = 换会话 > 少看图 > 少分条。

---

## 五、备份

**备份什么**：停掉桥接后，整个 `state/` 目录 + `config.json` + `roles/`。会话、记忆、账本、令牌、接口平台映射都在里面。

```bash
# Windows PowerShell 示例
Copy-Item -Recurse state "D:\backup\qq-bridge-state-$(Get-Date -f yyyyMMdd-HHmm)"
Copy-Item config.json, roles "D:\backup\qq-bridge-state-$(Get-Date -f yyyyMMdd-HHmm)" -Recurse
```

**恢复**：停桥接 → 覆盖回去 → 起桥接。会话映射能接上就继续，接不上就等群里下一条消息重新建会话（记忆还在）。

**别做**：

- 别手动清 `state/` 里的回收站/归档目录，那是唯一的撤销手段；
- 别把 `state/` 提交进 git（已在 `.gitignore` 里）；
- 别在桥接运行中复制 `social-v2.json`，可能写到一半——先停再备。
