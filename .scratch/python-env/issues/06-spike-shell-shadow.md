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

## Answer

**S1 能，但只能换 provider 或改进程级 PATH。**
`ctx.shell` 不可包装：Cordis `Service` 构造即 `ctx.reflect.provide()`，重复注册抛
`service "shell" has been registered`。`bash-local` / `pwsh-local` 的 `spawnSpec()` 只传
NO_COLOR/TERM/PAGER/GIT_PAGER，**PATH 原样继承不重建**；Config 无 env 字段；`ctx.shellEnv` 只收 `DSH_` 键。
两条可行路径：(a) patch 里禁用 `pwsh-sandbox`（Win）/`bash-sandbox`（POSIX），insert 一个覆写
`spawnSpec()` 的子类 —— 正式但要继承内部类；(b) 插件启动时前置 `process.env.PATH` ——
`subprocess-local` 每次 spawn 实时读 `process.env`，实测有效。

**S2 不继承用户终端的激活状态。** `VIRTUAL_ENV` / `CONDA_PREFIX` 来自 Host 进程 env，
桌面端从启动器继承，用户在自己终端里 `conda activate` 不会传进来。`.env` 也不可行：
`dsh-app-boot` 的 BOOTSTRAP 名单（含 `PYTHONHOME`/`PYTHONPATH`，49 个精确名 + `DSH_`/`XDG_` 等前缀）
会让整层 `.env` 直接抛错，且项目层指的是 Host 进程 cwd 而不是会话 workspace。
结论：L4 实际几乎恒为空，链本身不退化。

**选定方案**：见 ADR-0005 —— 进程级 PATH 前缀（MVP），executor 替换留作后备。
