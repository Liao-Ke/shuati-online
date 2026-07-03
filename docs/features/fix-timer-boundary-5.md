# 修复计时器边界异常与导出文件名说明（#5）

## 背景

GitHub issue #5 报告三个前端 bug：
1. 导出文件名解析不匹配
2. `formatTime` 不处理负数 → 显示 `"-1:-1"`
3. `parseTime` 假设格式为 `M:SS` → 空串/异常格式导致 `parseInt(undefined)` → `NaN`，暂停恢复崩溃

## 修改范围

仅修改 `static/js/app.js` 两个工具函数。

### `formatTime(sec)`（原 `static/js/app.js:1734`）
- 增加非有限值与负数钳为 0 的前置守卫。
- 行为：`formatTime(-1)` 由 `"-1:-1"` 变为 `"0:00"`；`formatTime(NaN)` 由 `"NaN:0N"` 变为 `"0:00"`；正常值不变。

### `parseTime(str)`（原 `static/js/app.js:1396`）
- 改用正则 `/^(\d+):(\d+)$/` 严格匹配 `M:SS` 整数格式，不匹配返回 0。
- 行为：`parseTime("")` / `parseTime(undefined)` / `parseTime("-1:-1")` 由 `NaN` 变为 `0`；合法 `M:SS` 不变。
- 取代旧实现 `parseInt(parts[0]) * 60 + parseInt(parts[1])`，避免 `parseInt(undefined)` 与 `NaN` 在 `examPauseRemaining`/`examElapsedOffset` 中传播。

## 与其他 PR 的关系

issue #5 的子项 1（导出文件名解析不匹配）已由 PR #29（issue #23）修复：
- 后端 `routers/banks.py` 同时提供 `filename=` ASCII fallback 与 `filename*=UTF-8''` RFC 5987 编码。
- 前端 `static/js/api.js` 优先解析 `filename*=` 并 `decodeURIComponent` 解码，回退到 `filename=`。

本 PR 只处理子项 2、3（计时器边界），合并后 #5 的三个子项全部关闭。

## 验证

- `node --check static/js/app.js` 语法通过
- `node` 直测 `formatTime(-1)="0:00"`、`formatTime(125)="2:05"`、`parseTime("")=0`、`parseTime("2:05")=125`
- `pytest test_integration.py` 52 项全通过（前端工具函数修改不影响后端集成测试）

## 已知限制

- `parseTime` 对非法格式返回 0，意味着暂停期间若计时器显示被外部清空/破坏，恢复后会从 0 开始倒计时并立即触发 `submitCurrentAnswer()`。这是已知次级影响，但相比 NaN 在状态变量中传播导致计时器永久显示 `NaN:NaN`，此处理更安全。