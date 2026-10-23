# 04 — 工作区选择文件

Status: ready-for-agent
Type: task
Blocked by: 02

## What

接入 L2 与 L4 的输入来源：

- `.dsh/python.json`：`{"interpreter": "<绝对路径>"}` 或 `{"conda": "<env 名>"}`，前者优先。
- `.python-version`：只读线索，仅当内容是版本号时用于筛选候选；匹配多个视为歧义。
- `./.venv`：按平台探测。
- 相对路径相对于工作区根解析；文件损坏/字段非法 → 视为不存在并记一条 debug 日志，绝不抛错。

## Acceptance

- 三种来源各自单独生效，且都能被 L1（会话切换）覆盖。
- 非法 JSON、不存在的路径、不匹配的版本号都不会让解析失败。
- 工作区文件格式写进 README（用户要照着写）。
