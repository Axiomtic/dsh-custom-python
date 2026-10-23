# 03 — `python` 工具

Status: ready-for-agent
Type: task
Blocked by: 02

## What

注册 `python` 工具（schema 见 spec §2），接解析器执行。

- `run`：`spawn(interpreter, [script|'-c', code], {env, cwd})`，捕获 stdout/stderr/exit_code，返回结构化对象。
- `status` / `list` / `use` / `reset`：`use`/`reset` 只改会话内状态（L1）。
- `bundled: true` 强制内置 runtime。
- 工具描述携带一行当前解释器摘要（静态文本，切换后重注册或保持稳定，见 ADR-0003）。
- 输出上限：按行/字节截断，保留尾部；截断要显式标记。

## Acceptance

- 内联代码、脚本、带参数脚本三条路径都返回正确 exit_code 与输出。
- `status` 返回命中层级（如 `L2 工作区选择`）。
- `use` 后同一会话内后续 `run` 生效；`reset` 后回到优先级链。
- `bundled: true` 时解释器为内置 3.12，13 个包可导入。
- 工具 schema 序列化后 ≤ 200 token。

## Progress

已实现并在真实 harness 里验证：`run`、`status`、`list`、`use`、`reset`。

- 参数直接以 JSON Schema 传给 `ctx.tools.register`，不需要导入 `defineTool`；
  注册成功（模型侧 schema 已生效），输出若含 `undefined` 会被注册表拒绝，已在返回前剔除。
- cwd 与 session 通过 `ctx.agents.currentInitiator()` + `ctx.workingDirectory.get()` 取得。
- `use` 先 probe 目标：坏路径直接拒绝且不改状态；`reset` 回到优先级链。
- 实测：L7 内置 3.12.14 跑通；`use` 到 miniconda 后变 L1 3.13.2；`reset` 复原。

**待补**：工具描述里的静态"一行环境摘要"未做（注册时没有 cwd），随 ticket 08 处理。
