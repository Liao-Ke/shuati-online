# 修复：章节筛选 checkbox value 属性转义截断 (#75)

## 问题

前端渲染章节筛选 checkbox 时，将章节名通过字符串拼接放入 HTML `value` 属性：

```javascript
`<input type="checkbox" value="${escHtml(c)}">`
```

`escHtml()` 只转义 `<`、`>`、`&`，不转义双引号 `"`。当章节名含双引号（如 `第"一"章`），生成的 HTML 为 `<input value="第"一"章">`，浏览器解析后 value 被截断为 `第`，导致筛选失效。

## 根因

`escHtml()` 是文本节点转义工具，不适用于 HTML 属性值构造。字符串拼接生成带用户输入的属性存在上下文转义缺失风险。

## 修复方案

将 `renderChapterCheckboxes()` 和 `renderExamChapterCheckboxes()` 改为 DOM API 构建：

- `document.createElement('input')` 创建元素
- `input.value = c` 直接赋值（DOM 赋值不受引号影响）
- `document.createTextNode(c)` 构建文本节点（等价于文本转义）

不改 `escHtml()` 本身（其他文本节点场景正确），不改后端。

## 修改范围

| 文件 | 改动 |
|------|------|
| `static/js/app.js` | `renderChapterCheckboxes()`、`renderExamChapterCheckboxes()` 改用 DOM API |
| `test_integration.py` | 新增 test_77~test_81，覆盖双引号章节名的导入、章节列表、答题筛选、背题筛选 |
| `tests/frontend/chapter_filters.test.js` | 覆盖前端 DOM 渲染时 checkbox value 不因双引号截断 |

## 验证

- `node --check static/js/app.js` 语法通过
- `node --test tests/frontend/*.test.js` 前端辅助函数测试通过
- `ruff check .` 0 错误
- `pytest test_integration.py -v` 全部 102 条通过（含 5 条新增，PR 原验证记录）

## 已知限制

- 未引入浏览器端到端测试；前端 DOM 行为通过 Node DOM stub 覆盖，后端契约测试固化「双引号章节名是合法值」
