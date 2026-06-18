# 新增多选题题型

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标

在原有 choice/fill/judge 三种题型基础上，新增 `multiple`（多选题）题型。

## 修改范围

| 文件 | 修改内容 |
|------|---------|
| `routers/banks.py` | `VALID_TYPES` 添加 `"multiple"`；导入验证添加多选分支（选项 ≥2，答案必须为非空数组） |
| `routers/exam.py` | `submit_answer` 中添加 `multiple` 评分逻辑：排序后逐元素比较，顺序无关 |
| `static/js/app.js` | 答题设置页添加多选题 checkbox 和独立超时输入（默认45秒）；答题页 checkbox 多选渲染 + `toggleMultiChoice()`；整卷预览多选渲染 + `togglePreviewMulti()` + `submitInlineMulti()`；背题页/错题本/历史页选项渲染适配数组答案 |
| `test_integration.py` | 添加多选题目导入、答题、题型筛选等测试用例 |
| `README.md` | 更新题型列表和题库 JSON 示例 |

## 核心实现

- **类型标识**: `"multiple"`
- **答案格式**: JSON 字符串数组，如 `["A", "C"]`，与现有多空填空格式一致，自动兼容 `startswith("[")` 反序列化逻辑
- **评分**: 全对才得分，排序后比较（顺序无关）
- **超时**: 独立的 `multi_timeout`（默认 45 秒）
- **交互**: checkbox 样式，可多次点击切换选择，至少选一项才能提交

## 影响范围

- 后端所有涉及题型判断的地方（导入验证、评分、反序列化）均适配
- 前端答题页、整卷预览、背题页、错题本、历史详情、结果页均适配
- JSON 导入/导出格式扩展

## 验证方式

运行集成测试确认 28 项全部通过：
```bash
python test_integration.py
```

关键验证点：多选导入成功、答题正确的返回 `is_correct=true`、题型筛选正确过滤。

## 已知限制

无。
