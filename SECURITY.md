# 安全

## 报告漏洞

**不要开公开 Issue。** 通过下面任一方式私下联系仓库所有者：

- GitHub 个人资料页上的公开邮箱；
- 仓库所有者账号 `h-D-ACE` 的私信（如已开启）。

请尽量包含：版本号、复现步骤、影响（能读到什么 / 能改什么）、日志片段（打码 QQ 号与路径）。

## 已知的信任边界

- 控制中心与桥接 API 只监听 `127.0.0.1`，不要暴露到公网；要远程用请走 SSH 隧道或带认证的反向代理。
- QQ 登录依赖 NapCat（第三方协议端），账号风控风险由使用者承担。
- 权限分级 L0～L3 与审批流程见 [`RULES.md`](RULES.md)、[`docs/guides/ADMIN_CHANNEL.md`](docs/guides/ADMIN_CHANNEL.md)、[`docs/guides/SECURITY_BASELINE.md`](docs/guides/SECURITY_BASELINE.md)。
- `config.json`、`state/` 含令牌与聊天数据，切勿提交或分享。
