# dsh-custom-python

DeepSeek Harness (DSH) 插件：让 harness 里的 Python 调用优先使用**用户指定的解释器**，
而不是内置那个依赖写死的 runtime，从而减少模型因"内置缺包"而绕路换库、重复试错造成的 token 浪费。

状态：v1 可用（解析器 + `python` 工具 + 缺包诊断 + PATH 影射），已装进 `desktop` profile。
设计与决策记录见 `docs/adr/`，术语见 `GLOSSARY.md`。

## Agent skills

### Issue tracker

Issues 与 specs 以 markdown 文件存放在 `.scratch/<feature>/`，无外部依赖、随 git 走。见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用五个 canonical labels：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

single-context：根目录一个 `GLOSSARY.md`，决策记录在 `docs/adr/`。见 `docs/agents/domain.md`。

## 开发

- 单测：`node --test "tests/*.test.js"`。没有构建步骤、没有运行时依赖，源码就是发布物。
- **不要引入 `@deepseek-ai/*` 导入**：profile 里解析不到这些包。工具定义直接传 JSON Schema 给
  `ctx.tools.register`，配置在 `lib/config.js` 里自己校验。
- 插件在 profile 里是 linked 目录：改完 `index.js` / `lib/*` 后必须
  `plugin_manager set_plugin include:custom-python` 先 `false` 再 `true`，否则跑的还是旧模块。
- 改完用 `python(action="status")` / `(action="list")` / 一段会缺包的代码自查三件事：命中哪层、
  候选是否去重、缺包诊断是否仍是三行。
