# 修复新考试继承上一场整卷模式（issue #57）

## 背景

考试页会用 `sessionStorage.examMode` 保存单题/整卷显示模式。上一场考试切到整卷模式后，如果用户绕过完成流程直接开始新考试，新考试会读取旧的 `examMode=preview`，导致显示模式从上一场泄漏到新考试。

## 修改范围

- 普通考试入口 `startExam()` 创建新考试后，将 `examFullPreview` 重置为 `false`。
- 普通考试入口清除 `sessionStorage.examMode`，让新考试默认进入单题模式。
- 错题练习入口 `startWrongPractice()` 做同样清理，避免从普通考试或上一场错题练习继承模式。

## 验证

- 检查 `startExam()` 和 `startWrongPractice()` 均在跳转 `/exam` 前清理显示模式状态。
- 本地执行 JavaScript 语法检查。
- 依赖 GitHub CI 的 lint、test、docker-build 和 CodeQL 检查。

## 已知限制

当前仓库没有前端单元测试或浏览器自动化测试脚手架，本次修复不为 4 行状态清理新增测试依赖。
