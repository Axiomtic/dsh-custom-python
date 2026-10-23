# Changelog

## 0.1.0 — 2026-10-23

第一个可用版本。

### 有

- **`python` 工具**：`run` 执行代码或脚本，`status` 报告当前解释器和命中的层，`list` 列出全部候选。
- **七层解析器**：显式指定 → 工作区 `.dsh/python.json` → Loader 默认 → 已激活环境 → `./.venv` → PATH → 内置 runtime。
  同一层多个可用候选时报歧义，不猜。
- **缺包诊断**：`ModuleNotFoundError` 收敛成三行 —— 缺什么、用的哪个解释器、装什么命令。
- **一个下拉框**：设置页改全局默认，输入框旁的徽标改当前会话，选完即生效。
- **关闭开关**：`关闭自定义 Python` 直接撤掉工具注册，效果等同于没装这个插件。

### 没有

- **PATH 影射**：早期版本会改写 PATH 让裸 `python` 指向选中项。已废弃，见
  [ADR-0006](docs/adr/0006-no-path-shadow.md)。shell 归用户，插件只塑形 tool 这一条通道。
- 自动安装依赖（默认关闭，见 [ticket 10](.scratch/python-env/issues/10-auto-install.md)）。
- `.python-version` 支持（见 [ticket 04](.scratch/python-env/issues/04-workspace-selection.md)）。

### 已知问题

- L4（`VIRTUAL_ENV` / `CONDA_PREFIX`）在 GUI 里几乎不会命中：Host 进程不继承终端的激活变量。
