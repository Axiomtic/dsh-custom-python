# 01 — 插件骨架可安装

Status: ready-for-agent
Type: task
Blocked by: —

## What

建立一个能被 `plugin_manager install_bundle` 装进当前 profile 的最小 bundle：包清单、cordis patch、
Host 入口 `apply(ctx, config)`、Config schema（`defaultInterpreter`、`workspaceSelection`、`shadow`、
`autoInstall`，全部可选）、README 骨架、LICENSE（MIT）。

只做接线，不实现解析逻辑——目的是让后续每个 ticket 都能立刻在真实 harness 里验证。

## Acceptance

- `install_bundle` 返回 `application: applied` 且无 unmet 依赖警告。
- `cordis_inspect_query` 的 `Config.listConfigs` 能查到本插件的 entry 与完整 schema。
- 禁用/启用该 bundle 不影响其他插件。

## Progress

已完成：包清单、patch、Host 入口、locale（en/zh）、icon、README、LICENSE 落地；
`install_bundle` 返回 `application: applied`，`listConfigs` 能查到 `include:custom-python`。

**偏差**：没有导出 `Config`。插件目录解析不到 `@deepseek-ai/schemastery`（profile 里没有这个包，
只有 dsh 安装目录里有），所以配置改在 `apply()` 内自行校验（`lib/config.js`），
`listConfigs` 的 schema 状态是 `absent`。等 ticket 08 需要设置页表单时再决定是否补一个零依赖的 schema。
