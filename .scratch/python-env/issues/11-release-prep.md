# 11 — 开源发布物

Status: ready-for-agent
Type: task
Blocked by: 07, 08, 09

## What

让仓库达到可公开发布的状态：

- README：解决什么问题（含三个坏循环的实测描述）、安装、配置示例（`cordis.patch.yml` 片段、
  `.dsh/python.json` 格式）、界面截图、已知限制（MCP 不管、L3 未验证）、与 office 工具链的边界。
- LICENSE：MIT。
- CI：typecheck + 单测 + 构建；Windows 与 Linux 双 runner（Linux 只跑纯逻辑测试）。
- 包元数据：`name`、`version`、`description`、`repository`、`engines`、`files`。
- 发布检查清单：不含硬编码本机路径、不含 profile 私有配置。

## Acceptance

- 干净 clone 上 `pnpm install && pnpm test` 通过。
- README 里的每条命令都能照抄成功。
- 无绝对路径泄漏（grep `C:\Users` 与 `/Users/` 为空）。
