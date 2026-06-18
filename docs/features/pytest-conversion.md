# 集成测试转换为 pytest 格式

**日期：** 见文件修改时间  &emsp; **关联 PRD：** 无（基础设施/工具链）


## 目标

将 `test_integration.py` 从脚本风格（`python test_integration.py`）转换为标准 pytest test function 格式（`pytest test_integration.py -v`），使其兼容 pytest 的 fixture、测试选择和 CI 集成能力。

## 修改范围

- `test_integration.py` — 完全重写

## 核心实现

- 移除 `sys.path.insert(0, '.')`，使用 `from main import app` + `TestClient`
- 新增 `scope="session"` fixture：`client`、`auth_headers`
- 使用模块级 `State` 类在有序测试间传递共享状态（exam_id、bank_id 等）
- 27 个 test function 覆盖原脚本全部 27 项测试
- 移除手工 `print`，依赖 pytest 的 verbose 输出

## 影响范围

- 运行方式从 `python test_integration.py` 改为 `pytest test_integration.py -v`
- 原脚本保留为 `python test_integration.py` 也可继续运行（等价行为已验证）
- 不影响应用代码

## 验证方式

- `pytest test_integration.py -v` — 27 passed
- 脚本对比运行 — 保证行为等价
