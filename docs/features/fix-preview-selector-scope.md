# 修复整卷模式多选/填空选择器全局污染

**日期：** 见文件修改时间  &emsp; **关联 Issue：** #4

## 目标

整卷模式（full preview）下，多选题和填空题的选择器使用全局查询，会把其他题目的选择状态一并提交，导致答案串题。

## 修改范围

- `static/js/app.js`：`submitInlineMulti()` 与 `submitCurrentAnswer()` 两个函数

## 核心实现

1. **多选题**：`submitInlineMulti()` 原先用 `document.querySelectorAll('.preview-multi-option.selected')` 选取页面所有已选选项。改为先用题目卡片选择器 `.preview-card[data-index="${index}"]` 定位当前题，再在其内部查询 `.preview-multi-option.selected`，提交时只包含当前题的选择。
2. **填空题**：`submitCurrentAnswer()` 原先用全局 `document.querySelectorAll('.fill-input')` 和 `document.getElementById('fill-answer')` 读取填空答案，DOM 残留元素会覆盖其他题型的选择（如多选题的 `selectedMultiAnswers`）。改为仅在单题模式的当前题目容器 `#options-area` 内查询，整卷模式或不存在填空输入时不覆盖 `userAnswer`。

## 影响范围

- 仅影响整卷模式多选题的提交范围、单题模式填空题答案的读取作用域
- 选择题、判断题、整卷模式填空题（`submitInlineFill` 已按 `data-qid` 作用域，未改动）不受影响
- 结果页、历史页、其他页面不受影响

## 验证方式

1. `node --check static/js/app.js` 语法通过
2. `pytest test_integration.py` 52 个集成测试全部通过
3. 手动验证需在整卷模式连续作答两道多选题，确认第二题提交不含第一题的选项

## 已知限制

- 选择器作用域修复属防御性收敛，未对整卷模式计时器在切换单题模式后仍残留触发 `submitCurrentAnswer` 的边沿问题做处理（不在本 issue 范围）