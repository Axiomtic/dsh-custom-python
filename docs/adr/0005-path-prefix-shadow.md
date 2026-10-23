# 影射用进程级 PATH 前缀，而不是替换 shell provider

Status: superseded by ADR-0006


Spike（ticket 06）确认了两条硬约束：`ctx.shell` 不能被包装（Cordis 的 `Service` 构造即 `provide`，
重复注册直接抛 `service "shell" has been registered`），而 `subprocess-local` 在**每次 spawn 时**
实时读取 Host 的 `process.env.PATH`（`scrubbedParentEnv()` 无缓存，只剥离 `*TOKEN*`/`*SECRET*` 与 `DSH_*`）。

决定：在 `apply()` 里维护一个 `process.env.PATH` 前缀——前缀是当前解析结果的目录，随解析更新，
unload 时恢复构造时的快照。解析器扫 PATH 时改用快照 `basePath`，否则自己写进去的前缀会被下一轮当成
真实的 PATH 候选，形成自反馈（实测过：`reset` 永远回不到内置）。

## Considered Options

- **替换 executor 行**：patch 里 `disabled: true` 掉 `pwsh-sandbox`，insert 一个继承 `SandboxPwshExecutor`
  并覆写 `spawnSpec()` 的类。语义最干净（per-spawn env），但要继承 dsh 内部类、绑定其 Config 形状与
  继承链，上游一改就碎；且它不是本插件要交付的领域，是别人的行。
- **pwsh profile / bash rc**：pwsh 固定 `-NoProfile`，bash 走 `bash -c` 不读 rc，不可行。
- **`ctx.shellEnv`**：只接受 `DSH_` 前缀键，注不了 PATH。

## Consequences

- 影射是**进程级、全局**的：它跟随"最近一次解析结果"，不随会话独立。多会话同时用不同解释器时，
  裸命令只会命中最近那个；`python` 工具本身仍是按会话的。
- 用到了非官方 API（直接改 `process.env.PATH`）。代码路径确实实时，但属于约定而非契约；
  升级时要重新验一次 `subprocess-local` 是否仍无缓存读取。
- 只影响**名字解析**：绝对路径调用（office 工具链）不受影响，这是保留这条捷径的前提。
- 解析结果为内置 runtime 时主动清空前缀，避免"内置也在 PATH 上"造成的误判。
