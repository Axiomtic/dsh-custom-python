# dsh-custom-python

DSH 插件：让 harness 里的 Python 调用默认落到**你指定的解释器**，而不是内置那个依赖写死的一小撮 runtime。
目标是消除"缺包 → 换库硬凑 → 反复试错"的 token 浪费，同时不改变 office 工具链的既有行为。

> 状态：v1 开发中（解析器 + `python` 工具）。设计见 [`spec`](.scratch/python-env/spec.md)，
> 术语见 [`GLOSSARY.md`](GLOSSARY.md)，决策见 [`docs/adr/`](docs/adr/)。

## 它解决什么

模型跑 Python 时会撞上三个循环：裸命令 `python` 命中商店占位符、拿到内置路径却 `ModuleNotFoundError`、
报错后改用等价实现硬凑。三者的共同点是——模型没有任何零成本的正确动作。

本插件提供三件事：

1. **一个 `python` 工具**：一次调用拿到结构化 stdout/stderr/退出码，缺包时附一条可直接执行的修复命令。
2. **名字影射**：模型仍然顺口敲 `python` 时，解析到你选的环境（绝对路径调用不受影响）。
3. **界面徽标**：聊天输入框旁显示当前解释器，可当场切换。

## 安装

```bash
# 暂未发布到 npm，先从本地目录安装
```

## 配置

```yaml
- id: custom-python
  config:
    defaultInterpreter: C:\Users\you\miniconda3\python.exe
    shadow: true
    autoInstall: false
```

工作区选择（随 git 走）：

```json
{ "interpreter": "C:\\Users\\you\\.venv\\Scripts\\python.exe" }
```

## 已知边界

- 不接管 MCP server 的解释器。
- office 工具链继续使用内置 runtime（那 13 个包是它的契约）。
- 影射是**进程级**的：裸命令 `python` 跟随最近一次解析结果，不按会话隔离；`python` 工具本身按会话。
- `py` 不在影射范围（它是 Windows launcher，不在解释器目录里）。
- `VIRTUAL_ENV` / `CONDA_PREFIX` 不会从你的终端继承进来（Host 进程启动时就定型了），因此 L4 实际很少命中。

## 开发

```bash
node --test tests/
```

## License

MIT
