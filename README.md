# dsh-custom-python

[![test](https://github.com/Axiomtic/dsh-custom-python/actions/workflows/ci.yml/badge.svg)](https://github.com/Axiomtic/dsh-custom-python/actions/workflows/ci.yml)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

> Give DeepSeek Harness the Python you actually installed — conda, venv, or the system one — instead of the small bundled runtime.

DeepSeek Harness (DSH) 插件。它只做一件事：让 harness 里的 Python 调用落到**你指定的解释器**上。
选完即生效，没有 PATH 影射，不会偷偷改变 shell 里 `python` 的含义。

## 它解决什么

模型在 DSH 里跑 Python 会撞上三个循环：

1. 裸命令 `python` 命中 Microsoft Store 的占位符，什么也跑不起来；
2. 换成内置路径，撞上 `ModuleNotFoundError` —— 那 13 个包是给 office 工具链写死的契约；
3. 报错之后改用等价实现硬凑（`scipy` 换成手写连通域，`pandas` 换成手写循环），既慢又容易错。

三者的共同点是：**模型没有任何零成本的正确动作**。它只能试错，而每次试错都是一轮 token。

本插件补上那个动作：一个 `python` 工具 + 一个默认解释器。一次调用拿到结构化结果；
缺包时直接给出**一条能原样粘贴的修复命令**，而不是一段 traceback 让模型去猜。

```
Error: missing module 'scipy'
interpreter: C:\Users\you\miniconda3\envs\Django\python.exe (3.12.11)
fix: C:\Users\you\miniconda3\envs\Django\python.exe -m pip install scipy
```

三行，没有栈。模型下一步是确定的：装，或者换。

## 安装

尚未发布到 npm。把仓库放进 DSH 的 profile：

```bash
git clone https://github.com/Axiomtic/dsh-custom-python.git
```

在 profile 的 `package.json`（`$DSH_HOME/profiles/<name>/package.json`）里加一条依赖和一个 bundle：

```json
{
  "dependencies": {
    "dsh-custom-python": "link:C:/path/to/dsh-custom-python"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-custom-python"]
    }
  }
}
```

重启 DSH。第一次打开输入框时会弹一次选择框，选一个解释器即可。

> 用 `link:` 安装时，改完 `index.js` / `lib/*` 需要让插件重新加载：
> `plugin_manager set_plugin include:custom-python` 先 `false` 再 `true`。

## 用法

### 设置页：全局默认

设置 → **自定义 Python 环境** → **默认 Python**，只有一个下拉框。

- 选一个解释器 → 之后所有会话都用它；
- 选 **关闭自定义 Python** → `python` 工具从模型眼里消失，行为等同于插件没装。

显示的是 `conda · Django 3.12.11` 这种**环境和版本**，不是绝对路径。路径在选项的副标题里。

### 输入框旁的徽标：会话级

输入框左下角有一个 `py Django 3.12.11` 徽标，点开向上弹出同一份候选列表，改的是**当前会话**。
第一项是 `跟随全局默认（…）`，选它即清除覆盖。

两个会话互不影响：A 选 conda、B 不选，B 走全局默认。

### `python` 工具

| action | 作用 |
| --- | --- |
| `run`（默认） | 执行 `code` 或 `script`，返回 `exit_code` / `stdout` / `stderr` |
| `status` | 现在用的哪个解释器、命中哪一层 |
| `list` | 所有候选，按层分组，带版本 |

参数：`code`、`script`、`args`、`bundled`（`true` 强制用内置 office runtime）。

```
> python(action="status")
C:\Users\you\miniconda3\envs\Django\python.exe (3.12.11) - L1 显式指定
```

## 优先级链

从上往下第一个**能用**的赢。同一层里有多个可用的解释器时报歧义，让你在设置里选，
不会替你猜（见 [ADR-0004](docs/adr/0004-precedence-by-layer.md)）。

| 层 | 来源 | 什么时候命中 |
| --- | --- | --- |
| L1 | 你选的那一个 | 会话徽标优先，否则设置页的全局默认 |
| L2 | 工作区的 `.dsh/python.json` | 随仓库走，团队共享同一个解释器 |
| L3 | Loader 行的 `config.defaultInterpreter` | 设置页从没选过时的兜底 |
| L4 | `VIRTUAL_ENV` / `CONDA_PREFIX` | 仅当 Host 进程带着这两个变量启动 |
| L5 | 工作区的 `./.venv` | 仓库自带虚拟环境 |
| L6 | PATH | 系统装的那个 |
| L7 | 内置 runtime | 终极兜底 |

工作区选择写在 `.dsh/python.json`，二选一：

```json
{ "interpreter": "C:\\Users\\you\\miniconda3\\envs\\Django\\python.exe" }
```

```json
{ "conda": "Django" }
```

## 实测

同一张图片、同一条提示词、同一个模型，三种执行方式各跑一次：

| | 执行方式 | token | 结果 |
| --- | --- | ---: | --- |
| A | pwsh 里直接写 Python（内置 runtime） | 7.2M | 有一处标点错分 |
| B | `python` 工具 + conda 环境 | 5.9M | 未发现语义错分 |
| C | `python` 工具 + 内置 runtime | 4.1M | 漏掉少量小笔画 |

B 比 A 少 18.1%，C 比 A 少 43.1%。

需要说清楚的是：**每种情境只跑了一次**，交付范围（B、C 多建了透明底）和算法选择都不同，
所以这组数字说明"值得继续验证"，不能当作隔离了变量的因果结论。它没有证明插件省下的
token 具体来自哪里 —— 合理的猜测是省掉了 shell 转义、临时文件落地和跨工具调度的开销。

## 已知边界

- **不影射 PATH**。shell 里 `python` 是什么就是什么（见 [ADR-0006](docs/adr/0006-no-path-shadow.md)）。
  模型如果执意在 shell 里跑，插件不拦、也不改。
- 不接管 MCP server 的解释器。
- office 工具链继续用内置 runtime —— 那 13 个包是它的契约，插件不碰。
- `VIRTUAL_ENV` / `CONDA_PREFIX` 不会从你的终端继承进来（Host 进程启动时就定型了），
  所以 L4 实际很少命中。
- `.python-version` 还没接（[ticket 04](.scratch/python-env/issues/04-workspace-selection.md)），
  `.dsh/python.json` 里的路径请写绝对路径。
- 每次 `run` 都是新进程，进程内的状态不跨调用保留。

## 设计

- [GLOSSARY.md](GLOSSARY.md) —— 术语表（解释器、解析器、优先级链、绕路……）
- [docs/adr/](docs/adr/) —— 六个决策记录：不拦截只塑形、失败要说清、常驻上下文不要、
  分层优先级、PATH 影射（已废弃）、不影射 PATH
- [.scratch/python-env/spec.md](.scratch/python-env/spec.md) —— 规格与工单

## 开发

没有构建步骤、没有运行时依赖，源码就是发布物。

```bash
node --test     # 34 个单测，不需要 npm install
```

- 不要 import `@deepseek-ai/*`：profile 里解析不到。工具定义直接传 JSON Schema，
  配置在 `lib/config.js` 里自己校验。
- 目录：`index.js` 装 host 那一半，`client.js` 装 UI，`lib/` 是解析器和工具实现。

## License

MIT
