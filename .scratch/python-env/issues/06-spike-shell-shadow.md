# 06 — Spike：shell 环境与名字解析能否被塑造

Status: ready-for-agent
Type: research
Blocked by: 01

## What

回答两个只能靠实验回答的问题，结论写回本 ticket 的 `## Answer`：

- **S1 影射可行性**：插件能否让 `ctx.shell` 派生的子进程里 `python`/`python3`/`py` 解析到指定解释器？
  候选手段：包装 `ctx.shell`（`dsh-bash-sandbox` 先例）、注入 PATH、shim 目录。Windows 上 `.bat` shim 的
  引号、退出码透传、Ctrl-C、stdio 行为要各验一次。
- **S2 激活环境继承**：`VIRTUAL_ENV` / `CONDA_PREFIX` 会不会进入 DSH 的 shell 会话。

判据：给出可复现的最小实验，而不是读代码推测。若 S1 不可行，明确写出降级方案（工具 + 指令是否够）。

## Acceptance

- 每个问题都有"能/不能 + 证据（命令与输出）"。
- 若可行，给出一条实现路径与已知坑清单；若不可行，更新 spec 的里程碑并说明替代方案。
