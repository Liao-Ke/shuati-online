# 优化：list_banks 聚合计数代替整行加载题目（issue #149）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #149（#25 消除 N+1 的后续）

## 问题

`GET /api/question-banks` 为得到每库 `question_count`，用 `selectinload` 把该用户
**所有题库的所有题目整行**（content/options/answer/analysis 全部文本列）物化进内存，
再取 `len(bank.questions)`。内存、SQLite 读取量、ORM 构造成本随用户题目总量线性增长；
该接口被题库管理、答题设置、背题设置三个高频页面调用。

## 修复

单条聚合查询：`QuestionBank` outerjoin `Question` 后 `group_by(QuestionBank.id)` 取
`func.count(Question.id)`，与 `routers/dashboard.py` 的统计口径一致。不再加载任何题目列；
outerjoin 保证 0 题库仍返回且计数为 0。排序（updated_at desc）与响应结构不变。

## 指标对比（3 库 × 40 题，SQLAlchemy before_cursor_execute 统计）

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| list_banks 期间 SELECT 语句数（含鉴权查 user） | 3 | 2 |
| 加载题目正文列（questions.content 等）的语句数 | 1（120 行整行） | 0 |
| 服务端物化的 Question ORM 对象数 | 与题目总量线性 | 0 |

## 验证方式

```bash
/home/Lsk/miniconda3/bin/python -m pytest -q   # 162 passed
ruff check .                                    # All checks passed
```

新增 `test_149_list_banks_question_count_aggregate`：隔离用户下 5 题库与 0 题库
（导入后删光题目）计数分别为 5/0，0 题库不因聚合查询丢行。

## 已知限制

- `Question.bank_id` 无索引（issue #137），聚合查询与原 selectinload 同样受全表扫影响；
  #137 落地后本查询自动受益，两者独立。
