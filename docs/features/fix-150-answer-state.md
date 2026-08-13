# 修复：答题页跨题答案状态泄漏与失败重试丢答案（issue #150）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #150

## 问题

`submitCurrentAnswer` 依赖模块级 `selectedAnswer`/`selectedMultiAnswers`：

1. **跨题泄漏**：`loadQuestionByIndex` 单向重置（multiple 只清多选、choice/judge
   只清单选）。多选勾选后不提交跳到选择题再提交，残留数组无条件覆盖新答案 →
   400「选择题答案必须为字符串」；反向则残留字符串被多选题自动提交 → 400。
2. **失败重试丢答案**：`selectedMultiAnswers = []` 在发请求前执行，catch 不恢复。
   网络失败后重试提交 null → 该题静默判错且被重复提交拦截无法再改。

## 修复

- `loadQuestionByIndex`：新题渲染时**无条件**清空两类共享答案状态（原题型分支
  只保留按钮初始态逻辑）。
- `submitCurrentAnswer`：组装时不再清空 `selectedMultiAnswers`——清理统一由提交
  成功后的 `loadQuestionByIndex` 完成，失败重试拿到同一份答案。

## 验证方式

```bash
node --test tests/frontend/*.test.js   # 40 pass（新增 3 项）
```

新增 `tests/frontend/answer_state_machine.test.js`（答案状态机首个覆盖）：
多选未提交切选择题 → 提交字符串新答案；选择未提交切多选题自动提交 → null
而非残留字符串；多选失败重试 → 与首次一致的数组而非 null。
已红-绿验证：旧代码下 3 项全部失败。

## 已知限制

- 提交失败后倒计时仍处于停止状态（提交入口清掉后 catch 不重启）——真实网络
  故障下不自动倒数更安全，未在本次调整；如需恢复可在 catch 中按剩余时间重启。
