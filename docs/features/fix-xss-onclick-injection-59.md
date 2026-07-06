# 修复：题库删除按钮内联 onclick 的 XSS 注入风险

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#59](https://github.com/Liao-Ke/shuati-online/issues/59)

## 目标

修复题库列表页删除按钮将用户输入（题库标题）拼入内联 `onclick` 字符串字面量导致的 XSS 注入风险。

## 问题

1. `escHtml()` 是 HTML 转义，不适合 JavaScript 字符串字面量
2. 标题中的单引号 `'` 会破坏 `onclick` 的 JavaScript 字符串语法
3. 标题可以包含恶意脚本，如 `'); alert(1);//`，在字符串闭合后被注入执行
4. 虽因 `escHtml()` 将 `'` 转为 `&#39;` 而非直接注入，但 HTML 实体在 JS 上下文中可能被解码，存在潜在风险

## 方案

将用户输入（标题）从内联 `onclick` 字符串中彻底移除，改为通过 `data-bank-id` 属性传递题库 ID，在 `confirmDeleteBank` 函数内运行时从 DOM 读取标题文本。

## 改动

| 文件 | 改动 |
|------|------|
| `static/js/app.js` | 删除按钮从 `onclick="confirmDeleteBank(${b.id}, '${escHtml(b.title)}')"` 改为 `data-bank-id="${b.id}" onclick="confirmDeleteBank(this.dataset.bankId)"` |
| `static/js/app.js` | `confirmDeleteBank(id, title)` 改为 `confirmDeleteBank(id)`，内部通过 `document.querySelector` 定位卡片，再从 `.card-title` 的 `textContent` 读取标题 |

## 验证方式

1. `node --check static/js/app.js` — 语法检查通过
2. `pytest test_integration.py -v` — 回归测试全部通过
3. 同类 onclick 风险排查：`static/js/app.js` 中其他 22 处内联 onclick 均使用数字 ID 或系统字母（A/B/C/D），不存在同类风险
