# 修复：整卷模式已作答选择题选项不再绑定点击提交

## 关联

- GitHub Issue: #113
- 分支: `fix/113-preview-answered-choice-readonly`

## 问题

`renderFullPreview` 渲染选择题选项时，无论 `is_answered` 与否都输出 `onclick="submitInlineChoice(...)"`，仅用 `is_answered` 控制 `cursor:pointer` 样式。进入整卷模式时已是已作答状态的选择题（如单题模式作答后切换视图），点击其选项会发起重复提交请求，后端返回 400，前端弹出「提交失败: 该题目已作答，不可重复提交」。判断题、多选题、填空题分支均已按 `is_answered` 区分渲染，仅选择题受影响。

## 修改范围

### `static/js/app.js`

- `renderFullPreview` 选择题分支：`onclick` 与 `style="cursor:pointer"` 一并移入未作答条件分支，已作答时选项为纯展示，与判断题/多选题分支行为一致。单行改动。

### `tests/frontend/preview_answered_choice.test.js`（新增）

- vm 加载 app.js，stub `api.getExamPreview` 返回一道已作答、一道未作答选择题，断言已作答选项无 `submitInlineChoice`/`cursor:pointer`，未作答选项两者保留。

## 验证方式

1. `node --test tests/frontend/*.test.js` — 16 项全通过；红绿验证：回退修复后新测试失败，恢复后通过
2. `pytest test_integration.py` — 125 项全通过；`ruff check .` 通过
3. Playwright + Chrome 真实浏览器验证：单题模式作答选择题 → 切整卷模式 → 点击已作答题选项，无网络请求、无弹窗；点击未作答题选项，正常提交并显示正确高亮
