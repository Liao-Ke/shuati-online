# 修复练习历史分页控件（#15）

**日期：** 见文件修改时间  &emsp; **关联 Issue：** #15

## 目标

后端 `GET /api/history` 已实现 `page`/`page_size` 分页，前端 API 层 `getHistory(page)` 也接受 `page` 参数，但历史页路由始终只请求第 1 页且无分页控件，超过 20 条记录后更早记录无法查看。本次补齐前端分页 UI，让用户能翻页浏览全部练习记录。

## 修改范围

- `static/js/app.js`：`/history` 路由

## 核心实现

1. 将 `/history` 路由体抽为全局函数 `loadHistory(page)`，路由入口固定调用 `loadHistory(1)`。
2. `loadHistory(page)`：
   - 调用 `api.getHistory(page)` 取当前页数据
   - 渲染列表后追加分页导航（上一页 / 第 N 页 / 下一页）
   - `hasMore = list.length >= pageSize(20)` 判断是否还有下一页；返回数 < page_size 即到底
   - 翻过头到达空页（`empty && page > 1`）时仍显示分页控件以便回退，并提示"没有更多记录"
   - 第 1 页且空时不显示分页控件
3. 上一页/下一页按钮内联 `onclick="loadHistory(N)"`。`app.js` 为经典脚本，顶层 `function` 声明为全局，可被内联处理器调用。

## 影响范围

- 仅前端历史列表页的分页 UI
- 后端接口、API 层签名、历史详情页、其他路由均不改动

## 验证方式

1. `node --check static/js/app.js` 语法通过
2. `pytest test_integration.py` 52 项集成测试全部通过（无后端改动，仅回归确认）
3. 边界：第 1 页空 → 只显示"还没有练习记录"；page > 1 空 → "没有更多记录" + 可回退上一页；满 20 条 → 下一页可用

## 已知限制

- "是否有下一页"基于 `list.length >= page_size` 推断，未单独请求总数。当某页正好等于 20 且为最后一页时，点下一页会显示一个空页再加"没有更多记录"，多一次无害请求且能正常回退，符合 issue #15 建议实现。
- 分页状态不写入 URL hash，刷新页面回到第 1 页（与原行为一致）。