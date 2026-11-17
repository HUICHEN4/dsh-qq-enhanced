# 来源与授权声明（NOTICE）

## 本项目

qq-bridge-enhanced 是 [Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge)（MIT 许可，
Copyright (c) 2026 Derpyu520 and qq-bridge / QSH contributors）的二次开发版本，基线为上游 `v0.2.0-r3`
（源码包 `qq-bridge-0.2.0-r3.zip`，与上游 `main` 分支一致）。

直接的上游是 [h-D-ACE/dsh-qq](https://github.com/h-D-ACE/dsh-qq) 的 `qq-bridge-enhanced v1.1.2`：
它先把 qq-bridge 适配到 DeepSeek Harness，本仓库从 v1.1.2 继续，v1.1.3 起的新改动在本仓库。

- 上游的全部代码、文档与资源仍按上游 [LICENSE](LICENSE)（MIT）授权；本仓库保留上游的版权声明与 LICENSE 全文。
- v0.3.0 新增与修改的部分同样以 MIT 许可发布。新增文件主要位于 `src/social/`、`src/admin/`、`src/lib/`、
  `src/bridge-extensions.js`、`dsh/agent-presets/qq-agent-readonly/`、`scripts/test-continuity.mjs` 等，
  完整变更清单见 [CHANGELOG.md](CHANGELOG.md) 与 [docs/release/RELEASE_NOTES_v0.3.0.md](docs/release/RELEASE_NOTES_v0.3.0.md)。
- 本项目与上游作者、DeepSeek、SnowLuma 项目及腾讯公司均无隶属关系。

## 第三方组件（不随本项目分发，适用各自许可）

原 [LICENSE](LICENSE) 后半部分「第三方组件与合规边界」一节仍然有效，现已移至本文末「附录」；以下为 v0.3.0 开发时重新核对的要点：

| 组件 | 本项目如何使用 | 许可要点 |
| --- | --- | --- |
| **SnowLuma**（含专有原生组件 `native/snowluma-*.node/.dll`） | **不包含、不下载、不启动、不修改**；用户自行安装运行，桥接只通过 OneBot v11 WebSocket/HTTP 与它通信 | SnowLuma Source-Available Non-Commercial License v1.0 + EULA v1.1：非商业；**原生组件不得单独再分发、不得并入第三方安装包或通过自动化脚本部署**（EULA §5.4、LICENSE §5）；修改版公开发布需书面许可（LICENSE §3(d)） |
| **@snowluma/sdk**、**@snowluma/mcp**（npm 依赖） | 由 `npm ci` 从 npm 安装，**不随 Release ZIP 分发**；`postinstall` 只修补用户本地 `node_modules` 里的副本 | npm 包声明 `SEE LICENSE IN LICENSE` 但未附带 LICENSE 文件；推定适用 SnowLuma 仓库的许可。其 LICENSE §4(b)「未经授权不得开发、发布基于本软件的另一项目」对「通过 SDK/OneBot 协议与其通信的客户端」是否适用**没有明确条款**——这是上游就存在的法律不确定性，发布前请自行评估，必要时联系 SnowLuma 作者 |
| **DeepSeek Harness（@deepseek-ai/dsh 等）** | 用户自行安装；`@deepseek-ai/dsh-host-apiproxy`、`@deepseek-ai/schemastery` 作为 npm 依赖安装 | 适用其各自的 npm 许可 |
| 其它 npm 依赖 | `npm ci` 安装 | 见各包 LICENSE |

Release ZIP **不包含** `node_modules`、SnowLuma 的任何文件、DSH 的任何文件，也不包含上游仓库曾附带的
`@snowluma/mcp` 工具目录快照 `_snowluma-catalog.json`（v0.3.0 起移除并加入 .gitignore；没有任何代码引用它）。

## 致谢

- [Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge) 的作者与所有贡献者：消息桥接、多群白名单、
  reserved2 二代仿真、接续机制、工具协议、状态持久化都建立在他们的工作之上。
- [h-D-ACE](https://github.com/h-D-ACE/dsh-qq)：本仓库直接基于的 qq-bridge-enhanced v1.1.2，把 qq-bridge 适配到
  DeepSeek Harness 并加上了接口平台、控制中心、跨群认人与分层人物记忆；v1.1.3 起的新改动在本仓库继续。
- DeepSeek Harness、NapCat、SnowLuma 的维护者：桥接只是站在这些组件中间做翻译。
- 群里提意见的人：很多行为改动来自真实使用反馈，而不是设计阶段的想象。
- **Alice**：跑在作者电脑上的 DSH agent，本项目大部分代码、测试与文档的实际执笔者。
  她是工具，不是本项目作者，版权仍归作者与上游所有；但她的参与是真实的，特此致谢。

## 使用风险（上游已声明，重申）

- SnowLuma 是非官方 QQ 协议实现，使用可能违反腾讯服务条款并导致账号受限，风险由使用者承担。
- 群友的消息会发送给 LLM 提供方（DeepSeek 等）；黑话学习会把群聊词条作为关键词发给搜索引擎。数据出机清单见上游 LICENSE。
- v0.3.0 的人物库会在本机长期保存群友的 QQ 号、各群名片与 AI 记下的印象。请告知群友，并善用 `sharePolicy`、`recordable`、
  `/person <QQ> forget` 与保留策略。

---

## 附录：第三方组件与合规边界（原 LICENSE 附录，不是许可证的一部分）

本项目（qq-bridge，将来的 QSH）采用 MIT 许可。**它不覆盖下列第三方组件**，这些组件各自
适用其原始许可，使用前请自行阅读并遵守：

| 组件 | 许可 | 说明 |
| --- | --- | --- |
| [`@deepseek-ai/dsh`](https://github.com/deepseek-ai/deepseek-harness) 及其 `@deepseek-ai/*` 包 | MIT | DeepSeek Harness 本体与官方 API 客户端 |
| [`@snowluma/sdk`](https://www.npmjs.com/package/@snowluma/sdk) / [`@snowluma/mcp`](https://www.npmjs.com/package/@snowluma/mcp) | ⚠️ **声明为 `SEE LICENSE IN LICENSE`，但包里没有 LICENSE 文件**（见下） | 本项目通过 npm 依赖使用；计划在 QSH 里**移除这两个依赖**（见下） |
| [SnowLuma](https://github.com/SnowLuma/SnowLuma) 本体 | SnowLuma 源码可见非商业许可（非 OSI 开源） | **本项目不在仓库内包含、也不分发 SnowLuma 的源码或二进制**，只通过 OneBot v11 协议与它通信（另只读其 `config/onebot_*.json` 以发现 token）。⚠️ 例外见下：`npm install` 会对两个 `@snowluma/*` **npm 包**的本地安装副本做一次机械修补（不触碰 SnowLuma 本体，也不触碰任何原生组件） |
| `@modelcontextprotocol/sdk`、`js-yaml`、`zod` 等 | MIT / ISC | 见各自包内 LICENSE |

#### ⚠️ 已知的依赖许可瑕疵（`@snowluma/sdk` / `@snowluma/mcp`）

**事实**（2026-09-20 实测，可自行复核）：

- 两个包的 `package.json` 都声明 `"license": "SEE LICENSE IN LICENSE"`；
- 但**发布的 npm 包里没有 LICENSE 文件**：`npm pack @snowluma/sdk --dry-run` 的文件清单只有
  `dist/`、`README.md`、`CHANGELOG.md`、`VERSIONING.md`；
- 原因在源头：仓库里 `packages/sdk/package.json` 与 `packages/mcp/package.json` 的 `files` 数组
  **没有包含 `LICENSE`**，且 `packages/sdk/LICENSE` 与 `packages/mcp/LICENSE` 在仓库中**不存在**（均 404）。

**这意味着什么**：这两个包的许可态**在包内不可判定**——`SEE LICENSE IN LICENSE` 指向一个不存在的文件。
但注意：SnowLuma LICENSE §1 对 "Software" 的定义是「the SnowLuma source code and assets **in this repository**」，
而 `packages/sdk` 与 `packages/mcp` **就在那个仓库里** ⇒ 它们在文本上**确实受同一份非商业许可约束**
（这是 §1 定义的直接结论，不是"推断"）。所以**移除依赖的理由比其他处理更硬**，不只是"消除不确定性"。

**本项目对它们的实际做法（据实陈述；不要写成"不修改"）**：

1. **仓库内不含、不分发**它们的代码：`node_modules/` 在 `.gitignore` 里，79 个已跟踪文件中
   没有任何原生二进制（`.node/.dll/.so`）或 `@snowluma` 路径下的文件；
2. **但 `npm install` 会改本地安装副本**：`postinstall` 运行 `scripts/patch-snowluma-sdk.mjs`，
   对 `node_modules/@snowluma/{sdk,mcp}` 的 `dist/**/*.js` 做**一次机械修补**（只给相对导入补 `.js`
   扩展名，绕开这两个包自身的 ESM 打包问题）。许可 §2(c) 允许"为自己的非商业使用而修改"，
   且**只作用于本机安装副本、不进入本仓库**；**所以"不修改 SnowLuma 的源码或二进制"这种说法是不准确的**，
   本项目文档已统一改为上述据实描述；
3. **在 QSH 里移除这两个依赖**（已列入 `QSH-plan` 的 M2 里程碑）——
   - `@snowluma/sdk` 在本项目里只用到两样东西：**1 处 WebSocket 客户端构造**（`bridge.js` 末尾）
     + **3 个 `text()` 调用点**（共 6 次调用；实测裸 `text(` 匹配数为 6；另有 3 个 `scripts/` 诊断脚本也 import 它）。
     OneBot v11 是公开协议规范，自己实现一个最小客户端即可（约 150 行 + 回归）；
     顺带可去掉 `postinstall` 补丁 —— ⚠️ **删依赖与换客户端必须同批落地**（补丁是 `postinstall` 载荷路径，
     只删依赖会让 `npm install` 或启动直接失败）；
   - `@snowluma/mcp` 在本项目里**运行时完全不用**（`src/` 里零引用，仅 `scripts/test-mcp-exec.mjs` 用到）
     ——改成**自建能力矩阵**（只取动作名与参数名这类接口事实，措辞自己写；
     ⚠️ **不要提交它的 `catalog.js` 快照**，那本身就是再分发其内容，会触发 §3(b)(c)）。
4. 若你要更彻底地消除不确定性，可以在给 SnowLumaDevs 的邮件里**顺带问一句**
   「`packages/sdk` 与 `packages/mcp` 适用哪个许可？」—— 这两个包**声明了却未附带**许可文件，
   属于他们该修的打包疏漏，以"用户反馈"的口吻问很自然。

### 使用风险提示

- SnowLuma 是独立第三方项目，与腾讯公司（Tencent）及 QQ **无任何隶属、合作、授权或背书关系**。
- 使用非官方协议工具接入第三方平台**可能违反该平台的服务条款并导致账号受限**，风险由使用者自负。
- 本项目会把 QQ 消息交给大语言模型处理，并可能让模型代替账号发言。请在
  [README.md](README.md) 与 [RULES.md](RULES.md) 说明的白名单/审计机制下使用，不要
  在未配置白名单的情况下直接暴露给任意群聊或陌生人。

#### 📡 数据出机清单（**完整列出，不要只看"发给 LLM"这一句**）

| 目的地 | 什么数据 | 默认 | 怎么关 |
| --- | --- | --- | --- |
| **本机 DSH**（默认 `127.0.0.1:3080`） | 群/私聊消息文本、图片、昵称、会话上下文 | 开 | 不运行 DSH 就没有这个桥接的意义 |
| **LLM 提供方**（经 DSH 调用，默认 provider `deepseek-official`） | 同上——**包括群里其他人的消息**（旁观者数据） | 开 | 在 DSH 里换 provider/model；或不用本程序 |
| **OneBot 网关**（默认 `127.0.0.1:3000/3001`） | 你发出的消息、动作参数 | 开 | 不接 QQ 就没有这个程序的意义 |
| ⚠️ **`web_search` → Bing**（`cn.bing.com`） | **搜索关键词**。**黑话学习默认开启**（`slang.autoResearch: true`），会把**从群聊里提取的词条**作为关键词发出去 | **开** | 不挂载 `mcp-web-search-safe`，或在控制台关掉黑话自动研究 |
| ⚠️ **`web_fetch` → 任意公网 URL** | 被抓取的页面地址（由模型决定，可能包含从聊天内容里得到的线索） | **开** | 同上（`safe-fetch.js` 只拦内网/私有地址，公网都放行） |

> **最后两行是容易被忽略的**：向群友告知"消息会被 AI 处理"时，也要想到**群聊里出现的陌生词**
> 可能被当作搜索关键词发往搜索引擎。若你在意，请在群里启用前告知群成员，或关闭黑话自动研究。
> QSH 计划里有一条**"不引入遥测"的设计不变式**：本程序不上报任何遥测/统计/phone-home 数据
> （已实测确认：源码中没有 telemetry/analytics 类调用，外部目的地只有上面这五个）。

### ⚠️ 关于 SnowLuma 许可的说明（读这段可以省掉你自己研究的一小时）

SnowLuma 采用「源码可见非商业许可」（[LICENSE](https://github.com/SnowLuma/SnowLuma/blob/main/LICENSE)，以中文为准）。
本项目与它的关系是**协议互操作**，据此逐条对照如下（**这是工程层面的理解，不是法律意见**）：

| 条款 | SnowLuma 的要求 | 本项目的情况 |
| --- | --- | --- |
| §2 授权 | 允许为非商业目的**使用、运行**，以及**为自己的非商业使用而修改** | ✅ 落在授权范围内 |
| §3(d) | 公开发布「修改版或**衍生版**」须事先书面许可 | ❌ **不适用**：本项目不在仓库内包含或分发 SnowLuma 的源码与二进制，**不是它的修改版或衍生版**（关于 `@snowluma/*` npm 包与 `postinstall` 修补的据实说明见上文「已知的依赖许可瑕疵」） |
| §4(a) | 禁止**商业使用** | ❌ **不适用**：本项目免费、无任何收费形态 |
| §4(b) | 不得**基于本软件**开发、发布或分发另一个项目 | 见下 |

**关于 §4(b)——两种读法，我们要承认不确定性**：

- **较宽松的读法**（本项目最初采用）：§4(b) 紧接商业限制，且 §1 把「基于本软件的**付费**托管、部署、代搭」
  明确列入商业用途 ⇒ 它的意图是**堵住"把商用包装成一个周边项目来绕过 §4(a)"**，而不是禁止一切互操作工具。
- **较严格的读法（更站得住）**：§4(a) 已经写的是「Commercial Use of the Software **in any form** is
  PROHIBITED」——「**任何形式**」本就涵盖伪装的商业使用。于是宽松读法会让 §4(b) **没有任何独立适用范围**，
  这反而违背了"同一份许可内部应作一致解释"的准则。**能给 §4(b) 赋予独立含义的，恰恰是字面读法**：
  它是一条**不带商业限定语**的独立禁止，而 QSH 确实是"另一个项目"。
- 另有两个加重因素：§2 授予的权利是**可撤销（revocable）**的；EULA §8 允许著作权人**单方面更新条款**。

**⇒ 因此本项目的实际立场是：风险不高且大概率不会被追究，但"无需申请"是过于自信的说法。**
正确处理是：**在公开发布/公开宣布之前，向 SnowLumaDevs 发一封简短邮件说明用途并询问是否需要额外条件**，
把回复（或未回复的事实）记录在 `docs/design/decisions/` 里。成本是一封邮件；对价是这条许可里唯一
可能让项目被迫改名或下架的条款。

**此外，有一条 EULA 条款是本项目**必须**遵守的硬边界（比 §4(b) 更容易踩到）**：

> EULA §5.4（中文为准）：「除事先取得著作权人的书面授权外，您仅可为 `LICENSE` 允许的非商业用途，
> 以专有组件随本软件提供的形式运行该组件；不得复制、修改、单独再分发或再许可该组件。
> **将其并入第三方安装包或 Docker 镜像、通过自动化脚本部署**，或者将其用于任何商业用途，均须事先取得书面授权。」

⇒ **本项目永不安装、复制、打包、下载或自动部署 SnowLuma 及其原生组件，也不会自动启动它。**
（设计不变量 L6。历史上 `src/mcp-host-server.js` 的 `start_snowluma`/`stop_snowluma` 让 AI 能启停它，已于 v0.2.0 删除。）

v0.4.0 起的唯一例外（经项目维护者确认的规则变更）：本机「控制中心」网页（`src/launcher/`）上的
「启动 SnowLuma / 停止 SnowLuma」按钮 —— **只在用户亲手点击时**，按发行包原样运行用户**自己下载解压**的
SnowLuma 目录里的 `launcher.bat`，相当于一个快捷方式：
- 控制中心启动时不启动 SnowLuma，SnowLuma 退出后也不自动拉起；
- 桥接、MCP 工具、AI 都没有任何启停 SnowLuma 的途径（由 `scripts/test-control-center.mjs` 的 L6 断言钉住）；
- 「更新」只检查版本、打开官方下载页，并在用户自己下载解压新版本后迁移用户数据（`config/`、`data/`）；
  **不下载、不解压、不替换** SnowLuma 的任何程序文件或专有组件；
- SnowLuma 不放进本仓库，也不进 Release 包。

**⚠️ 下面这些会让 §4(a) 直接生效（"变现即触发"，与代码是否开源无关），请不要做**：

- 提供**付费**的托管 / 部署 / 代搭 / 代运营服务（哪怕只收成本价）；
- 把它并入任何**付费**产品或服务；
- 以**收费**方式运行它对外提供服务；
- 把赞助/捐赠与"可获得服务"绑定。

> 免费开源 + 不卖服务 + 不代装 = 安全。这也是云部署定位为「**单租户自托管，不是 SaaS**」的原因——
> 那条限制本身就是一道保护你的护栏。
>
> 如果你将来打算做上述任一形态，**必须**先向 SnowLumaDevs 取得书面授权
> （联系方式见其 LICENSE：`motricseven@foxmail.com`）。

**结论**：本项目的 MIT 许可只覆盖本项目自己的代码，**不对 SnowLuma 授予任何权利，也不替使用者承担其许可义务**。
使用者需自行取得 SnowLuma 并遵守其许可。
