/**
 * 话题接续（topic continuity）——纯函数模块，不碰网络、不碰状态。
 *
 * 目的：她回完一句话后，桥接进入「接续期」。期间群里的新消息会被**追加**到
 * 同一个 DSH 会话（轻量 prompt，不重建记忆/规则块）；冷场满 idleWindowMs 自然
 * 失效，等下一次真正唤醒。
 *
 * 判定默认交给模型（judgeByModel=true，master m04843）——每批都追加，她看完
 * 自己决定接不接。本地 acquire 打分（scoreTopic/decideContinuation）保留，
 * 供 judgeByModel=false 时退回「词重叠硬判、偏了直接停」的老模式。
 */

// 高频虚词/口癖：匹配上也不算话题相关
const STOPWORDS = new Set([
  '的', '了', '吗', '呢', '吧', '啊', '呀', '哦', '嗯', '哈', '是', '在', '有', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '这个', '那个', '这么', '那么', '什么', '怎么', '就是', '还是', '可以', '不是',
  '真的', '一个', '一下', '现在', '然后', '但是', '所以', '因为', '如果', '已经', '没有', '知道', '觉得',
  '好吧', '哈哈', '呵呵', '嘿嘿', 'emmm', 'emm', '草', '哇', '诶', '欸', '草草'
]);

const CJK_RUN = /[\u4e00-\u9fff\u3400-\u4dbf]+/g;
const LATIN_TOKEN = /[a-z0-9][a-z0-9_+#.-]*/gi;

function isCjk(ch) {
  const code = ch.codePointAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

/**
 * 切词：中文按二元组（单字成词时保留单字），英文/数字按词。
 * 返回去重后的 token 数组（保持出现顺序）。
 */
export function tokenize(text) {
  const raw = String(text ?? '');
  if (!raw.trim()) return [];
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (!t || t.length < 1 || STOPWORDS.has(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const run of raw.match(CJK_RUN) ?? []) {
    // 单字成词：像「琴」「梗」这种一个字也有信息量，但只保留非停用字
    if (run.length === 1) push(run);
    for (let i = 0; i < run.length - 1; i += 1) push(run.slice(i, i + 2));
  }
  for (const m of raw.match(LATIN_TOKEN) ?? []) {
    const t = m.toLowerCase();
    if (t.length >= 2) push(t);
  }
  return out;
}

/**
 * 从一组文本里建话题锚点。
 * 返回 { tokens: string[], weight: Map<string, number> }，tokens 按权重降序。
 */
export function buildAnchors(texts, opts = {}) {
  const maxTokens = Math.max(4, Number(opts.maxTokens) || 40);
  const weight = new Map();
  const list = (Array.isArray(texts) ? texts : [texts]).filter((t) => t != null);
  for (const text of list) {
    const toks = tokenize(text);
    if (!toks.length) continue;
    // 每条文本内部按「词频/长度」给一点权重，避免长文本淹没短句
    const per = new Map();
    for (const t of toks) per.set(t, (per.get(t) || 0) + 1);
    for (const [t, c] of per) weight.set(t, (weight.get(t) || 0) + 1 + Math.min(2, (c - 1) * 0.5));
  }
  const tokens = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTokens).map(([t]) => t);
  const kept = new Map(tokens.map((t) => [t, weight.get(t)]));
  return { tokens, weight: kept };
}

/**
 * 给一段新文本打「和锚点多相关」的分。0~1。
 * - 命中词按锚点权重累加
 * - 分母用「文本长度」和「锚点规模」双限制，避免长文本靠堆词刷分
 */
export function scoreTopic(anchors, text) {
  const toks = tokenize(text);
  if (!toks.length || !anchors?.tokens?.length) return { score: 0, hits: [], total: 0 };
  const hits = [];
  let sum = 0;
  for (const t of toks) {
    const w = anchors.weight.get(t);
    if (w) {
      sum += w;
      hits.push(t);
    }
  }
  if (!hits.length) return { score: 0, hits: [], total: sum };
  const denom = Math.min(8, Math.max(3, toks.length));
  const score = Math.min(1, sum / denom);
  return { score, hits, total: sum };
}

export const DEFAULT_CONTINUATION = Object.freeze({
  enabled: true,
  idleWindowMs: 900000,        // 冷场 15 分钟：话题没断就一直醒着
  windowMs: 900000,            // 兼容旧键名，等同 idleWindowMs
  batchWindowMs: 12000,        // 她刚说过话：12 秒合批
  silentBatchWindowMs: 60000,  // 她看着不说话：放慢到 60 秒一批（省约 3/4）
  minScore: 0.3,               // 话题相关阈值（仅 judgeByModel=false 时生效）
  minHits: 1,                  // 至少命中 1 个锚点词（同上）
  judgeByModel: true,          // true=每批都追加，接不接由她自己判断（master m04843）
  maxTotalMs: 14400000,        // 安全上限：一轮接续最长 4 小时
  anchorTexts: 6,              // 建锚点时取最近几条消息
  sleepPhrases: Object.freeze(['去睡了', '我先睡', '先睡了', '睡觉去了', '下潜了', '晚安', '睡了']),
  maxSilentBatches: 3,         // 连续这么多批她都没开口 → 直接收工去睡，等下一次点名（master m04982）
  sleepMs: 14400000,           // 她说「去睡了」→ 真睡 4 小时（@ 仍能叫醒）
  dailySoftBudgetCny: 2.5,     // 每天到这个数就在提示词里提醒她歇会儿（不拦）
  estimatePerBatchCny: 0.005,
  estimatePerWakeCny: 0.012
});

export function resolveContinuationConfig(cfg) {
  const raw = cfg?.socialV2?.wake?.topicContinuation ?? cfg ?? {};
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const idleWindowMs = Math.max(60000, num(raw.idleWindowMs ?? raw.windowMs, DEFAULT_CONTINUATION.idleWindowMs));
  const sleepPhrases = Array.isArray(raw.sleepPhrases) && raw.sleepPhrases.length
    ? raw.sleepPhrases.map((p) => String(p ?? '').trim()).filter(Boolean)
    : [...DEFAULT_CONTINUATION.sleepPhrases];
  return {
    enabled: raw.enabled !== false,
    idleWindowMs,
    windowMs: idleWindowMs,
    batchWindowMs: Math.max(3000, num(raw.batchWindowMs, DEFAULT_CONTINUATION.batchWindowMs)),
    silentBatchWindowMs: Math.max(3000, num(raw.silentBatchWindowMs, DEFAULT_CONTINUATION.silentBatchWindowMs)),
    minScore: Math.min(0.9, Math.max(0, num(raw.minScore, DEFAULT_CONTINUATION.minScore))),
    minHits: Math.max(1, num(raw.minHits, DEFAULT_CONTINUATION.minHits)),
    judgeByModel: raw.judgeByModel !== false,
    maxTotalMs: Math.max(60000, num(raw.maxTotalMs, DEFAULT_CONTINUATION.maxTotalMs)),
    anchorTexts: Math.max(2, num(raw.anchorTexts, DEFAULT_CONTINUATION.anchorTexts)),
    sleepPhrases,
    maxSilentBatches: Math.max(1, num(raw.maxSilentBatches, DEFAULT_CONTINUATION.maxSilentBatches)),
    sleepMs: Math.max(600000, num(raw.sleepMs, DEFAULT_CONTINUATION.sleepMs)),
    dailySoftBudgetCny: Math.max(0, num(raw.dailySoftBudgetCny, DEFAULT_CONTINUATION.dailySoftBudgetCny)),
    estimatePerBatchCny: Math.max(0, num(raw.estimatePerBatchCny, DEFAULT_CONTINUATION.estimatePerBatchCny)),
    estimatePerWakeCny: Math.max(0, num(raw.estimatePerWakeCny, DEFAULT_CONTINUATION.estimatePerWakeCny))
  };
}

/** 这句是不是「我要去睡了」这类告别。命中就真让她睡一阵子。 */
export function isSleepPhrase(text, phrases) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  const list = Array.isArray(phrases) && phrases.length ? phrases : DEFAULT_CONTINUATION.sleepPhrases;
  // 2026-11-06 审计：只在短句里认告别。否则「你刚才不是睡了」「他睡了没」这种
  // 也会把她自己按进 4 小时睡眠，白丢一次搭话机会。
  if (t.length > 30) return false;
  return list.some((p) => p && t.includes(p));
}

/** 下一批的合批窗口：她沉默着只看不说时放慢节奏，省掉 3/4 的批次钱。 */
export function nextBatchWindowMs(cont, config = DEFAULT_CONTINUATION) {
  const c = config ?? DEFAULT_CONTINUATION;
  const raw = cont?.silent ? c.silentBatchWindowMs : c.batchWindowMs;
  return Math.max(3000, Number(raw) || DEFAULT_CONTINUATION.batchWindowMs);
}

/** 接续态是否还活着（纯判定，不改状态）。 */
export function isContinuationActive(cont, now = Date.now()) {
  if (!cont || cont.active !== true) return false;
  const until = Number(cont.untilMs) || 0;
  if (until <= now) return false;
  const started = Number(cont.startedAt) || 0;
  const maxTotal = Number(cont.maxTotalMs) || DEFAULT_CONTINUATION.maxTotalMs;
  if (started && now - started > maxTotal) return false;
  return true;
}

/**
 * 判断一批新消息能不能接着聊。
 * 返回 { ok, score, hits, reason }。
 */
export function decideContinuation(cont, texts, config = DEFAULT_CONTINUATION) {
  if (!cont?.anchors?.tokens?.length) return { ok: false, score: 0, hits: [], reason: 'anchor-empty' };
  let best = { score: 0, hits: [] };
  for (const text of Array.isArray(texts) ? texts : [texts]) {
    const r = scoreTopic(cont.anchors, text);
    if (r.score > best.score) best = r;
  }
  const ok = best.score >= config.minScore && best.hits.length >= config.minHits;
  return { ok, ...best, reason: ok ? 'related' : 'topic-switched' };
}

/**
 * 开一个接续态。prev 用来复用 startedAt（续期不改起点，受 maxTotalMs 约束）。
 */
export function openContinuation(prev, { now, texts, config }) {
  const anchors = buildAnchors(texts, { maxTokens: 40 });
  const c = config ?? DEFAULT_CONTINUATION;
  const startedAt = prev && prev.startedAt && isContinuationActive(prev, now) ? prev.startedAt : now;
  return {
    active: true,
    startedAt,
    untilMs: now + (c.idleWindowMs ?? c.windowMs),
    anchors,
    renewals: 0,
    silent: false,
    silentBatches: 0,
    lastAiAt: now,
    awaitingReplyAt: 0
  };
}

/** 续期：同一话题还在聊，窗口顺延。 */
export function renewContinuation(cont, { now, config }) {
  const c = config ?? DEFAULT_CONTINUATION;
  if (!isContinuationActive(cont, now)) return cont;
  return {
    ...cont,
    untilMs: Math.min(now + (c.idleWindowMs ?? c.windowMs), (Number(cont.startedAt) || now) + c.maxTotalMs),
    renewals: (Number(cont.renewals) || 0) + 1
  };
}

export function closeContinuation(cont, reason) {
  if (!cont) return null;
  return { ...cont, active: false, closedAt: Date.now(), closeReason: reason || 'closed' };
}
