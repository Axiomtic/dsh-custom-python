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

## Revision（用户反馈后重做）

第一版是"每行两个按钮 + 点开弹层"，用户反馈：徽标点不开、默认改不了、路径不直观、交互太碎。

重做后只剩**一个下拉框**，出现在三个位置（设置页 / 徽标弹层 / 首次运行提示）：

- 选项 = 关闭自定义 Python（使用内置） + 全部可用解释器，标签形如 conda · Django 3.12.11；
- **选中即生效**，没有"应用"按钮，也没有"本会话使用"这类第二动作；
- 关闭 的真实语义：撤销 `python` 工具注册 + 清除 PATH 影射，等同插件不存在（实测 `unknown tool "python"`）；
- 默认值以"显式指定"进入 L1，压得过工作区文件 —— 用户选了就必须生效。

技术细节：徽标弹层走 `createPortal` 到 `body`（输入框行会裁剪溢出，这是第一版点不开的真因）；
locale/slot 注册都带 disposer 并容忍重复（热重载曾抛 `namespace already has locale "en"`）。
## Revision 2（交互形态第二轮）

用户反馈：下拉不该是"按钮 → 弹出面板"，应该像 DSH 自己的权限/模型选择那样，
点了直接贴着控件出选项；而且样式要和内置 UI 一致。

改法：

- 组件换成 **trigger + 贴着控件的菜单**（portal 定位，测量触发器的 rect）；
- 在输入框里空间不足时**向上展开**（上拉），在设置页空间足够时向下展开；
- 颜色全部走主题 token：`--dsw-alias-bg-overlay` / `--dsw-alias-border-l1` /
  `--dsw-alias-label-primary` / `--dsw-alias-bg-layer-1` / `--dsw-alias-brand-primary`，
  圆角、内边距、悬停态对齐内置选择器；
- 选中项用品牌色 + 勾；点击外部、Esc、滚动、窗口缩放都会关闭。