# 测试基础设施：去除 test_integration.py 模块级共享状态（issue #140 第二步）

## 背景

`test_integration.py` 原以模块级 `State` 单例在测试间传递数据（15 个共享字段，`state.bank_id` 被 60 个测试读取），写者链含「删除→重建」强顺序依赖，导致任意单个测试无法通过 `pytest test_integration.py::test_xxx` 独立运行。套件内还演化出 `_ensure_test_bank` 兜底、`test_44_cleanup_restore_bank` 专职复原等防御性代码，以及 3 个只写不读的死状态字段。

## 修改范围（仅测试代码，零业务代码改动）

**State 单例删除**，替换为显式 fixture 与 helper：

| 原共享状态 | 替代物 |
| --- | --- |
| `state.token` / `state.username` | session 级 `session_user` fixture（`auth_headers` 由其派生，名称不变） |
| `state.bank_id` | session 级 `bank_id` fixture（**只读约定**：仅用于开考、筛选、4xx 校验；突变场景用函数级 `own_bank`） |
| `state.exam_id` / `state.correct_count` | `_complete_exam(client, headers, bank_id)` helper，按 ANSWERS 答完一场（3 对 2 错）返回 `(exam_id, correct_count)` |
| `state.nav_exam_id` | 函数级 `nav_exam` fixture（开考 + 答对第 1 题，含原 test_16/17 的断言） |
| `state.wrong_exam_id`、`_review_first_qid`、`_q_*_id`、`_bracket_bank_id`、`_quote_bank_id` | 各测试内自建（独立用户 / `own_bank` / 局部导入），死字段直接删除 |

**测试归类原则：**

- 只读共享题库 → `bank_id`（session 级，省去重复导入）。
- 增删改题目、改题库元数据、背题标记 → `own_bank`（函数级独立题库；`review/mark` 会给用户留下针对题目的标记，也视为突变）。
- 精确断言用户级全局计数（错题数 == 2、背题统计 == 1、题库列表 == 0）→ `_register_isolated_user` 注册独立用户（原函数从 resume 段上移到公共区）。

**结构性调整（149 = 155 − 6）：**

- `test_13/14/15`（删库→验证清零→重导入顺序链）合并为独立用户自包含的 `test_13_delete_bank_and_reimport`。
- `test_16/17` 并入 `nav_exam` fixture（每次使用都会执行其断言）。
- 删除防御性伪测试 `test_44_cleanup_restore_bank`、`test_81_quote_chapter_cleanup` 与 `_ensure_test_bank` 兜底。
- `test_42_export_bank` 的 `len(questions) >= 8` 改为 `== 5`：旧值是共享链上 CRUD 测试加题的副产物，非导出接口规格。
- 仅为保护后续测试而存在的清理 delete 移除（第一步的临时库使其无意义）。

## 验证

- `pytest test_integration.py -q`：149 passed；`pytest test_auth.py test_migration.py -q`：11 passed。
- **独立性验收**：149 个测试逐一以 `pytest test_integration.py::<name>` 单进程运行，全部通过（8 路并行执行，每进程独立临时库）。
- AST 检查无顶层函数重名遮蔽；`ruff check` 通过。
- 多智能体覆盖等价性审查：按 7 个分组比对旧版/新版断言 + 共享题库只读约定专项核查，确认无非故意的断言损失。

## 已知限制

- `routers/limiter.py` 的进程级限流单例与 `limiter._storage.reset()` 私有 API 调用保留（slowapi 无公开 reset API，issue #140 中已注明短期保留）。
- 共享题库 `bank_id` 的只读约定靠 fixture docstring 与评审维持，无运行时强制；违反时表现为 test_12/22/27/28 等精确计数断言失败，指向明确。
