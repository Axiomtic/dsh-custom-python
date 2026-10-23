# 用"塑造"而非"接管"：新增 python 工具为主，路径影射为辅，内置 runtime 原样保留

DSH 没有可插拔的解释器解析层——内置 python 的路径只是被 `load_workspace_dependencies` 当作字符串返回，
由模型自己拼成 shell 命令交给通用 shell 执行。因此"接管内置 python"在实现上不存在落点；
真正的杠杆是塑造模型拿到什么路径、以及 `python` 这个名字解析到谁。

决定：
- **新增一个 `python` 工具**作为执行 Python 的唯一推荐入口，返回结构化结果（stdout/stderr/退出码/解释器/缺失模块）；
- **把 `python`、`python3`、`py` 的名字解析影射到用户环境**，作为模型仍然直接敲 shell 时的安全网；
- **不 shadow `load_workspace_dependencies`，不改 primary runtime 的 `source`**，office 工具链继续独享内置 runtime。

## Considered Options

- **Shadow `load_workspace_dependencies`**：改动最小，但会把 office skills 从它们被验证过的那 13 个包上拽下来，
  等于用插件给上游埋 bug。
- **替换 primary runtime 的 `source`**：会连 node、pnpm、office assets 一起换掉，且需要伪造完整 `runtime.json`
  并通过 stat 校验，成本远大于收益。
- **只做路径影射**：零 token 成本，但模型不知道自己用的是哪个环境，`pip list` 与它以为的不一致；且影射失效时无降级路径。
- **只做指令**：模型对 prose 的遵守有损耗，无法作为契约。
