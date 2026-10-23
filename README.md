# dsh-custom-python

DSH 插件：让 harness 里的 Python 调用默认落到**你指定的解释器**，而不是内置那个依赖写死的一小撮 runtime。
目标是消除"缺包 → 换库硬凑 → 反复试错"的 token 浪费，同时不改变 office 工具链的既有行为。

> 状态：v1 可用（解析器 + `python` 工具 + 设置页 + 会话级切换）。
> 设计见 [`spec`](.scratch/python-env/spec.md)，术语见 [`GLOSSARY.md`](GLOSSARY.md)，决策见 [`docs/adr/`](docs/adr/)。

## 它解决什么

模型跑 Python 时会撞上三个循环：裸命令 `python` 命中商店占位符、拿到内置路径却 `ModuleNotFoundError`、
报错后改用等价实现硬凑。三者的共同点是——模型没有任何零成本的正确动作。

本插件提供两件事：

1. **一个 `python` 工具**：一次调用拿到结构化 stdout/stderr/退出码，缺包时附一条可直接执行的修复命令。
2. **一个默认解释器**：设置页里一个下拉框，选完对所有会话生效；每个会话还能在输入框旁单独覆盖。

**不做的就是影射 PATH**：shell 归你，`python` 在 shell 里是什么就是什么（见 ADR-0006）。

## 安装

```bash
# 暂未发布到 npm，先从本地目录安装
```

## 配置

设置面板里只有一个下拉框：**默认 Python**。选完立即生效，没有保存按钮。

- 选某个解释器 → 所有 Python 调用都用它（`conda · Django 3.12.11` 这种显示，而不是绝对路径）；
- 选 **关闭自定义 Python** → 工具从模型眼里消失，效果与禁用插件一致。

设置存在 `$DSH_HOME/custom-python/settings.json`，优先于 Loader 行配置：

```yaml
- id: custom-python
  config:
    defaultInterpreter: C:\Users\you\miniconda3\python.exe   # 设置页未选时的兜底
    autoInstall: false
```

输入框旁的徽标改的是**当前会话**的覆盖，第一项是 `跟随全局默认（…）`，选它即清除覆盖。

工作区选择（随 git 走）：

```json
{ "interpreter": "C:\\Users\\you\\.venv\\Scripts\\python.exe" }
```

## 已知边界

- 不接管 MCP server 的解释器。
- office 工具链继续使用内置 runtime（那 13 个包是它的契约）。
- shell 里的 `python` 不受本插件影响：模型若坚持在 shell 里跑，得到的是系统本来的解析结果。
- `VIRTUAL_ENV` / `CONDA_PREFIX` 不会从你的终端继承进来（Host 进程启动时就定型了），因此 L4 实际很少命中。

## 开发

```bash
node --test "tests/*.test.js"
```

## License

MIT
