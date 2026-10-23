# 09 — 切换通知模型

Status: ready-for-agent
Type: task
Blocked by: 03, 08

## What

UI 或工具发生切换时，注入**一行** system note：解释器绝对路径 + 版本 + 生效范围（本会话/工作区）。

配套：`run` 的返回值永远带 `interpreter` 字段，作为模型未读那行时的兜底。

约束：同一切换只注入一次；连续切换不重复累积；内容不含解释性文字。

## Acceptance

- UI 切换后，下一轮模型上下文里恰好出现一行，且不重复。
- 工具返回值始终包含 `interpreter` 与 `version`。
- 切换为工作区固定时，通知文案体现"已固定到此工作区"。
