# 修复批量导入部分失败后重试重复导入

**日期：** 2026-07-07  &emsp; **关联 Issue：** #76

## 目标
批量导入题库部分成功、部分失败后，再次点击重试按钮不应重新提交已成功导入的题库，避免后端重复创建成功项。

## 修改范围
- `static/js/app.js`
  - 部分失败时根据 `/api/question-banks/import-multiple` 返回的 `results[i].success` 过滤 `importFileList`。
  - 已成功项从待重试列表移除，仅失败项继续保留。
  - 按钮文案改为「重试失败项」，与实际行为一致。
- `tests/frontend/exam_timeouts.test.js`
  - 使用 Node 内置 `node:test` 覆盖重试列表过滤逻辑：成功项移除，失败项保留，结果缺失项按安全方向保留。

## 验收点
- 部分失败后不重新选择文件直接重试，只会重新提交失败项。
- 全部成功时仍关闭导入弹窗并刷新列表。
- 网络/API 整体失败时不清空原始待导入列表，用户可重试同一批请求。

## 验证
- `node --check static/js/app.js`
- `node --test tests/frontend/*.test.js`
- `/home/Lsk/miniconda3/bin/python -m ruff check .`
