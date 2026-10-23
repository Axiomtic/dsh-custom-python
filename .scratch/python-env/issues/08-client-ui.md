# 08 — 界面：徽标 + 设置页

Status: ready-for-agent
Type: task
Blocked by: 03

## What

客户端插件两处：

- **徽标**：注册到 `conversation.input.left`，显示 `py: <环境名> <版本>`；无候选显示"内置"并带警示色。
  点击弹层：候选列表（编号、来源层、路径、版本、可用性）+「固定到此工作区」（写 `.dsh/python.json`）。
  选中即本会话切换。
- **设置页**：注册到 `settings.section`，展示候选全集、`shadow` 开关、`autoInstall` 开关、清除会话选择。

状态经 Host 侧服务读取（`status`/`list`），切换走与 `python(action="use")` 同一条应用操作，避免两套语义。

## Acceptance

- spec 验收 7：徽标显示的路径与 `python(action="status")` 一致。
- 切换后徽标即时更新，`run` 结果使用新解释器。
- 无候选时徽标不显示假路径。
- 断开/无会话状态下不报错、不渲染空白块。

## Progress

已实现（`client.js` + `lib/server.js` + `lib/store.js`）：

- 三处客户端 UI：`conversation.input.left` 徽标、`settings.section` 设置页、`shell.overlay` 首次运行提示。
- Host 侧四条路由：`/custom-python/{state,use,default,skip}`，纯 JSON，不依赖 typert 生成。
- 全局默认存在 `$DSH_HOME/custom-python/settings.json`，**文件优先于 Loader 行配置**；
  首次运行标记是 `$DSH_HOME/custom-python/onboarded`。
- 路由 disposer 已收集并在卸载时释放。

**已知问题（开发循环，不是设计缺陷）**：第一版没有收集路由 disposer，导致热重载后旧 handler 仍抢答
（`state` 返回旧配置，而工具已经是新配置）。修复已落地，但**当前进程里那条残留路由需要重启 DSH 才会消失**；
干净安装不会遇到。

**未做**：徽标里的会话 id 由 `snapshot` 回传（`state.session`），目前 UI 切换写的是 `process` 键，
工具侧按"字面 id 优先、`process` 兜底"读取（`lib/session.js`）。真按会话隔离要等拿到 slot 的 session prop。
