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

## Progress

已实现（`lib/shadow.js`），代价与取舍记在 ADR-0005。实测链路：

```
use miniconda  → 新 shell 里 `python -c "import sys;print(sys.executable)"` = C:\Users\zhenx\miniconda3\python.exe
reset          → 同一命令回到 "Python was not found"（商店占位符），证明 PATH 已复原
```

**踩到的坑**：影射写进 PATH 的目录会被下一轮解析当成 L6 的真实候选，导致 `reset` 永远回不到内置。
修法是 `createShadow().basePath` 提供构造时的快照，解析器扫 PATH 只用快照。
单测覆盖：前置、去重、替换、复原。

**未做**：`py` 名字（需要额外 shim 可执行文件）；按会话隔离的影子（进程级本质决定）。

## Superseded（ADR-0006）

后续讨论的结论是：agent 一旦开始敲 shell，就已经做了一次显式选择，插件再去改 PATH 属于越界；
而影射的进程级语义和"按会话"天然冲突。因此**移除了 PATH 影射**，本 ticket 关闭。
`lib/shadow.js` 与对应单测已删除，配置项 `shadow` 一并移除。
