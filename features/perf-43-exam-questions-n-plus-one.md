# 优化：考试主流程 _load_all_exam_questions 消除 N+1 查询

## 关联

- GitHub Issue: #43
- 分支: `main`（直接提交）

## 问题

`_load_all_exam_questions`（`routers/exam.py`）先查 `QuestionBank` 再在循环中访问每个 `bank.questions`，relationship 默认 `lazy='select'`，多题库考试下产生 1+N 次查询。该 helper 被 `current_question`、`exam_progress`、`exam_preview`、`submit_answer`（经 `_load_exam_questions`）反复调用——用户每次翻题、看进度、开整卷预览、提交答案，查询次数都随题库数线性增长。

## 修改范围

### `routers/exam.py`

`_load_all_exam_questions` 重写为两条路径：

- **快照路径**（`exam.question_ids` 有值，issue #22 起所有新考试）：一次 `db.query(Question).filter(Question.id.in_(selected_ids), Question.bank_id.in_(bank_ids))` 查回全部题目。`bank_id` 过滤保持旧实现语义（题目必须仍在本场考试的题库范围内）。
- **快照损坏守卫**：`question_ids` 无法解析为列表时按空集过滤，保持旧实现「返回空考试」的降级口径，而非把 `str` 传进 `in_()` 抛 500。
- **回退路径**（历史考试无快照）：保留按题库加载，但加 `selectinload(QuestionBank.questions)`，N 次懒加载压缩为 1 次批量 IN 查询。

**题序保持**：随机模式的 `random.Random(exam.id).shuffle` 结果依赖输入列表顺序。旧实现的输入顺序是「题库按 id 升序 × 题库内题目按 rowid 升序」（SQLite 隐式顺序），新实现在 shuffle 前显式按 `(bank_id, id)` 排序复现该顺序——把原本依赖隐式行为的顺序变为显式保证，进行中的随机模式考试题序不变。顺序模式排序键 `(bank_id, sort_order, id)` 不变。

### `test_integration.py`（新增 3 个测试）

- `test_43a`：SQLAlchemy `before_cursor_execute` 事件统计 SELECT 数，断言 2 库与 5 库考试的 `current`/`progress`/`preview` 查询次数相等（不随题库数线性增长）。
- `test_43b`：随机模式题序等于「(bank_id, id) 升序列表 + exam_id 种子 shuffle」，且两次请求间稳定——锁定与旧实现一致的题序口径。
- `test_43c`：把 `question_ids` 置 NULL 模拟 issue #22 之前的历史考试，验证回退路径返回全部题目，且 2 库与 5 库的查询数同样相等（否则删掉 `selectinload` 测试仍会全绿）。
- `test_43d`：`question_ids` 置为截断 JSON `"[1, 2"`，验证三个读端点返回 200 空考试而非 500。

## 验证方式

1. `pytest test_integration.py test_auth.py` — 147 项全通过
2. 红绿/突变验证（每个新测试都确认能捕获对应回归）：
   - `git stash` 还原旧实现 → `test_43a` 失败（捕获 N+1）、`test_43b` 通过（证明新实现题序与旧实现完全一致）
   - 删除回退分支的 `selectinload` → `test_43c` 失败
   - 删除快照损坏守卫 → `test_43d` 失败
3. `ruff check .` 通过
4. 多智能体审查（行为一致性 / 安全边界 / 边界条件三视角 + 对抗性核实）

## 已知限制

- 快照路径的 `IN` 参数个数 = 题目数 + 题库数，与既有 `exam_result`、`review`、`wrong_answers` 的同型查询一致。实测部署镜像与开发机的 `SQLITE_LIMIT_VARIABLE_NUMBER` 均为 250000（Debian 打包补丁，非上游默认的 32766），单场考试题量远低于此。
- `start_exam` 内仍存在一处按题库循环访问 `bank.questions`（每场考试仅执行一次，非高频热点），不在本 issue 范围。
- 安全审查发现取题路径缺少题库归属校验（SQLite id 复用后可跨用户读到他人题干），已确认为**既有缺陷而非本次改动引入**——对同一 PoC 打桩执行旧实现输出完全相同。属安全变更（L2），单独记录为 issue #123，不在本次改动范围。
