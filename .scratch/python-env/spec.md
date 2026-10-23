# Spec: Python 环境治理（python-env）

Status: ready-for-agent
Tracker: 本地 markdown（`.scratch/python-env/`）

## 问题

DSH 内置 python（3.12.14，13 个固定包）本来是 office 工具链的契约环境，但模型把它当成通用解释器用。
缺包时 harness 零拦截、traceback 原样进上下文，模型随即改用等价实现绕路。另有一个独立循环：
模型顺口敲 `python x.py` 时命中的是 Windows 商店占位符，报错没有任何信息量。

三个坏循环（现状，实测）：

1. **裸命令撞死**：`python x.py` → 占位符报错 → `where python` / 试 `python3` / 试 `py` → 2–4 次调用。
2. **查了但用内置**：调 `load_workspace_dependencies` → 用内置 python → `ModuleNotFoundError` → 换库硬凑 → 1–3 次调用 + 一段长推理。
3. **报错后自由发挥**：traceback 进上下文，模型不报告、不安装，改用自己的办法实现。

注意：模型从未"选错"解释器——它根本没有在选择，而是在盲试。所以解法不是给选择器，是**让正确动作成为最省力的动作**。

## 目标

- 跑 Python 有一个确定性入口，一次调用拿到结构化结果。
- 用户不配置也能对；配置了就必须生效。
- 缺包时给一条可直接执行的修复指令，消掉绕路。
- 用户能在界面上看见当前用的是哪个解释器，并能当场切换。
- 内置 runtime 与 office 工具链零影响。

## 非目标

- 不做包管理（不替代 pip / conda / uv 的解析与安装能力，只给建议命令）。
- 不接管 MCP server 的解释器。
- 不替换 primary runtime 的 `source`，不 shadow `load_workspace_dependencies`。
- 不做常驻上下文注入（见 ADR-0003）。

## 行为规范

### 1. 解析器（纯函数）

输入 `(config, cwd, sessionState)`，输出唯一解释器或"歧义/无候选"。顺序见 ADR-0004：

```
L1 会话内显式切换
L2 工作区选择 .dsh/python.json
L3 profile 默认 config.defaultInterpreter
L4 已激活环境 VIRTUAL_ENV / CONDA_PREFIX
L5 工作区内 ./.venv
L6 PATH 上第一个真实 python
L7 内置 runtime
```

- **逐层取第一个非空层**，层内按 `realpath` 去重。
- 层内去重后 > 1 → 返回"歧义"，带编号候选列表；不自行挑选。
- 零候选 → 内置 runtime（确定性兜底，不报错）。
- **验证**：候选采用前跑 `<exe> -c "import sys"`，超时 5s；失败即剔除。占位符、坏 venv、权限不足都在这里被淘汰。
- **缓存**：验证结果按 `(realpath, mtime)` 缓存 30s，避免每次调用都付 ~100ms 的进程启动成本。

### 2. `python` 工具（唯一推荐的执行入口）

```
python(
  action?: "run" | "status" | "list" | "use" | "reset",   // 默认 run
  code?: string,        // 内联代码
  script?: string,      // 脚本路径
  args?: string[],      // 脚本参数
  bundled?: boolean,    // 强制使用内置 runtime
  env?: string          // use/list 的候选编号或绝对路径
)
```

- `run` 返回 `{interpreter, version, exit_code, stdout, stderr, missing_modules?, fix?}`。
- `status` 返回当前解析结果 + 命中层级（如 `L2 工作区选择`）。
- `list` 返回全部候选（编号、来源层、路径、版本、是否可用）。
- `use` 在**本会话**内切换（L1）；`reset` 清除。
- 工具描述带一行当前解释器摘要（静态，见 ADR-0003）。
- `bundled: true` 是唯一的"我要那 13 个包"通道；office 工具链不走本工具。

### 3. 缺包诊断

从 stderr 提取 `ModuleNotFoundError: No module named 'x'` → `missing_modules: ["x"]`，并给
`fix: "<解释器绝对路径>" -m pip install <包名>`。映射表覆盖常见 import 名 ≠ 包名的情形（`yaml`→`pyyaml`、
`PIL`→`pillow`、`cv2`→`opencv-python`、`sklearn`→`scikit-learn`、`bs4`→`beautifulsoup4`、`dateutil`→`python-dateutil`）。
认不出的 import 名就给 `-m pip install <name>`，不猜。

**失败不静默**：诊断信息进 stderr 可见区域，长度上限 3 行。

### 4. 影射（隐式门）

让 `python`、`python3` 这两个**名字**解析到用户环境；绝对路径调用不受影响（office 工具链因此零影响）。
实现是进程级 PATH 前缀（见 ADR-0005），随解析结果更新、unload 时恢复快照，扫 PATH 时用快照避免自反馈。
默认开，配置可关。解析结果为内置 runtime 时主动清空前缀。

`py` 不在影射范围：它是 Windows 的 launcher，不在解释器目录里，做它需要额外的 shim 可执行文件。

### 5. 工作区选择

- `.dsh/python.json`：`{ "interpreter": "<绝对路径>", "conda": "<env 名>" }`，二者择一；
  `interpreter` 优先。文件随 git 走，缺失时静默跳过。
- `.python-version`：只读线索，仅当其中是**版本号**时用于筛选候选（匹配多个 → 视为歧义）。
- `./.venv`：按平台探测 `Scripts/python.exe` 或 `bin/python`。

### 6. 界面

只有一个交互：**默认 Python 下拉框**，出现在三处（设置页 `settings.section`、徽标弹层、首次运行提示）。

- 选项 = `关闭自定义 Python（使用内置）` + 全部可用解释器，标签形如 `conda · Django 3.12.11`；
- 选中即生效，无保存按钮、无第二动作；
- `关闭` = 撤销 `python` 工具注册 + 清除 PATH 影射，等同插件不存在；
- 选中的解释器以"显式指定"进入 L1，压过工作区文件。

### 7. 切换通知

UI 或工具发生切换时注入**一行** system note（解释器路径 + 版本 + 生效范围）。工具返回值永远带
`interpreter` 字段作双保险。

### 8. 自动装包（默认关）

开启后，`run` 遇到已知缺包时自动 `-m pip install` 到**用户环境**并重试一次。失败则回落到正常诊断。
默认关闭，且开关状态在设置页可见。

## 非功能要求

| 项 | 约束 |
|---|---|
| 平台 | 跨平台设计，Windows 先落地并验收；macOS/Linux 走同一解析器，路径分支隔离 |
| 每轮 token | 工具 schema ≤ 200 token；不新增常驻注入 |
| 失败信息 | 诊断 ≤ 3 行；切换通知 1 行 |
| 解析延迟 | 有缓存时 < 5ms；无缓存首次 ≤ 300ms |
| 健壮性 | 解析失败、坏解释器、缺 `.dsh` 目录都不得抛出未捕获异常 |

## 验收标准

1. 工作区存在 `.venv` 且 PATH 上有 conda 时，`python(action="run", code="import sys;print(sys.executable)")` 使用 `.venv`，不报歧义。
2. 同一解释器被 PATH 与 conda 同时发现时，`list` 只出现一次。
3. 无任何候选时空列表不报错，`run` 落到内置 runtime。
4. `run` 缺 `yaml` 时返回 `missing_modules: ["yaml"]` 与 `pip install pyyaml` 建议，且不返回裸 traceback。
5. `bundled: true` 时始终使用内置 runtime（3.12，13 个包可用）。
6. 影射开启时，新 shell 里 `python -c "import sys;print(sys.executable)"` 输出用户环境路径；关闭时恢复原状。
7. 设置页徽标显示的路径与 `status` 返回一致。
8. 未实现影射（spike 失败）时，其余功能仍可用，徽标与工具不受影响。

## 未验证项（实现前必须 spike）

- ~~**S1 影射可行性**~~ —— 已由 ticket 06 回答：`ctx.shell` 不可包装；可行路径是进程级 PATH 前缀或替换 executor 行。见 ADR-0005。
- ~~**S2 激活环境继承**~~ —— 已由 ticket 06 回答：不继承用户终端的激活状态，`.env` 也被 BOOTSTRAP 名单拦死。
  L4 实际几乎恒为空，链本身不退化。
- **S3 影射的全局性**：多会话并行时裸命令只跟随最近一次解析。是否需要按会话收敛，等真实使用后再定。

## 里程碑

- **v1**：解析器 + `python` 工具 + 工作区选择 + 缺包诊断（token 收益主体）
- **v2**：影射（干掉裸命令循环）
- **v3**：界面（徽标 + 设置页）+ 切换通知
- **v4**：自动装包开关、开源发布物（README / LICENSE / CI）
