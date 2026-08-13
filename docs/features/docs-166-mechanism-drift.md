# 文档：修正架构/PRD/DB 文档 6 处机制描述失实（issue #166）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #166

## 逐项处理

| # | 失实点 | 处理 |
|---|--------|------|
| 1 | 限流被写成「基于 IP 的失败计数与锁定」 | arch 模块表与 PRD 约束表改为实况：slowapi 固定窗口 5/minute、按远端地址、登录与注册均受限、不区分成败、无锁定状态 |
| 2 | 已上线的恢复功能（#44/#128）仍列为「关闭后丢失」限制 | arch 已知限制表删除该行；PRD 改为「进行中考试持久化在服务端，可从 GET /api/exam/unfinished 恢复」 |
| 3 | 抽题种子写的是 #12 前的 hash() 旧实现 | 已由 PR #170（#144 修复）顺带更正为 random.sample 实况，本次核对无需再改；另发现 PRD:72「seed 固定，同组数据一致」同类表述，一并改为「exam.id 为 shuffle 种子、场内题序稳定、抽子集真随机」 |
| 4 | 日志被写成「结构化 JSON」 | 改为实况：纯文本单行 `时间 [级别] logger - 消息`（logging_config.py 核对） |
| 5 | question_ids 写成「随机抽题子集时记录」 | schema.md 改为实况：全量/抽子集/错题练习开考均写入快照（exam.py/wrong_answers.py:149 核对），null 仅存在于 #22 前历史考试 |
| 6 | ER 图把 ExamRecord 画成 Question 的 1:N 子表 | 重绘 ER 图：ExamRecord 挂在 User 下，与 Question 无外键；补 question_snapshot 字段与 AnswerRecord.question_id 可空语义；图下追加外键关系全集文字说明 |

全部修改逐项对照代码核实（routers/limiter.py、routers/auth.py、routers/exam.py、
routers/wrong_answers.py、logging_config.py、models.py）。

## 验证方式

纯文档变更；`grep` 复核六处新表述与代码一致，CI 照常。

## 已知限制

- AGENTS.md/RULES.md/development-guide.md 的成片过时属 issue #164 范围，本次不扩大。
