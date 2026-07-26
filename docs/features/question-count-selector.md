# 自定义题目数量 + 默认选中题库

**日期：** 见文件修改时间  &emsp; **关联 PRD：** [exam-platform.md](../prd/exam-platform.md)


## 目标
1. 答题设置页可选择子集题数，支持滑块拖动、数字输入和快捷按钮（10/20/50）
2. 进入答题设置页时默认选中第一个题库

## 修改范围

### 后端
- `models.py` — `ExamRecord` 新增 `question_ids`（JSON 字段，存储子集题目 ID）
- `schemas.py` — `ExamStart` 新增可选字段 `question_count: Optional[int]`
- `routers/exam.py` — `start_exam` 中若 `question_count < 可用题数` 则随机抽子集并写入 `question_ids`；`_load_all_exam_questions` 中若 `question_ids` 存在则过滤

### 前端
- `static/js/app.js` — 设置页新增"题目数量"卡片（全部/自定义 + 滑块 + 输入 + 快捷按钮联动）；渲染后默认选中首个题库
- `static/css/style.css` — `.question-count-*` 样式

## 核心实现

### 子集选取（后端）
```python
if data.question_count and data.question_count < len(questions):
    selected = random.sample(questions, data.question_count)
    question_ids = [q.id for q in selected]
```
每次开考独立随机抽样，结果写入 `question_ids` 快照；恢复/回看均读快照，不依赖抽样可复算。
（历史：最初用固定种子保证同组合抽题一致，#12 将 hash() 换成 crc32 修复重启不稳定；
#144 确认固定种子导致同一用户永远抽到同一子集且对恢复功能无实际作用，已改为真随机。）

### 前端联动
- 勾选"全部题目" → 不传 `question_count`，行为不变
- 取消勾选 → 启用控件，默认填可用总数
- 滑块/输入/快捷按钮三者同步
- 切换题库时 `updateQuestionCount()` 重新计算可用总数和快捷按钮

## 验证方式
```bash
python test_integration.py
# === All 27 tests passed! ===
```
