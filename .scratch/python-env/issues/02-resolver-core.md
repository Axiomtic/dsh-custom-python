# 02 — 解析器核心（纯函数）

Status: ready-for-agent
Type: task
Blocked by: 01

## What

实现 `resolveInterpreter(input) -> Resolution`，六个层级见 spec §1 与 ADR-0004。

- 候选发现：会话状态、`.dsh/python.json`、`VIRTUAL_ENV`/`CONDA_PREFIX`、`./.venv`、PATH、内置 runtime。
- 层内 `realpath` 去重；层内 > 1 返回 `ambiguous` + 编号列表；零候选返回内置。
- 采用前验证 `<exe> -c "import sys"`，5s 超时；失败剔除。
- 验证结果按 `(realpath, mtime)` 缓存 30s。
- 平台差异（`Scripts/python.exe` vs `bin/python`）隔离在一个模块内。

纯函数，不做 I/O 之外的事；不注册工具。

## Acceptance

- spec 验收 1、2、3 在单测层面通过（fixture 目录 + 假 PATH）。
- 坏解释器（占位符/不存在/不可执行）被剔除且不抛异常。
- 单测覆盖：每层命中、层内歧义、去重、零候选、缓存命中。

## Progress

已实现 `lib/resolver.js`、`lib/io.js`、`lib/platform.js`；单测 18 例。

**对 spec 的修正**：链是**七层**——新增 `L3 profile 默认`（`config.defaultInterpreter`），
因为 Q3 定的优先级里 profile 默认夹在工作区与自动探测之间。ADR-0004 与 spec 已同步。

补充：`Resolver#check(path)` 校验手工指定的解释器，供 `python(action="use")` 用。
