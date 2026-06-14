## Why

当前集成测试 `test_integration.py` 是脚本风格：线性执行、`print` 输出、通过 `sys.path.insert(0, '.')` 导入。运行方式为 `python test_integration.py`，无法利用 pytest 的 fixture、断言失败定位、测试选择、覆盖率等能力。将其转换为标准 pytest test function 格式后，可执行 `pytest test_integration.py -v` 收集测试项，与项目后续的 CI/自动化流程兼容。

## What Changes

- `test_integration.py` 重写为 pytest test function 格式
- 移除 `sys.path.insert(0, '.')`，依赖 pytest 自动发现
- 移除手写 `print` 日志，依赖 pytest 的 verbose 输出
- 使用 `@pytest.fixture` 管理共享状态（client、token、exam_id 等）
- 28 项测试逻辑不变，行为完全等价
- 运行方式从 `python test_integration.py` 改为 `pytest test_integration.py -v`

## Capabilities

### New Capabilities
- `pytest-compatible-tests`: 集成测试以 pytest test function 形式组织，支持 pytest 全部功能

### Modified Capabilities
- 无，纯测试文件重构

## Impact

- `test_integration.py` — 重写为 pytest 格式
- 移除 `sys.path.insert`，不影响其他模块
- 不移除任何功能测试，28 项全覆盖
