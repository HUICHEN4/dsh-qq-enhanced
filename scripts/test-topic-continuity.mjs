#!/usr/bin/env node
/**
 * 话题接续模块的单测（不依赖桥接进程）。
 * 跑：node scripts/test-topic-continuity.mjs
 */
import assert from 'node:assert/strict';
import {
  tokenize, buildAnchors, scoreTopic, decideContinuation,
  openContinuation, renewContinuation, closeContinuation, isContinuationActive,
  resolveContinuationConfig, DEFAULT_CONTINUATION, isSleepPhrase, nextBatchWindowMs
} from '../src/topic-continuity.js';

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

const cfg = resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { windowMs: 180000 } } } });

ok('tokenize 中文二元组 + 英文词', () => {
  const toks = tokenize('那个 bass solo 太顶了');
  assert.ok(toks.includes('bass'));
  assert.ok(toks.includes('solo'));
  assert.ok(toks.some((t) => t.includes('太顶')));
  assert.ok(!toks.includes('的'));
});

ok('tokenize 空文本返回空数组', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
});

ok('同一话题：贝斯/扒谱 判定为相关', () => {
  const anchors = buildAnchors([
    '你们听昨天那场 live 了吗，bass 那段 solo 太顶了',
    '我扒了一半谱，第三小节那个滑音死活扒不下来'
  ]);
  const r = decideContinuation({ anchors }, ['是啊那段 bass 我也在扒，滑音好像是 hammer-on'], cfg);
  assert.equal(r.ok, true, `score=${r.score} hits=${r.hits}`);
});

ok('换话题：显卡驱动 判定为不相关', () => {
  const anchors = buildAnchors(['你们听昨天那场 live 了吗，bass 那段 solo 太顶了']);
  const r = decideContinuation({ anchors }, ['顺便问下，显卡驱动怎么装，我这个一直报错'], cfg);
  assert.equal(r.ok, false, `score=${r.score} hits=${r.hits}`);
});

ok('纯灌水不相关', () => {
  const anchors = buildAnchors(['挑3那堆反应装甲到底有没有用']);
  const r = decideContinuation({ anchors }, ['哈哈哈'], cfg);
  assert.equal(r.ok, false);
});

ok('锚点为空时不接续', () => {
  const r = decideContinuation({ anchors: { tokens: [], weight: new Map() } }, ['随便说点'], cfg);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'anchor-empty');
});

ok('开/续/关 接续态', () => {
  const now = 1_000_000;
  let cont = openContinuation(null, { now, texts: ['bass solo 那段'], config: cfg });
  assert.equal(cont.active, true);
  assert.equal(cont.untilMs, now + cfg.windowMs);
  assert.equal(isContinuationActive(cont, now + 1000), true);
  assert.equal(isContinuationActive(cont, now + cfg.windowMs + 1), false);

  cont = renewContinuation(cont, { now: now + 60000, config: cfg });
  assert.equal(cont.untilMs, now + 60000 + cfg.windowMs);
  assert.equal(cont.renewals, 1);

  const closed = closeContinuation(cont, 'topic-switched');
  assert.equal(closed.active, false);
  assert.equal(closed.closeReason, 'topic-switched');
  assert.equal(isContinuationActive(closed, now + 70000), false);
});

ok('续期不能超过 maxTotalMs', () => {
  const now = 0;
  const cont = openContinuation(null, { now, texts: ['x1 话题'], config: cfg });
  const renewed = renewContinuation(cont, { now: cfg.maxTotalMs - 1000, config: cfg });
  assert.ok(renewed.untilMs <= cont.startedAt + cfg.maxTotalMs);
});

ok('config 兜底与夹取', () => {
  const c = resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { windowMs: 1, batchWindowMs: 1, minScore: 5, minHits: 0 } } } });
  assert.equal(c.enabled, true);
  assert.ok(c.windowMs >= 30000);
  assert.ok(c.batchWindowMs >= 3000);
  assert.ok(c.minScore <= 0.9);
  assert.ok(c.minHits >= 1);
  assert.equal(resolveContinuationConfig(null).windowMs, DEFAULT_CONTINUATION.windowMs);
});

ok('scoreTopic 返回 0~1 且命中词在 hits 里', () => {
  const anchors = buildAnchors(['bass 滑音 扒谱']);
  const r = scoreTopic(anchors, '滑音太难了');
  assert.ok(r.score > 0 && r.score <= 1);
  assert.ok(r.hits.includes('滑音'));
});

ok('冷场窗口默认 15 分钟（m04640）', () => {
  assert.equal(resolveContinuationConfig(null).idleWindowMs, 900000);
  assert.equal(DEFAULT_CONTINUATION.maxTotalMs, 14400000);
});

ok('沉默时合批放慢到 60 秒', () => {
  assert.equal(nextBatchWindowMs({ silent: true }, cfg), cfg.silentBatchWindowMs);
  assert.equal(nextBatchWindowMs({ silent: false }, cfg), cfg.batchWindowMs);
  assert.equal(nextBatchWindowMs({}, cfg), cfg.batchWindowMs);
});

ok('认出「去睡了 / 晚安」这类告别', () => {
  assert.equal(isSleepPhrase('那我先去睡了，明天再聊', cfg.sleepPhrases), true);
  assert.equal(isSleepPhrase('晚安～', cfg.sleepPhrases), true);
  assert.equal(isSleepPhrase('这段贝斯真难扒', cfg.sleepPhrases), false);
  assert.equal(isSleepPhrase('', cfg.sleepPhrases), false);
});

ok('续期用 idleWindowMs 而不是旧 windowMs', () => {
  const c = resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { idleWindowMs: 600000 } } } });
  const now = 5_000_000;
  const cont = openContinuation(null, { now, texts: ['bass 那段'], config: c });
  assert.equal(cont.untilMs, now + 600000);
  const renewed = renewContinuation(cont, { now: now + 1000, config: c });
  assert.equal(renewed.untilMs, now + 1000 + 600000);
});

ok('开了接续先按热聊节奏（silent=false）', () => {
  const cont = openContinuation(null, { now: 1, texts: ['bass'], config: cfg });
  assert.equal(cont.silent, false);
  assert.equal(cont.awaitingReplyAt, 0);
  assert.equal(nextBatchWindowMs(cont, cfg), cfg.batchWindowMs);
});

ok('默认把话题判定交给模型（m04843）', () => {
  assert.equal(resolveContinuationConfig(null).judgeByModel, true);
  assert.equal(resolveContinuationConfig({ socialV2: { wake: { topicContinuation: {} } } }).judgeByModel, true);
  assert.equal(resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { judgeByModel: false } } } }).judgeByModel, false);
});

ok('连续沉默批数上限（m04982）', () => {
  assert.equal(resolveContinuationConfig(null).maxSilentBatches, 3);
  assert.equal(resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { maxSilentBatches: 5 } } } }).maxSilentBatches, 5);
  assert.equal(resolveContinuationConfig({ socialV2: { wake: { topicContinuation: { maxSilentBatches: 0 } } } }).maxSilentBatches, 1, '下限 1');
  const cont = openContinuation(null, { now: 1, texts: ['bass'], config: cfg });
  assert.equal(cont.silentBatches, 0, '开接续时沉默计数归零');
});

console.log(`\n${passed} 项通过`);
