## Context

`test_integration.py` 是脚本风格测试，线性执行 28 步，使用 `print` 输出日志。运行方式 `python test_integration.py`，无法被 pytest 发现。项目后续可能加入 CI，需要兼容标准测试框架。

## Goals / Non-Goals

**Goals:**
- 所有测试逻辑保留，行为等价
- 可通过 `pytest test_integration.py -v` 运行并看到 28 个测试项
- 使用 pytest fixture 管理共享状态
- 测试文件保持单文件，不新增依赖

**Non-Goals:**
- 不改变测试逻辑覆盖范围
- 不新增测试场景
- 不改动应用代码

## Decisions

| 决策 | 方案 | 理由 |
|------|------|------|
| 共享状态 | `scope="session"` fixture 管理 client, token, bank_id, exam_id | 测试顺序依赖，session 级别避免重复注册/导入 |
| 测试顺序 | 单个文件按书写顺序执行，不使用 `pytest.mark.order` | pytest 默认按文件顺序执行 test function，足够 |
| 断言语义 | 继续使用 `assert` | 与现有风格一致，pytest 原生支持 |
| `sys.path` 移除 | 删除 `sys.path.insert(0, '.')` | pytest 自动将项目根加入 sys.path |

## Risks / Trade-offs

- 测试间存在顺序依赖（后一个依赖前一个的结果），违反纯单元测试的独立性原则——但这是集成测试的固有特性，使用 session fixture 管理状态
- 重写后首次运行可能发现之前未暴露的资源清理问题
