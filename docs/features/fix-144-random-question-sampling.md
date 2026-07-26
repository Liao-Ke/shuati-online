# 修复：抽题子集去除固定种子，历次练习真随机抽题（issue #144）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #144  &emsp; **关联文档：** [question-count-selector.md](question-count-selector.md)

## 问题

`start_exam` 在 `question_count < 可用题数` 时用固定种子抽子集：

```python
seed = user.id + zlib.crc32(str(data.bank_ids).encode()) + (data.question_count or 0)
selected = random.Random(seed).sample(questions, data.question_count)
```

种子是 `(user_id, bank_ids, question_count)` 的纯函数，同一用户对同一题库组合以同一数量开考，
无论开多少次抽到的子集永远相同；候选集中未被选中的题目对该用户实际不可达。
`docs/api/endpoints.md` 将 `question_count` 描述为「随机抽取」，与实际行为矛盾。

固定种子最初是为「同组合抽题结果一致」设计（#12 只是把 hash() 换成 crc32 修复重启不稳定），
但恢复进行中考试实际依赖开考时写入的 `question_ids` 快照（`exam_records.question_ids`），
不需要种子复算——固定种子没有任何功能价值，只留下抽题不随机的副作用。

## 修改范围

- `routers/exam.py` — `start_exam` 抽子集改为 `random.sample(questions, data.question_count)`，
  删除种子计算与 `zlib` 导入。`_load_all_exam_questions` 中 `random.Random(exam.id).shuffle()`
  不动：它只决定单场考试内的题序，且必须确定（进行中考试刷新后题序不变）。
- `test_integration.py` — 新增 `test_144_question_sampling_varies_across_exams`。
- `docs/features/question-count-selector.md` — 更新核心实现代码段，移除固定种子描述，补历史脉络。

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 161 passed
ruff check .                                    # All checks passed
```

回归测试：20 题题库抽 5 题连开 8 场，断言至少出现两种不同子集
（C(20,5)=15504，真随机下 8 次全同概率约 1e-29，固定种子下必然全同）。
已做红-绿验证：旧代码下该测试失败，修复后通过。

## 已知限制

- 单次开考内无跨场去重/覆盖度保证：真随机抽样仍可能连续几场抽中重叠子集，
  「优先抽未练过的题」属于新功能（加权抽样），不在本修复范围。
