# 章节筛选功能

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标
在答题模式和背题模式中，支持按章节筛选题目，让用户可以只练习特定章节的内容。

## 修改范围

### 涉及文件
| 文件 | 改动 |
|------|------|
| `schemas.py` | `ReviewFilter.chapter` → `chapters`（多选）；`ExamStart` 新增 `chapters` 字段 |
| `routers/review.py` | 新增 `POST /api/review/chapters` 端点；过滤逻辑改为 `.in_(data.chapters)` |
| `routers/exam.py` | 新增章节过滤逻辑；修复 `question_ids = None` 绕过过滤的 bug |
| `static/js/api.js` | 新增 `getReviewChapters(data)` API 方法 |
| `static/js/app.js` | 背题模式和答题模式的章节筛选 UI、数据加载、事件绑定 |
| `static/css/style.css` | 追加 `.chapter-label` 悬停样式 |

### 后端
- **POST /api/review/chapters**：根据 `bank_ids` 返回去重后的章节列表（已排序）
- **背题过滤**：`ReviewFilter` 的 `chapter` 字段改为 `chapters: Optional[List[str]]`，过滤用 `.in_()`
- **答题过滤**：`ExamStart` 新增 `chapters` 字段，`start_exam` 在类型过滤后新增章节过滤
- **bug 修复**：选"全部题目"时 `question_ids = None` 会导致 `_load_all_exam_questions` 绕过过滤，改为始终存精确 ID 列表

### 前端
- **背题设置页**：章节筛选从单选 `<select>` 改为多选复选框 + 全选/取消全选 + 滚动列表（`max-height:180px`）
- **答题设置页**：题型筛选和题目数量卡片之间插入章节筛选卡片，功能与背题一致
- **事件绑定**：使用 `addEventListener` 替代内联 `oninput`，配合 `compositionend` 支持中文 IME 输入
- **搜索功能**：章节筛选最初包含搜索框（实时过滤 + 模糊搜索），后因用户体验问题移除，仅保留全选/取消全选

## 交互行为
1. 进入设置页 → 默认选中第一个题库 → 章节筛选自动加载
2. 切换/勾选/取消题库 → 章节列表动态更新
3. 全选/取消全选 → 勾选/取消所有章节复选框
4. 勾选特定章节 → 开始答题/背题 → 仅显示选中章节的题目
5. 不勾选任何章节 → 显示全部题目

## 验证方式
- 后端：POST /api/review/chapters 返回正确章节列表；POST /api/review/questions 和 POST /api/exam/start 支持 chapters 过滤
- 前端：设置页章节筛选正常显示和交互；答题/背题结果仅包含选中章节
- 回归：52 个集成测试全部通过

## 已知限制
- 章节列表复用 `POST /api/review/chapters` 接口，答题和背题模式共享同一数据源
- 搜索功能已从章节筛选中移除（用户反馈搜索体验不佳）
