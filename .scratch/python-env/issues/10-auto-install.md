# 10 — 自动装包开关（默认关）

Status: ready-for-agent
Type: task
Blocked by: 05

## What

`autoInstall` 开启时，`run` 遇到已知缺包 → `<interpreter> -m pip install <包>` → 重试**一次**。

- 默认关闭；开关在设置页可见。
- 只装到用户环境，绝不装进内置 runtime。
- 安装失败或超时（60s）→ 回落为正常诊断输出，不重试第二次。
- 安装动作要在返回结果里显式记录（装了哪个包、哪条命令）。

## Acceptance

- 关闭时行为与 05 完全一致。
- 开启时缺包自愈，且结果里含安装记录。
- 安装失败不产生二次安装、不吞掉原始 stderr。
