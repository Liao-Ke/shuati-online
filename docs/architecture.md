# 架构设计文档

## 1. 项目概览

**刷题在线** 是一个轻量级单页 Web 应用，后端 FastAPI + SQLite，前端原生 JavaScript + Bootstrap 5。

**技术选型理由**：

| 选型 | 理由 |
|------|------|
| FastAPI | Python 生态，自动 OpenAPI 文档，依赖注入简洁 |
| SQLite | 个人场景无需独立数据库，零运维，文件即数据库 |
| 原生 JS + Bootstrap | 无构建步骤，页面简单无需框架，CDN 加载即可运行 |
| JWT | 无状态认证，不需 session 存储，7 天过期够用 |

---

## 2. 模块职责

### 后端核心

| 文件 | 职责 |
|------|------|
| `main.py` | FastAPI 入口，`Base.metadata.create_all()` 自动建表，挂载 7 个路由和静态文件 |
| `database.py` | SQLAlchemy engine + SessionLocal + `get_db` 依赖注入 |
| `models.py` | 6 个 ORM 模型，全项目唯一的数据层 |
| `schemas.py` | Pydantic 请求/响应模型，不含业务逻辑 |
| `auth.py` | JWT 签发/验证、密码 hash、`get_current_user` 依赖 |

### 后端路由

| 文件 | 职责 |
|------|------|
| `routers/auth.py` | 注册/登录/获取当前用户 |
| `routers/banks.py` | 题库 CRUD + JSON 导入校验 + 批量导入 |
| `routers/exam.py` | 答题全流程：开始、出题、提交、结果、进度导航 |
| `routers/history.py` | 分页历史列表 + 详情（复用 exam result） |
| `routers/dashboard.py` | 聚合统计（题库数、题数、练习次数、正确率） |
| `routers/wrong_answers.py` | 错题列表，按题库分组，去重 |
| `routers/review.py` | 背题模式：筛选题目、标记掌握状态、统计 |

### 前端

| 文件 | 职责 |
|------|------|
| `static/index.html` | SPA 入口，导航栏 + 内容区 + 加载中占位 |
| `static/css/style.css` | 自定义样式（与 Bootstrap 互补） |
| `static/js/api.js` | API 调用层，封装 fetch + token 处理 |
| `static/js/app.js` | 页面路由 + 事件绑定 + DOM 渲染 |

---

## 3. ER 关系

```
┌──────────────┐        ┌──────────────────┐
│     User     │        │  QuestionBank    │
│──────────────│        │──────────────────│
│ id (PK)      │──1:N──→│ id (PK)          │
│ username     │        │ user_id (FK)     │
│ password_hash│        │ title            │
│              │        │ description      │
└──────────────┘        └────────┬─────────┘
                                 │ 1:N
                                 │
                    ┌────────────▼──────────┐
                    │       Question        │
                    │───────────────────────│
                    │ id (PK)               │
                    │ bank_id (FK)          │
                    │ type (choice/fill/judge)│
                    │ chapter, content       │
                    │ options (JSON str|null)│
                    │ answer (str/JSON str)  │
                    │ analysis               │
                    └────────────┬───────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │ 1:N              │ 1:N              │ 1:N
              │                  │                  │
   ┌──────────▼──────────┐  ┌───▼──────────┐  ┌────▼─────────┐
   │    ExamRecord       │  │ AnswerRecord │  │ ReviewRecord │
   │─────────────────────│  │──────────────│  │──────────────│
   │ id (PK)             │  │ id (PK)      │  │ id (PK)      │
   │ user_id (FK)        │──│ exam_id (FK) │  │ user_id (FK) │
   │ bank_ids (JSON str) │  │ question_id  │  │ question_id  │
   │ mode (seq/random)   │  │ user_answer  │  │ status       │
   │ question_count      │  │ is_correct   │  │ review_count │
   │ question_ids (JSON) │  │ time_spent   │  │ (uq: user_id │
   │ status (in_progress │  └──────────────┘  │  + question) │
   │  /completed)        │                    └──────────────┘
   │ timer_mode          │
   └─────────────────────┘
```

---

## 4. 关键业务流程

### 4.1 答题流程

```
[用户]                    [前端]                     [后端]
  │                         │                         │
  │ 选择题库/模式/题型/题数  │                         │
  │────────────────────────→│                         │
  │                         │ POST /api/exam/start    │
  │                         │────────────────────────→│
  │                         │                         │─ 查询题库
  │                         │                         │─ 按题型过滤
  │                         │                         │─ 随机抽子集（可选）
  │                         │                         │─ 创建 ExamRecord
  │                         │←─ {exam_id, total} ─────│
  │                         │                         │
  │ 看到第一题               │                         │
  │────────────────────────→│                         │
  │                         │ GET /exam/{id}/current  │
  │                         │────────────────────────→│
  │                         │←─ question (hide answer)│
  │                         │                         │
  │ 提交答案                 │                         │
  │────────────────────────→│                         │
  │                         │ POST /exam/{id}/answer  │
  │                         │────────────────────────→│
  │                         │                         │─ 批改（字符串比较）
  │                         │                         │─ 创建 AnswerRecord
  │                         │                         │─ 更新 correct/wrong count
  │                         │←─ {is_correct, 解析} ───│
  │                         │                         │
  │ 看到下一题（循环）       │                         │
  │ 直到最后一题提交后        │                         │
  │────────────────────────→│  GET /exam/{id}/result  │
  │                         │────────────────────────→│
  │                         │←─ ExamResult ───────────│
```

### 4.2 背题流程

```
POST /api/review/questions  ─→ 按 bank_ids + types + chapter 筛选
                               LEFT JOIN ReviewRecord 获取标记状态
                               show_reviewing_only 过滤已掌握
                             ─→ 返回题目列表（答案可见）

POST /api/review/mark       ─→ Upsert ReviewRecord
                               status 切换 known ↔ reviewing
                               review_count + 1
                             ─→ 返回最新统计

GET /api/review/stats       ─→ 汇总 known / reviewing 数量
```

### 4.3 错题收集流程

```
提交答案 (is_correct=False)
  → AnswerRecord 写入数据库
  → GET /api/wrong-answers
    → 查询所有 is_correct=False 的 AnswerRecord
    → JOIN Question 获取题目内容
    → 按 question_id 去重（保留最近一次）
    → 按题库名称分组返回
```

### 4.4 出题逻辑

```python
all_questions = 所有选中题库的题目
if 题型筛选:    过滤 type
if 随机模式:    random.shuffle(seed=exam.id)
else:           按 bank_id + sort_order + id 排序
if question_ids: 过滤到选中的子集
```

子集选取使用确定性种子 `random.seed(user.id + hash(str(bank_ids)) + question_count)`，保证同一用户+题库+题数的组合每次抽取结果一致。

---

## 5. JSON 序列化约定

由于 SQLite 不支持原生数组/JSON 列类型，项目中所有列表字段均存为 `Text` 列 + JSON 字符串：

| 存放位置 | 字段 | 存储值 | 反序列化判断 |
|----------|------|--------|-------------|
| ExamRecord | bank_ids | `"[1, 2, 3]"` | 总是 JSON |
| ExamRecord | question_ids | `"[4, 7, 12]"` 或 `null` | 非 null 则 JSON |
| Question | options | `'["A. 1", "B. 2"]'` 或 `null` | 非 null 则 JSON |
| Question | answer | 多空填空时 `'["纸","印刷"]'`；其他为普通字符串 | `startswith("[")` |
| AnswerRecord | user_answer | 列表答案时 `'["答案1","答案2"]'`；否则原始字符串 | `startswith("[")` |

**判断规律**：所有列表字段序列化后以 `[` 开头。填空多空场景下 `answer` 和 `user_answer` 都用 JSON 数组。

---

## 6. 前端架构

### Hash 路由映射

| Hash | 页面 | 认证要求 |
|------|------|----------|
| `#/login` | 登录 | 未登录 |
| `#/register` | 注册 | 未登录 |
| `#/dashboard` | 仪表盘 | 已登录 |
| `#/banks` | 题库列表 | 已登录 |
| `#/banks/:id` | 题库详情 | 已登录 |
| `#/exam/setup` | 答题设置 | 已登录 |
| `#/exam` | 答题中 | 已登录 |
| `#/result/:id` | 答题结果 | 已登录 |
| `#/review/setup` | 背题设置 | 已登录 |
| `#/review` | 背题中 | 已登录 |
| `#/history` | 练习历史 | 已登录 |
| `#/history/:id` | 历史详情 | 已登录 |
| `#/wrong-answers` | 错题本 | 已登录 |

### 状态管理

前端无框架，状态直接挂在全局变量上：

| 变量 | 用途 |
|------|------|
| `window.apiToken` | JWT token |
| `window.currentUser` | 当前用户信息 |
| `window.examCurrentIndex` | 答题中当前题号（1-based） |

`api.js` 封装所有 `fetch` 调用，自动附带 `Authorization` header，401 时跳转登录页。

### 渲染模式

每个路由对应一个 `renderXxxPage()` 函数，每次切换路由时先 `document.getElementById('content').innerHTML = ''` 清空，再渲染新页面。不维护虚拟 DOM，不比较 diff。

---

## 7. 已知限制与技术债务

| 问题 | 影响 | 可能方案 |
|------|------|----------|
| SQLite 不支持并发写 | 多个请求同时写数据库可能报错 | SQLite WAL 模式 / 切换到 PostgreSQL |
| `SECRET_KEY` 硬编码默认值 | 生产环境存在密钥泄露风险 | 已支持环境变量覆盖，需文档提示 |
| 答题中途退出不保存 | 浏览器关闭或刷新后进行中的答题丢失 | 支持暂停/恢复（前端 localStorage + 后端保存状态） |
| 无迁移系统 | 修改模型后需删库重建 | 引入 Alembic |
| 章节筛选为精确匹配 | 背题模式不支持多选或模糊筛选 | 支持 LIKE 查询或标签系统 |
| 题目不支持编辑 | 导入后发现错误只能删库重建 | 添加编辑弹窗或批量更新 API |
| 前端全局变量管理 | 页面复杂后状态容易混乱 | 引入简单的状态管理器 |
| 无数据导出 | 用户无法备份或导出自定义数据 | 添加 JSON/CSV 导出接口 |
