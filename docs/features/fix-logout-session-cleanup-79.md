# 修复：退出登录清理考试/背题会话状态 (#79)

## 问题

`logout()` 只清除 token 和 `state.user`，未清理考试/背题相关的 `sessionStorage` 和全局变量。同一浏览器切换账号后，新账号会沿用旧账号的 `activeExamId`、`reviewFilter` 等残留状态，访问 `#/exam` / `#/review` 时请求旧账号资源被后端拒绝，页面卡住。

## 修改范围

仅 `static/js/app.js`，纯前端改动。

## 修改内容

1. 新增 `resetSessionState()` 辅助函数，统一清理：
   - 停止计时器（`examTimerInterval`、`examElapsedInterval`、`examScrollTimer`）
   - 移除滚动监听（`trackPreviewScroll`）
   - 清除 `sessionStorage` 中所有用户相关键（含 `examTimeouts`，逐个 `removeItem`，不使用 `clear()`）
   - 重置全局变量（`examId`、`reviewFilter`、`examProgress`、`examCurrentIndex`、`examFullPreview`、`examTimeoutSeconds`、`state.questionStartTime` 等）
2. `logout()` 调用 `resetSessionState()`
3. 登录成功路径调用 `resetSessionState()`
4. 注册成功路径调用 `resetSessionState()`

## 验证

- `node --check static/js/app.js` 语法通过
- `node --test tests/frontend/*.test.js` 前端辅助函数测试通过
- `ruff check .` 无错误
- `pytest test_integration.py -v` 97 项全部通过
- 手动验证：用户 A 考试中退出 → 用户 B 登录 → 访问 `#/exam` 从干净状态进入，不请求旧 examId
