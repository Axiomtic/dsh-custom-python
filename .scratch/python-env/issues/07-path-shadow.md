# 07 — 影射：让 `python` 这个名字落在用户环境

Status: ready-for-agent
Type: task
Blocked by: 06, 03

## What

实现 spike 06 选定的手段，把 `python` / `python3` / `py` 三个**名字**解析到当前解析结果。

约束：

- 只影响名字解析；任何绝对路径调用必须原样透传（office 工具链因此零影响）。
- 解析结果为"歧义"或"内置"时不影射，保持系统原状。
- `shadow` 配置默认开、可关；关闭后立即回到未干预状态，不留残留文件。
- 失败必须自愈：shim 目录/中间层异常时降级为"不影射"并记日志，不能阻断正常 shell。

## Acceptance

- spec 验收 6：开启时 `python -c "import sys;print(sys.executable)"` 输出用户环境；关闭后恢复。
- 绝对路径调用行为与开启前逐字节一致。
- 禁用插件后系统状态完全复原（无残留 PATH 项、无残留文件）。
