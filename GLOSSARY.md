# dsh-custom-python

DeepSeek Harness 的 Python 环境治理插件：让模型跑 Python 时默认落到用户自己的解释器，
而不是 harness 内置那个依赖写死的一小撮 runtime，从而消除"缺包 → 换库硬凑"的绕路行为。

## Language

**解释器 (Interpreter)**:
一个具体的 Python 可执行文件，连同它自己的 `site-packages`。
_Avoid_: Python 版本, 运行时

**环境 (Environment)**:
用户视角下"一个解释器加它装了什么包"的整体，通常来自 conda env、venv 或系统安装。
_Avoid_: 运行时, 沙箱

**内置 runtime (Bundled runtime)**:
harness 自带的 primary-runtime：一个 python 3.12 解释器加 13 个固定包，供 office 工具链使用。
_Avoid_: 系统 Python, 默认 Python

**用户环境 (User environment)**:
用户通过显式指定或自动探测选中、交给模型使用的那个解释器。
_Avoid_: 自定义 Python, 私有环境

**解析器 (Resolver)**:
把"当前该用哪个解释器"从一个纯函数计算出来的组件；输入是配置、工作区和环境，输出唯一一个解释器。
_Avoid_: 选择器, 检测器

**优先级链 (Precedence chain)**:
决定解析结果的固定顺序：会话内切换 > 工作区选择 > profile 默认 > 自动探测 > 内置 runtime。
_Avoid_: 回退链, 覆盖规则

**工具通道 (Tool surface)**:
把解析结果施加到模型行为上的唯一通道：模型主动调用 `python` 工具时，插件才有权决定用哪个解释器。
_Avoid_: 拦截层, 中间件, 隐式门

**不做名字影射**:
插件不修改 PATH、不劫持 `python` 命令名。模型若改去 shell 里跑，得到系统本来的结果 —— 那是模型的选择，不是插件的失败。
_Avoid_: 隐式门, PATH 劫持

**缺包诊断 (Missing-module diagnosis)**:
失败时把 traceback 转成"缺哪个模块 + 一条可直接执行的修复命令"的结构化输出。
_Avoid_: 错误提示, 报错包装

**绕路 (Detour)**:
模型因为缺少包或缺少确定性入口，改用等价替代实现（手写 CSV、换 JSON、自己拼解析器）的行为。本项目的存在理由就是消除它。
_Avoid_: 回退, workaround

**工作区选择 (Workspace selection)**:
写在工作区里、随 git 走、对该工作区内所有会话生效的解释器选择。
_Avoid_: 项目配置, 局部配置

**全局默认 (Global default)**:
在插件设置页选定、对整台机器生效的解释器；优先级低于会话切换与工作区选择。
_Avoid_: 默认 Python, 用户 Python

**首次运行提示 (First-run prompt)**:
插件第一次启用、且尚无全局默认时出现的一次性选择界面；选完或跳过后不再出现。
_Avoid_: 向导, onboarding
