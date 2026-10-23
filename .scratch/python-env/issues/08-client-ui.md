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
