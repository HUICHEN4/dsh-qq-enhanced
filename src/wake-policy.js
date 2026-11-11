// QQ 桥接的「唤醒策略」单一入口。
//
// 为什么单独一个文件：2026-11-04 一整天加了很多省钱闸门（batchWindow 全局化、连续无行动
// 自动潜水、强制观察窗、冷启动跳过概率、限频），它们原先散落在 bridge.js 的各个处理段里，
// 靠日志认。这里把「默认值 + 读取 + 判断」收在一处，bridge.js 只负责在对应的位置调用，
// 以后加闸/改闸先看这里，再改 config.json 对应的 socialV2.wake.* 键。
//
// 配置键（config.json 的 socialV2.wake 下）：
//   batchWindowMs             合并窗口，同一话题的消息攒多久再决定要不要醒（默认 12000）
//   maxWakePerMinute          每分钟最多真唤醒几次（默认 1，超了排队）
//   maxWakePerHour            每小时最多真唤醒几次（默认 15，硬上限；观察窗唤醒不占这个名额）
//   maxSoftWakePerHour        观察窗唤醒每小时最多几次（默认 20，0=不限制；这部分很便宜，单独计数）
//   noActionLimit             连续几次「醒了但没说」就自动进潜水（默认 2）
//   forceObserveAfterReplyMs  刚回过话要深潜时，强制改成多长的有限观察窗（默认 180000，0=关）
//   coldStartSkipMinutes      距离上次唤醒超过多久就不按概率叫醒（默认 180，0=关）
//   replyGuardAfterReplyMs    「刚回过话」的判定窗口（默认 120000）

export const WAKE_GATE_DEFAULTS = Object.freeze({
  batchWindowMs: 12000,
  maxWakePerMinute: 1,
  maxWakePerHour: 15,
  maxSoftWakePerHour: 20,
  noActionLimit: 2,
  forceObserveAfterReplyMs: 180000,
  coldStartSkipMinutes: 180,
  replyGuardAfterReplyMs: 120000,
});

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// 把 config.json 的 socialV2.wake 归一化成一份策略对象（含默认值与下限保护）。
export function wakePolicy(cfg = {}) {
  const w = cfg?.socialV2?.wake ?? {};
  const d = WAKE_GATE_DEFAULTS;
  return {
    batchWindowMs: Math.max(1000, num(w.batchWindowMs, d.batchWindowMs)),
    // 限频：0 表示不限制（保留旧语义），未配置/非法才用默认值。
    maxWakePerMinute: Math.max(0, Math.round(num(w.maxWakePerMinute, d.maxWakePerMinute))),
    maxWakePerHour: Math.max(0, Math.round(num(w.maxWakePerHour, d.maxWakePerHour))),
    maxSoftWakePerHour: Math.max(0, Math.round(num(w.maxSoftWakePerHour, d.maxSoftWakePerHour))),
    noActionLimit: Math.max(1, Math.round(num(w.noActionLimit, d.noActionLimit))),
    forceObserveAfterReplyMs: Math.max(0, Math.round(num(w.forceObserveAfterReplyMs, d.forceObserveAfterReplyMs))),
    coldStartSkipMinutes: Math.max(0, num(w.coldStartSkipMinutes, d.coldStartSkipMinutes)),
    replyGuardAfterReplyMs: Math.max(0, Math.round(num(w.replyGuardAfterReplyMs, d.replyGuardAfterReplyMs))),
  };
}

// 冷启动跳过：群里很久没醒过时，缓存前缀已经过期，这时按概率插话要把整段上下文按 miss 重算。
export function isColdStartSkipped(policy, lastWakeAt, now = Date.now()) {
  const min = Number(policy?.coldStartSkipMinutes) || 0;
  const at = Number(lastWakeAt) || 0;
  if (min <= 0 || at <= 0) return false;
  return now - at > min * 60000;
}

// 强制观察窗：群里刚回过话却想无限期潜水时，改成一段有限观察窗。
// 返回 null 表示不需要改；否则返回要写入的 sleepUntil 与时长。
//
// windowWake：这一轮本来就是被观察窗叫醒的。她看完决定不接，就该真的收，
// 不能再把窗口续上——否则「窗口叫醒 → 标读 → 又挂窗口」会自己转圈，
// 一次约 ¥0.011，连着烧到软名额用完（2026-11-05 18:21 实测四分钟醒六次）。
export function forceObserveDecision(policy, { key, infinite, lastAiReplyAt, windowWake }, now = Date.now()) {
  const forceMs = Number(policy?.forceObserveAfterReplyMs) || 0;
  if (forceMs <= 0) return null;
  if (windowWake) return null;
  if (!String(key || '').startsWith('group:')) return null;
  if (!infinite) return null;
  const guardMs = Number(policy?.replyGuardAfterReplyMs) || 0;
  const repliedAt = Number(lastAiReplyAt) || 0;
  if (!repliedAt || now - repliedAt >= guardMs) return null;
  return { forceMs, sleepUntil: new Date(now + forceMs).toISOString() };
}

// 给控制台/文档用的一句话清单：每道闸现在是什么值、什么时候生效。
export function describeWakeGates(policy) {
  return [
    `合并窗口 ${policy.batchWindowMs}ms（同一话题的消息先攒再决定）`,
    `限频 每分钟 ${policy.maxWakePerMinute} 次 / 每小时 ${policy.maxWakePerHour} 次（超了排队，不丢消息）`,
    policy.maxSoftWakePerHour > 0
      ? `观察窗唤醒 单独计数，每小时最多 ${policy.maxSoftWakePerHour} 次（不占上面的硬名额）`
      : '观察窗唤醒 不限次数（不占硬名额）',
    `止损 连续 ${policy.noActionLimit} 次醒了没说就自动进潜水`,
    policy.forceObserveAfterReplyMs > 0
      ? `强制观察窗 刚回过话要深潜时改成 ${Math.round(policy.forceObserveAfterReplyMs / 60000)} 分钟有限观察窗`
      : '强制观察窗 关闭',
    policy.coldStartSkipMinutes > 0
      ? `冷启动跳过 距上次唤醒超过 ${policy.coldStartSkipMinutes} 分钟不按概率叫醒`
      : '冷启动跳过 关闭',
  ];
}

// 2026-11-06：原先这两张名单散在 bridge.js 里（写「算不算点名」的地方各抄一份）。
// 宽的那张给软名额用：被点名/被提问/命中关键词/被指定发言，都不该吃 softWakePerHour；
// 窄的那张给「静默期漏掉了什么、结束后要不要补唤醒」用：只认真正的点名与直接对话，
// 不把 keyword/speaker 算进去，否则静默一结束就按旧关键词消息补唤醒，白花钱。
export const ADDRESSED_WAKE_REASONS = Object.freeze(['atMention', 'quoteSelf', 'nameMention', 'question', 'keyword:', 'speaker:']);
export const SILENCE_CATCHUP_REASONS = Object.freeze(['atMention', 'quoteSelf', 'nameMention', 'question', 'poke', 'private', 'speaker', 'ownerRelay']);

export function isAddressedReasonV2(reason) {
  const r = String(reason ?? '');
  const base = r.split(':')[0];
  return ADDRESSED_WAKE_REASONS.some((x) => (x.endsWith(':') ? r.startsWith(x) : base === x));
}

export function isSilenceCatchupReasonV2(reason) {
  return SILENCE_CATCHUP_REASONS.includes(String(reason ?? '').split(':')[0]);
}
