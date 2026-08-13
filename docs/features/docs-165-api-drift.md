# 文档：修正 endpoints.md/README 与实际 API 的 6 处不符（issue #165）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #165

## 逐项处理（均对照代码核实）

| # | 偏差 | 处理 |
|---|------|------|
| 1 | 409 全部未记录 | 通用状态码表补 409；删除题库（#19）、编辑/删除题目（#90）、GET result 与 history/:id（考试尚未结束）各补 409 条目 |
| 2 | POST /api/exam/:id/answer 错误零记录 | 补全：400 四种（exam_id 不一致 #46 / 已结束 / 不属于本考试 / 重复作答）+ 404 两种（练习/题目不存在） |
| 3 | 错题本响应缺 bank_id | 示例补 `"bank_id": 3`（wrong_answers.py 核对） |
| 4 | 注册缺 2 条校验 | 补用户名 > 50 字符、密码 UTF-8 > 72 字节（#80） |
| 5 | preview「所有题目 + 答案」 | 改为实况：未作答题目 answer/analysis 为 null，不提前泄题（#17/#27） |
| 6 | README API 概览缺端点 | 补 `GET /api/exam/unfinished`（#44）与 `GET /api/health` 两行 |

## 验证方式

纯文档变更；grep 复核 409/bank_id/unfinished/health 落位，各错误文案与代码
detail 字符串一致，CI 照常。

## 已知限制

- endpoints.md 其余未逐字复核的段落不在本次范围（issue 只列出这 6 处）。
