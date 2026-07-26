# API 参考

所有接口（除注册/登录外）需在请求头携带 `Authorization: Bearer <token>`。

通用状态码：
- `200` — 成功
- `201` — 创建成功
- `204` — 删除成功（无响应体）
- `400` — 请求参数错误
- `401` — 未认证 / Token 无效
- `404` — 资源不存在
- `429` — 请求过于频繁，请稍后重试

---

## 认证

### POST /api/auth/register

注册新用户，自动返回 Token。

**请求体：**
```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应 (200)：**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "testuser" }
}
```

**错误：** 400 — 用户名已存在 / 用户名 < 2 字符 / 密码 < 6 字符；429 — 请求过于频繁，请稍后重试

---

### POST /api/auth/login

登录接口按客户端 IP 限流：**每分钟最多 5 次请求**，超过后返回 429。

**请求体：**
```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应 (200)：** 同 register

**错误：** 401 — 用户名或密码错误；429 — 请求过于频繁，请稍后重试

---

### GET /api/auth/me

获取当前用户信息。

**响应 (200)：**
```json
{ "id": 1, "username": "testuser" }
```

---

## 题库

### GET /api/question-banks

**响应 (200)：**
```json
[
  {
    "id": 1,
    "title": "数据结构基础",
    "description": "涵盖栈队列链表树",
    "question_count": 120,
    "created_at": "2026-05-13T10:00:00",
    "updated_at": "2026-05-13T10:00:00"
  }
]
```

---

### GET /api/question-banks/:id

**响应 (200)：**
```json
{
  "id": 1,
  "title": "数据结构基础",
  "description": "涵盖栈队列链表树",
  "question_count": 4,
  "created_at": "2026-05-13T10:00:00",
  "updated_at": "2026-05-13T10:00:00",
  "questions": [
    {
      "id": 1,
      "type": "choice",
      "chapter": "第一章",
      "content": "1+1=?",
      "options": "[\"1\", \"2\", \"3\", \"4\"]",
      "answer": "B",
      "analysis": "1+1=2",
      "sort_order": 0
    }
  ]
}
```

注意：`options` 和 `answer` 在本题库详情接口中为原始数据库值，未反序列化。在答题预览（`/api/exam/:id/preview`）和结果（`/api/exam/:id/result`）接口中，`options` 会反序列化为 JSON 数组。

---

### POST /api/question-banks/import

单题库导入。

**请求体：**
```json
{
  "title": "数据结构基础",
  "description": "可选描述",
  "questions": [
    {
      "type": "choice",
      "chapter": "第一章",
      "content": "1+1=?",
      "options": ["1", "2", "3", "4"],
      "answer": "B",
      "analysis": "可选解析"
    },
    {
      "type": "fill",
      "content": "中国首都是____。",
      "answer": "北京"
    },
    {
      "type": "fill",
      "content": "四大发明是____、____、____和____。",
      "answer": ["造纸术", "印刷术", "火药", "指南针"]
    },
    {
      "type": "judge",
      "content": "地球是圆的",
      "answer": "对"
    }
  ]
}
```

**响应 (201)：**
```json
{
  "id": 1,
  "title": "数据结构基础",
  "description": "可选描述",
  "question_count": 4,
  "created_at": "2026-05-13T10:00:00",
  "updated_at": "2026-05-13T10:00:00"
}
```

**错误：** 400 — 校验失败（标题为空/题型无效/题目无内容/选择题缺选项等）

---

### POST /api/question-banks/import-multiple

批量导入，请求体为 JSON 数组，每个元素结构与 `/import` 一致。

**响应 (200)：**
```json
{
  "results": [
    { "success": true, "title": "题库A", "question_count": 10 },
    { "success": false, "title": "题库B", "error": "校验错误详情" }
  ]
}
```

部分失败不影响其他题库。失败原因在 `error` 字段中。

事务隔离：每个题库导入使用独立 savepoint，失败的单独回滚，成功的保留，循环结束后统一 commit。

---

### DELETE /api/question-banks/:id

删除题库及其下全部题目，题目关联的背题记录一并级联删除。

**响应：** 204 No Content

**错误：** 404 — 题库不存在

---

### PUT /api/question-banks/:id

更新题库标题和描述。

**请求体（全部可选，只传要更新的字段）：**
```json
{
  "title": "新标题",
  "description": "新描述"
}
```

**响应 (200)：**
```json
{
  "id": 1,
  "title": "新标题",
  "description": "新描述",
  "question_count": 10,
  "created_at": "2026-05-13T10:00:00",
  "updated_at": "2026-06-14T10:00:00"
}
```

**错误：** 400 — 标题为空；404 — 题库不存在

---

### GET /api/question-banks/:id/export

导出题库为 JSON 文件，格式与 `/import` 接口兼容。

**响应 (200)：** JSON 文件下载（`Content-Disposition: attachment`）

```json
{
  "title": "题库名称",
  "description": "描述",
  "questions": [
    {
      "type": "choice",
      "chapter": "第一章",
      "content": "1+1=?",
      "options": ["1", "2", "3", "4"],
      "answer": "B",
      "analysis": "解析"
    }
  ]
}
```

**错误：** 404 — 题库不存在

---

### POST /api/question-banks/:bank_id/questions

在指定题库中新增一道题目。

**请求体：**
```json
{
  "type": "choice",
  "chapter": "第一章",
  "content": "1+1=?",
  "options": ["1", "2", "3", "4"],
  "answer": "B",
  "analysis": "可选解析"
}
```

`type` 可选 `choice` / `fill` / `judge` / `multiple`。不同题型要求：
- choice：`options` 至少 2 项，`answer` 为选项字母（如 `"B"`）
- multiple：`options` 至少 2 项，`answer` 为字母数组（如 `["A", "C"]`）
- fill：`answer` 为字符串或数组（多空），不传 `options`
- judge：`answer` 为 `"对"` 或 `"错"`，不传 `options`

**响应 (201)：**
```json
{
  "id": 10,
  "type": "choice",
  "chapter": "第一章",
  "content": "1+1=?",
  "options": "[\"1\", \"2\", \"3\", \"4\"]",
  "answer": "B",
  "analysis": "可选解析",
  "sort_order": 5
}
```

**错误：** 400 — 校验失败；404 — 题库不存在

---

### PUT /api/questions/:id

编辑题目。支持部分更新和切换题型。

**请求体（全部可选）：**
```json
{
  "type": "fill",
  "content": "1+1=?",
  "analysis": "2"
}
```

切换题型（如 choice → fill）会自动清理 options 字段。

**响应 (200)：** 同新增题目响应

**错误：** 400 — 校验失败；404 — 题目不存在

---

### DELETE /api/questions/:id

删除一道题目。关联的背题记录（`review_records`）一并级联删除，背题统计随之回落；答题记录保留、`question_id` 置空，历史详情中不展示已删除题目。

**响应：** 204 No Content

**错误：** 404 — 题目不存在

---

## 答题

### POST /api/exam/start

**请求体：**
```json
{
  "bank_ids": [1, 2],
  "mode": "sequential",
  "types": ["choice", "fill", "judge"],
  "question_count": null,
  "timer_mode": "per_question",
  "chapters": null,
  "choice_timeout": 30,
  "judge_fill_timeout": 60
}
```

| 字段 | 说明 |
|------|------|
| `bank_ids` | 必填，至少一个题库 ID |
| `mode` | `"sequential"` 按排序出题 / `"random"` 打乱 |
| `types` | 题型筛选，缺省返回全部 |
| `question_count` | 随机抽取题数，null 或 ≥ 可用题数则全部 |
| `timer_mode` | `"per_question"` 单题计时 / `"elapsed"` 整卷计时 |
| `chapters` | 章节筛选（数组），缺省返回全部章节 |
| `choice_timeout` | 选择题倒计时秒数（per_question 模式，默认 30） |
| `judge_fill_timeout` | 填空/判断题倒计时秒数（默认 60） |

多选题倒计时参数 `multi_choice_timeout`（默认 45）为前端独立管理，不传送至后端。

**响应 (200)：**
```json
{
  "exam_id": 42,
  "total_count": 20,
  "timer_mode": "per_question",
  "started_at": "2026-05-13T10:00:00"
}
```

**错误：** 400 — 题库不存在 / 没有符合条件的题目

---

### GET /api/exam/:id/current

获取当前题或指定题。

**查询参数：**
- `index`（可选）— 指定题目索引（0-based），不传则返回第一道未答题

注意：`current_index` 为 1-based（第几题），`index` 查询参数为 0-based。

`question.blank_count`：填空题空位数量（单空为 `1`，多空为空位数），非填空题为 `null`。未作答时 `answer` 被隐藏，前端依据该字段渲染对应数量的输入框（issue #82）。

**响应 (200)——有下一题且未指定 index：**
```json
{
  "exam_id": 42,
  "current_index": 5,
  "total_count": 20,
  "question": {
    "id": 7,
    "type": "choice",
    "chapter": "第一章",
    "content": "1+1=?",
    "options": "[\"1\", \"2\", \"3\", \"4\"]",
    "answer": null,
    "analysis": null,
    "sort_order": 0,
    "blank_count": null
  },
  "is_answered": false,
  "user_answer": null,
  "is_correct": null,
  "correct_answer": null
}
```

**响应——指定 index 且已答题：**
```json
{
  "exam_id": 42,
  "current_index": 5,
  "total_count": 20,
  "question": {
    "id": 7,
    "type": "choice",
    "chapter": "第一章",
    "content": "1+1=?",
    "options": "[\"1\", \"2\", \"3\", \"4\"]",
    "answer": "B",
    "analysis": "1+1=2",
    "sort_order": 0
  },
  "is_answered": true,
  "user_answer": "B",
  "is_correct": true,
  "correct_answer": "B"
}
```

`user_answer` / `correct_answer` 类型随题型变化：多选题、多空填空题为字符串数组（如 `["A", "B"]`），其余题型为字符串，与结果页/历史详情接口口径一致（issue #111）。

**响应——所有题已答完（无 index 参数时）：**
```json
{
  "exam_id": 42,
  "current_index": 20,
  "total_count": 20,
  "question": null
}
```

**错误：** 400 — index 超出范围；404 — 练习不存在

---

### POST /api/exam/:id/answer

**请求体：**
```json
{
  "exam_id": 42,
  "question_id": 7,
  "user_answer": "B",
  "time_spent_seconds": 15,
  "elapsed_seconds": 120
}
```

`elapsed_seconds` 可选（≥0）：整卷计时模式下前端计时器口径的已用秒数（不含暂停时长）。仅在本次提交完成最后一题、练习自动结束时生效，作为 `duration_seconds` 采用值，并以 `finished_at - started_at` 墙钟差值封顶；不传则回退墙钟差值（issue #115）。

`user_answer` 规则：
- 选择题：选项字母字符串（如 `"B"`）
- 填空题单空：字符串（如 `"北京"`）
- 填空题多空：字符串数组（如 `["造纸术", "印刷术", "火药", "指南针"]`）
- 判断题：`"对"` 或 `"错"`
- 多选题：选项字母数组（如 `["A", "C"]`）

**响应 (200)：**
```json
{
  "is_correct": true,
  "correct_answer": "B",
  "analysis": "1+1=2",
  "next_index": 5,
  "is_last": false
}
```

若 `is_last == true`，表示所有题目已答完，练习自动结束。

---

### GET /api/exam/:id/progress

**响应 (200)：**
```json
{
  "total_count": 20,
  "current_index": 0,
  "answers": [
    { "index": 0, "is_correct": true },
    { "index": 3, "is_correct": false }
  ]
}
```

`answers` 只包含已答题索引，未答不出现。用于前端渲染题号侧边栏。

---

### GET /api/exam/:id/preview

整卷预览，所有题目 + 答案 + 用户答案（如有）。

**响应 (200)：**
```json
{
  "total_count": 20,
  "questions": [
    {
      "index": 0,
      "id": 7,
      "type": "choice",
      "chapter": "第一章",
      "content": "1+1=?",
      "options": ["1", "2", "3", "4"],
      "answer": "B",
      "analysis": "1+1=2",
      "user_answer": "B",
      "is_answered": true,
      "is_correct": true,
      "blank_count": null
    }
  ]
}
```

`blank_count` 含义与 `/current` 接口一致：填空题为空位数量，其余题型为 `null`（issue #82）。

---

### POST /api/exam/:id/finish

手动结束练习。如已结束则幂等返回。

**请求体（可选）：**
```json
{ "elapsed_seconds": 120 }
```

`elapsed_seconds` 可选（≥0）：整卷计时模式下前端计时器口径的已用秒数（不含暂停时长），作为 `duration_seconds` 采用值，并以墙钟差值封顶；不传或传 `{}` 则回退墙钟差值（issue #115）。

**响应 (200)：**
```json
{ "exam_id": 42, "status": "completed" }
```

---

### GET /api/exam/:id/result

**响应 (200)：**
```json
{
  "exam_id": 42,
  "total_count": 20,
  "correct_count": 16,
  "wrong_count": 4,
  "accuracy": 0.8,
  "duration_seconds": 515,
  "answers": [
    {
      "question_id": 7,
      "type": "choice",
      "content": "1+1=?",
      "options": ["1", "2", "3", "4"],
      "correct_answer": "B",
      "user_answer": "B",
      "is_correct": true,
      "time_spent": 15,
      "analysis": "1+1=2"
    }
  ]
}
```

`answers` 按答题顺序排列。`accuracy` 为 0~1 的小数。

---

## 练习历史

### GET /api/history?page=1&page_size=20

**响应 (200)：**
```json
[
  {
    "id": 42,
    "bank_ids": "[1, 2]",
    "mode": "sequential",
    "question_count": 20,
    "correct_count": 16,
    "wrong_count": 4,
    "accuracy": 0.8,
    "duration_seconds": 515,
    "started_at": "2026-05-13T10:00:00"
  }
]
```

只返回 `status == "completed"` 的记录，按时间倒序。

---

### GET /api/history/:id

复用 `/api/exam/:id/result` 的响应格式。用于查看历史详情。

---

## 错题本

### GET /api/wrong-answers

**响应 (200)：**
```json
[
  {
    "question_id": 7,
    "bank_title": "数据结构基础",
    "type": "choice",
    "chapter": "第一章",
    "content": "1+1=?",
    "options": ["1", "2", "3", "4"],
    "correct_answer": "B",
    "user_answer": "A",
    "analysis": "1+1=2"
  }
]
```

- 按答题时间倒序
- 同题目多答只保留最近一次
- 按 `bank_title` 分组由前端处理

---

## 仪表盘

### GET /api/dashboard

**响应 (200)：**
```json
{
  "total_banks": 5,
  "total_questions": 360,
  "total_exams": 42,
  "average_accuracy": 0.78,
  "recent_exams": [
    {
      "id": 42,
      "bank_ids": "[1]",
      "mode": "sequential",
      "question_count": 20,
      "correct_count": 16,
      "wrong_count": 4,
      "accuracy": 0.8,
      "duration_seconds": 515,
      "started_at": "2026-05-13T10:00:00"
    }
  ]
}
```

`average_accuracy` 基于所有已完成练习的累计正确/错误总数计算，非平均值。`recent_exams` 为最近 5 条。

---

## 背题

### POST /api/review/questions

**请求体：**
```json
{
  "bank_ids": [1, 2],
  "types": ["choice", "fill"],
  "chapters": ["第一章"],
  "show_reviewing_only": false
}
```

| 字段 | 说明 |
|------|------|
| `bank_ids` | 必填 |
| `types` | 筛选题型，缺省返回全部 |
| `chapters` | 章节筛选（数组，支持多选），缺省返回全部章节 |
| `show_reviewing_only` | 为 `true` 时排除 `status == "known"` 的题目 |

**响应 (200)：**
```json
[
  {
    "id": 1,
    "type": "choice",
    "chapter": "第一章",
    "content": "1+1=?",
    "options": "[\"1\", \"2\", \"3\", \"4\"]",
    "answer": "B",
    "analysis": "1+1=2",
    "sort_order": 0,
    "review_status": "known"
  }
]
```

未标记过时 `review_status` 为 `null`。背题模式下答案始终可见。

---

### POST /api/review/mark

**请求体：**
```json
{
  "question_id": 1,
  "status": "known"
}
```

`status` 可选 `"known"`（已掌握）或 `"reviewing"`（待复习）。

**响应 (200)：** 与 `GET /api/review/stats` 同口径的最新统计。
```json
{
  "known_count": 5,
  "reviewing_count": 3,
  "total_reviewed": 8
}
```

---

### GET /api/review/stats

**响应 (200)：**
```json
{
  "known_count": 5,
  "reviewing_count": 3,
  "total_reviewed": 8
}
```

统计只计入当前用户仍存在的题目：删除题目或题库后，对应计数会回落（issue #84）。`total_reviewed` 为两者之和。

---

### POST /api/review/chapters

获取所选题库的章节列表（去重），用于背题模式中的章节多选筛选。

**请求体：**
```json
{
  "bank_ids": [1, 2]
}
```

**响应 (200)：**
```json
["第一章", "第二章", "第三章"]
```

---

## 错题练习

### POST /api/wrong-answers/start

从错题本中筛选错题，创建一场错题练习。

**请求体：**
```json
{
  "bank_ids": [1],
  "timer_mode": "per_question"
}
```

| 字段 | 说明 |
|------|------|
| `bank_ids` | 可选，指定题库范围；缺省则包含所有错题 |
| `timer_mode` | `"per_question"` 或 `"elapsed"`，默认 `"per_question"` |

**响应 (200)：**
```json
{
  "exam_id": 43,
  "total_count": 8
}
```

**错误：** 400 — 没有错题 / 所选题库中没有错题

---

## 健康检查

### GET /api/health

**响应 (200)：**
```json
{ "status": "ok" }
```

无认证要求。用于 Docker healthcheck 和部署验证。
