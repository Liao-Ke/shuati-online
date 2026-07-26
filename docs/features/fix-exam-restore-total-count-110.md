# 修复单题模式刷新后「上一题/下一题」按钮失效（issue #110）

## 背景

考试页刷新（F5）后，`/exam` 路由的恢复流程从 sessionStorage 恢复 `activeExamId`、`examCurrentIndex`、计时模式等状态，并请求 `/api/exam/{id}/progress` 重建进度，但漏掉了全局变量 `examTotalCount`（刷新后保持初始值 0）。

`navigateExam(delta)` 的边界判断 `newIndex >= examTotalCount` 因此恒成立，所有「上一题/下一题」点击被静默 return。按钮外观与导航提示（如 `2 / 10`）由接口返回的 `data.total_count` 驱动，显示完全正常，用户得不到任何报错反馈。侧边栏题号跳转（`goToQuestion`）不经过该判断，仍然可用；切换一次整卷模式再切回（`renderFullPreview` 会赋值 `examTotalCount`）可「自愈」。

## 修改范围

- `static/js/app.js`：`/exam` 路由恢复流程中，在 `api.getExamProgress(examId)` 返回后补一行 `examTotalCount = examProgress.total_count`。该响应本就在下一行用于 `examCurrentIndex` 的越界检查，不新增请求。
- `tests/frontend/exam_restore.test.js`：新增回归测试，在 vm 沙箱中直接调用 `router.routes['/exam'].handler`，stub `api.getExamProgress` 返回 `total_count: 3`，断言恢复流程结束后 `examTotalCount === 3`。

## 验证

- `ruff check .` 通过；`pytest test_integration.py -q` 125 个测试全部通过（后端无改动）。
- `node --test tests/frontend/*.test.js` 16 个测试全部通过。红绿检查：暂存修复后新测试失败（`examTotalCount` 为 0），恢复修复后通过。
- 真实浏览器验证（Playwright + Chrome，3 题考试，考试页整页刷新触发恢复流程）：
  - 修复前：`examTotalCount = 0`，点击「下一题」导航提示停留 `1 / 3`，题目不切换。
  - 修复后：`examTotalCount = 3`，点击「下一题」导航提示变为 `2 / 3`，题目正常切换。

## 已知限制

- issue 附加信息中提到「刷新后整卷模式滚动定位失效（scrollIdx 为 -1）」经核实不成立：恢复流程中 `scrollIdx` 在 `await renderFullPreview()` 之后计算，彼时 `examTotalCount` 已被 `renderFullPreview` 赋值。本修复使该值在恢复流程更早处就绪，两条路径口径一致。
