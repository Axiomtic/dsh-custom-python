# dsh-custom-python

DeepSeek Harness (DSH) 插件：让 harness 里的 Python 调用优先使用**用户指定的解释器**，
而不是内置那个依赖写死的 runtime，从而减少模型因"内置缺包"而绕路换库、重复试错造成的 token 浪费。

状态：设计阶段，尚无实现代码。设计与决策记录见 `docs/adr/`，术语见 `GLOSSARY.md`。

## Agent skills

### Issue tracker

Issues 与 specs 以 markdown 文件存放在 `.scratch/<feature>/`，无外部依赖、随 git 走。见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用五个 canonical labels：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

single-context：根目录一个 `GLOSSARY.md`，决策记录在 `docs/adr/`。见 `docs/agents/domain.md`。
