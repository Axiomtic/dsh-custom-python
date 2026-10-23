# 优先级链按层判定，同一层内多候选才算歧义

"没有显式选择时自动挑一个"必须是可预测的，否则用户眼里就是随机。但"任何多候选都报错"会在最常见的开局
（工作区里有 `.venv`、PATH 上又有 conda）反复打断用户，而那种情况下意图其实是明确的。

决定：候选按 L1–L6 分层，**逐层向下取第一个非空层**，并对每层按 `realpath` 去重；
**只有同一层去重后仍有多个候选时才报错**，列出编号等待用户选择。零候选落到内置 runtime。

```
L1 会话内显式切换
L2 工作区选择（.dsh/python.json）
L3 profile 默认（config.defaultInterpreter）
L4 已激活环境（VIRTUAL_ENV / CONDA_PREFIX）
L5 工作区内的 .venv
L6 PATH 上第一个真实 python（剔除占位符与验证失败的）
L7 内置 runtime
```

每个候选在被采用前都要跑一次 `-c "import sys"`（带超时）：跑不通的（商店占位符、坏 venv、权限不足）直接剔除，
不会变成假候选。

## Consequences

- 报错是"选择器"而不是"失败"：错误里必须带编号列表和一次可执行的选定方式，否则用户只能去改环境变量。
- L3 依赖 shell 会话是否继承 `VIRTUAL_ENV`/`CONDA_PREFIX`，这一点尚未验证（见 spike ticket）；
  不继承时 L3 恒为空，实际生效的是 L2/L4/L5，链本身不退化。
