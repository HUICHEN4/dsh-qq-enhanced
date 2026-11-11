// 桥接日志里怎么称呼「QQ 后端」：按实际连接的路径与后端自报的程序名，而不是一律写「SnowLuma」。
//   · 直连 SnowLuma（旧布局）：「SnowLuma 1.14.9」（后端自报是 SnowLuma 时）；
//   · 直连 NapCat：「QQ 后端（NapCat 4.18.38）」（后端自报是 NapCat 时）；
//   · 经接口平台：「QQ 后端（经接口平台 · NapCat 4.18.38）」——平台背后可能是 NapCat、SnowLuma 或以后的其他后端；
//   · 握手前 / 连不上、还不知道后端是谁：「QQ 后端」（中性称呼，不硬说是 SnowLuma）。
// 只用于日志 / 状态文字，不参与任何判断。

/** get_version_info 的回执 → { name, version }；认不出时 name 为 null。 */
export function qqBackendFromVersionInfo(data) {
  const app = String(data?.app_name ?? '').trim();
  const version = data?.app_version != null ? String(data.app_version).trim().slice(0, 40) : '';
  let name = null;
  if (/napcat/i.test(app)) name = 'NapCat';
  else if (/snowluma/i.test(app)) name = 'SnowLuma';
  else if (app) name = app.slice(0, 40);
  return { name, version: version || null };
}

/** 日志里的称呼。backend 来自 qqBackendFromVersionInfo（可为 null = 还不知道）。 */
export function qqBackendLabel({ viaPlatform = false, backend = null } = {}) {
  const who = backend?.name ? `${backend.name}${backend.version ? ` ${backend.version}` : ''}` : '';
  if (viaPlatform) return `QQ 后端（经接口平台${who ? ` · ${who}` : ''}）`;
  if (backend?.name === 'SnowLuma') return `SnowLuma${backend.version ? ` ${backend.version}` : ''}`;
  if (who) return `QQ 后端（${who}）`;
  // 还不知道后端是谁（握手前 / 连不上，比如 NapCat 没启动）：不硬说是 SnowLuma —— 本机实际跑的可能是 NapCat 或别的 OneBot 实现。
  return 'QQ 后端';
}
