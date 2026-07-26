# 修复考试取题不校验题库归属，SQLite id 复用后跨用户读到他人题目（issue #123）

## 背景

`_load_all_exam_questions`（`routers/exam.py`）的授权链只有三条：exam 属于当前用户、`question_id ∈ 快照`、`question.bank_id ∈ exam.bank_ids`。全程没有校验题目所属题库当前仍归 `exam.user_id` 所有。

SQLite 的 `questions` / `question_banks` 均为 `INTEGER PRIMARY KEY` 无 `AUTOINCREMENT`，删除最高位行后 id 会被下一次插入复用（#84 确立的威胁模型）。攻击者删除自己的题目/题库释放最高位 rowid，受害者新增题目/导入题库拿到被复用的 id 后，快照里的 id 便指向受害者的行。

## 修复范围

对 issue 定位的读路径做了修复后，配套的安全审查（3 个对抗性子代理 + PoC）发现**同一类归属缺口散落在多个独立取题点**，其中 `submit_answer` 泄露更严重（直接回显 `correct_answer`/`analysis`），且是把「他人题目 id」写成非 NULL 答题记录的唯一写入点，也是 `/result`、`/history`、`/wrong-answers` 间接泄露的总源头。因此本次统一收口为一个不变量：**凡按存储/快照 id 物化 Question 的查询，都 join `QuestionBank` 并按归属过滤。**

| 位置 | 端点 | 说明 | 可达性 |
| --- | --- | --- | --- |
| `exam.py` `_load_all_exam_questions` | `/current`、`/progress`、`/preview` | issue 主目标，加 `QuestionBank.user_id == exam.user_id` | 回看已完成考试即可，**无需竞态**，可靠复现 |
| `exam.py` `submit_answer` | `/answer` | 独立按 id 查题，原本无归属校验且回显答案/解析 | 需 TOCTOU 竞态绕过 #19 删除守卫（审查实测 16/20），泄露面最大 |
| `exam.py` `exam_result` | `/result`、`/history`（委托同一函数） | 按答题记录 id 取题，加归属 join | 纵深防御：唯一非 NULL 来源是被竞态污染的答题记录 |
| `wrong_answers.py` `list_wrong` / `start` | `/wrong-answers`、`/wrong-answers/start` | 按错题 id 取题，加归属 join | 纵深防御：同上 |

关于 issue 提到的 `else` 回退分支：现版本 `_load_all_exam_questions` 无 `question_ids` 时不再整库放行——`all_questions` 始终来自归属校验通过的 banks，归属过滤加在 banks 查询上对有/无快照两条路径统一生效。

## 修改文件

- `routers/exam.py`：3 处归属 join（读路径、写路径、结果汇点）。
- `routers/wrong_answers.py`：导入 `QuestionBank`，`list_wrong` 与 `start` 两处错题查询加归属 join。
- `test_integration.py`：新增 3 个回归测试。

## 验证

- `test_123a_preview_not_leak_reused_bank_of_other_user`：纯 HTTP 复现「攻击者删库释放 rowid → 受害者导入复用 id → 攻击者回看考试」，断言 preview 不含受害者题干且 `total_count == 0`；内含前提断言（id 未复用则直接失败），避免假绿。
- `test_123b_submit_answer_rejects_foreign_bank_question`：伪造「快照 id 指向他人题库」的 in_progress 状态（此状态经 HTTP 只能靠删除守卫的竞态达成，伪造以确定性回归），断言 `/answer` 返回 404 且响应体无 `correct_answer`/`analysis`。
- `test_123c_result_and_wrong_answers_do_not_leak_foreign_question`：伪造指向他人题目的答题记录，断言 `/result`、`/history`、`/wrong-answers` 均不泄露。
- 反向验证：逐个撤销对应修复后，`test_123b`、`test_123c` 均失败；恢复后通过。
- `pytest test_integration.py test_auth.py -q`：146 passed（新增 3 个）。
- 未引入新依赖，未改动数据结构、接口签名或前端。所有 join 对正常请求零行为变更（合法题目必属于本人题库）。

## 已知限制

- 与 #125（`start_exam` 快照写入未校验的 bank_ids）为同一威胁模型的两半：#125 挡住「定向指定受害者题库」，本修复挡住读写两侧的归属缺口，组合后闭环。
- 存量被污染快照不做数据迁移：读写路径均已复核归属，历史快照即便含他人题库 id 也无法再取到题目。
- 根因未消除：SQLite 复用 rowid。彻底解法是给 `questions` / `question_banks` 加 `AUTOINCREMENT` 或改用单调序列，使快照永不再指向他人行（另开 issue 评估迁移成本，`ponytail:` 归属校验是当前的防御层）。
