# 在线刷题平台 — 设计文档

## 技术栈

| 层 | 选型 |
|---|---|
| 后端框架 | FastAPI (Python) |
| 数据库 | SQLite (通过 SQLAlchemy ORM) |
| 认证 | JWT 令牌认证（无状态） |
| 前端 | 原生 HTML/CSS/JS + Bootstrap 5 |
| 架构 | 前后端分离 SPA（单页面应用） |

## 目录结构

```
刷题在线/
├── main.py                  # FastAPI 应用入口
├── database.py              # SQLAlchemy 引擎 & 会话管理
├── models.py                # ORM 数据模型
├── schemas.py               # Pydantic 请求/响应模型
├── auth.py                  # JWT 认证逻辑
├── routers/
│   ├── __init__.py
│   ├── auth.py              # 注册/登录
│   ├── banks.py             # 题库管理
│   ├── exam.py              # 答题流程
│   ├── history.py           # 练习历史
│   └── dashboard.py         # 仪表盘聚合
├── requirements.txt
└── static/
    ├── index.html           # SPA 入口
    ├── css/
    │   └── style.css
    └── js/
        ├── app.js           # 路由 & 状态管理
        └── api.js           # HTTP 请求封装
```

## 数据模型

### User
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | 用户 ID |
| username | String(50) unique | 用户名 |
| password_hash | String(128) | bcrypt 哈希 |
| created_at | DateTime | 创建时间 |

### QuestionBank
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | 题库 ID |
| user_id | Integer FK → User | 所属用户 |
| title | String(200) | 题库名称 |
| description | Text nullable | 题库描述 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

### Question
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | 题目 ID |
| bank_id | Integer FK → QuestionBank | 所属题库 |
| type | String(10) | choice/fill/judge |
| chapter | String(200) nullable | 章节名（如"第一章 基础知识"） |
| content | Text | 题目内容 |
| options | Text nullable | JSON，仅选择题使用 |
| answer | Text | 字符串或 JSON 数组（填空多空） |
| analysis | Text nullable | 题目解析 |
| sort_order | Integer | 排序序号 |

### ExamRecord
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | 练习记录 ID |
| user_id | Integer FK → User | 用户 |
| bank_ids | Text | JSON 数组，所选题库 ID 列表 |
| mode | String(10) | random/sequential |
| question_count | Integer | 总题数 |
| correct_count | Integer | 正确数 |
| wrong_count | Integer | 错误数 |
| duration_seconds | Integer | 总用时 |
| status | String(15) | in_progress/completed |
| started_at | DateTime | 开始时间 |
| finished_at | DateTime nullable | 完成时间 |

### AnswerRecord
| 字段 | 类型 | 说明 |
|---|---|---|
| id | Integer PK | 答题记录 ID |
| exam_id | Integer FK → ExamRecord | 所属练习 |
| question_id | Integer FK → Question | 题目 |
| user_answer | Text | JSON，用户答案 |
| is_correct | Boolean | 是否正确 |
| time_spent_seconds | Integer | 该题耗时 |
| answered_at | DateTime | 答题时间 |

## 前端路由

| 路由 | 页面 | 说明 |
|---|---|---|
| `#/login` | 登录 | 用户名 + 密码 |
| `#/register` | 注册 | 用户名 + 密码 + 确认密码 |
| `#/dashboard` | 仪表盘 | 统计概览、快速开始 |
| `#/banks` | 题库管理 | 题库列表 + 导入/删除 |
| `#/banks/:id` | 题库详情 | 题目列表，按章节分组 |
| `#/exam/setup` | 答题设置 | 选择题库、模式、题型 |
| `#/exam` | 答题中 | 逐题作答，单题计时 |
| `#/result/:id` | 答题结果 | 完成后的结果页 |
| `#/history` | 练习历史 | 历史记录列表 |
| `#/history/:id` | 历史详情 | 回溯查看练习详情 |
| `#/wrong-answers` | 错题本 | 所有错题汇总 |

## API 接口

### 认证 `/api/auth`
- `POST /register` — 注册
- `POST /login` — 登录，返回 JWT
- `GET /me` — 获取当前用户信息

### 题库 `/api/question-banks`
- `GET /` — 获取当前用户的所有题库
- `POST /import` — 导入 JSON 题库
- `DELETE /{id}` — 删除题库
- `GET /{id}` — 获取题库详情（含题目列表）

### 答题 `/api/exam`
- `POST /start` — 开始答题（模式、题库、题型）
- `GET /{exam_id}/current` — 获取当前题目
- `POST /{exam_id}/answer` — 提交答案
- `GET /{exam_id}/result` — 获取答题结果

### 历史 `/api/history`
- `GET /` — 练习历史列表（分页）
- `GET /{exam_id}` — 单次练习详情

### 错题 `/api/wrong-answers`
- `GET /` — 错题列表

### 仪表盘 `/api/dashboard`
- `GET /` — 聚合统计（总练习次数、总做题数、平均正确率、最近 5 次记录）

## JSON 题库导入格式

```json
{
  "title": "题库名称",
  "description": "题库描述",
  "questions": [
    {
      "type": "choice|fill|judge",
      "chapter": "第一章 基础知识",
      "content": "题目内容",
      "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
      "answer": "A",
      "answer": ["北京", "上海"],
      "analysis": "解析（可选）"
    }
  ]
}
```

- `type` 取值：`choice`（选择）、`fill`（填空）、`judge`（判断）
- `answer`：选择题/判断题用字符串；填空题单空用字符串，多空用字符串数组
- `chapter`、`analysis`、`options`（判断题/填空题不需要）：可选

## 答题流程

1. 用户在 `#/exam/setup` 选择题库（可多选）、模式（随机/顺序）、题型（可多选）
2. 前端调用 `POST /api/exam/start`，后端生成 ExamRecord + 题目队列（不实际创建 AnswerRecord）
3. 进入 `#/exam`，前端按顺序请求 `GET /api/exam/{id}/current` 获取当前题目
4. 用户作答后调用 `POST /api/exam/{id}/answer`，后端验证并记录 AnswerRecord
5. 前端根据返回结果（是否正确、下一题 ID）跳转下一题或完成页
6. 全部完成后显示 `#/result/:id`
7. 单题计时由前端控制，提交时附带 `time_spent_seconds`

## 关键约束

- 每个用户只看到自己的题库和练习记录
- 题库导入时使用事务：全部成功或全部回滚
- 删除题库时级联删除关联的题目和答题记录
- 答题中途可退出（下次进入设为新练习，不恢复进行中的练习）
- 顺序模式按 `sort_order` + `chapter` 排序出题
- 随机模式在全量题目中随机打乱
