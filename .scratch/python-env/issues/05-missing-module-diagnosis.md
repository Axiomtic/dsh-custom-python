# 05 — 缺包诊断

Status: ready-for-agent
Type: task
Blocked by: 03

## What

把失败从"裸 traceback"变成三行以内的可执行诊断：

- 从 stderr 提取 `ModuleNotFoundError: No module named '<x>'`（含 `ImportError` 变体）。
- `missing_modules: ["x"]` + `fix: "<绝对路径> -m pip install <包名>"`。
- import 名到包名映射表：`yaml`→`pyyaml`、`PIL`→`pillow`、`cv2`→`opencv-python`、`sklearn`→`scikit-learn`、
  `bs4`→`beautifulsoup4`、`dateutil`→`python-dateutil`、`dotenv`→`python-dotenv`、`jwt`→`pyjwt`。
- 认不出的名字：直接 `pip install <name>`，不猜、不加解释性文字。
- 非缺包失败（语法错误、业务异常）不改造，原样返回。

## Acceptance

- spec 验收 4 通过：缺 `yaml` 时给 `pyyaml` 建议而非裸 traceback。
- 诊断整体 ≤ 3 行，且不含解释性废话。
- 非缺包失败不被包装。

## Progress

已随 ticket 03 落地（`lib/runner.js` + `renderText`）。实测：

```
Error: missing module 'yaml'
interpreter: ...\dependencies\python\python.exe (3.12.14)
fix: "...\dependencies\python\python.exe" -m pip install pyyaml
```

映射表含 15 条常见 import 名；未知名字原样透传不猜。
