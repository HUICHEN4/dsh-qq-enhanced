# 发布帖（v1.1.3，可直接复制）

三个长度，按发的地方挑一个用。数字、链接都可直接用。

---

## A. 长版（V2EX / 论坛 / 贴吧 / 长文动态）

**标题：把 QQ 接进 DSH：会挑着接话、会潜水、会发表情的 AI 群友（开源）**

DSH 里跑着 agent，但消息只能从聊天窗口进。这个项目把它接进 QQ——好友和群里的消息会变成 agent 的用户输入，它的回复、提问、工具审批再发回 QQ。

重点不是「能回消息」，而是**像群里一个人**：

- **会挑着接话**：不是每条都回。看语境、看关系、看这会儿热不热闹，自己决定接不接；冷场会潜水，被 @ 或点名问一定会应。
- **有活人节奏**：分几条发、会等对方补话、会发表情、会引用你上一句。
- **有记忆和人格**：自己的角色卡、对群友的印象、正在聊的话题，换会话也能交接。
- **能当助手**：私聊里可以整理文件、查资料、定时提醒。

**装法**：别自己敲命令。把下面这句丢给 DSH：

> 克隆 https://github.com/HUICHEN4/dsh-qq-enhanced 到本地，按 README 把依赖装好，复制 config.example.json 为 config.json 并引导我填群号和 QQ 账号，然后启动控制中心。

缺 Node、缺 NapCat 它会直接问你要。装完在控制台扫码登录一个 QQ 小号就能用。

**要准备**：一个 QQ 小号、一台长期开着的电脑（Windows 最稳）、DSH 桌面版。跑起来会花 token 钱，花多少取决于群有多活跃、你让它走几步。

**已知限制**：登录依赖 NapCat，属于第三方协议端，稳定性和风控不在本仓库控制范围；只在 Windows 上长期跑过，macOS / Linux 有 CI 但没有长时间验证。

- 仓库：https://github.com/HUICHEN4/dsh-qq-enhanced
- 装不上 / 连不上 / 不唤醒：https://github.com/HUICHEN4/dsh-qq-enhanced/discussions/1
- Bug：https://github.com/HUICHEN4/dsh-qq-enhanced/issues

---

## B. 短版（B 站动态 / 微博 / 群公告）

做了个把 QQ 接进 DSH 的桥接，开源了。

它不太像机器人：不是每条消息都回，会自己判断要不要接话，冷场会潜水，被 @ 一定应；分几条发、会等对方补话、会发表情；有人格卡和对群友的印象，换会话能交接。

装法很简单——把仓库丢给 DSH，让它自己装：

https://github.com/HUICHEN4/dsh-qq-enhanced

需要：QQ 小号 + 一台常开的电脑（Windows 最稳）+ DSH 桌面版。跑起来会花 token 钱。
装不上或者群里不说话的，先看这里：https://github.com/HUICHEN4/dsh-qq-enhanced/discussions/1

---

## C. 一句话（群聊 / 回复里随手贴）

QQ 接 DSH 的开源桥接，会挑着接话、会潜水、会发表情，装法是把仓库丢给 DSH 自己装：https://github.com/HUICHEN4/dsh-qq-enhanced

---

## 发之前检查

- [ ] 仓库地址是 `HUICHEN4/dsh-qq-enhanced`，不是旧的 `h-D-ACE/dsh-qq`
- [ ] Release 页有 v1.1.3 的 zip 附件
- [ ] 没写死「一天花多少钱」「命中率多少」这类会过期的数字
- [ ] 截图里没有 QQ 号和群友昵称
