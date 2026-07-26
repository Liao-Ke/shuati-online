# 数据库设计: 刷题在线

**数据库类型：** SQLite 3
**真相源：** `models.py` + `alembic/versions/` 迁移文件

## 表清单

| 表名 | 说明 |
|------|------|
| `users` | 用户账号 |
| `question_banks` | 题库 |
| `questions` | 题目 |
| `exam_records` | 答题会话 |
| `answer_records` | 答题记录 |
| `review_records` | 背题掌握标记 |

---

## Users

**说明：** 用户账号表。单用户无角色体系。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK | | 用户 ID |
| `username` | String(50) | UNIQUE, NOT NULL, INDEX | | 用户名，登录凭证 |
| `password_hash` | String(128) | NOT NULL | | bcrypt 哈希值 |
| `created_at` | DateTime | | `utcnow()` | 注册时间 |

**索引：** `username` 唯一索引。

---

## QuestionBanks

**说明：** 题库容器。属于一个用户，删除时连带删除所有关联题目和背题记录（ORM 级联；DB 外键自 #131 起强制，仅兜底拦截绕过 ORM 的删除）。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK, AUTOINCREMENT | | 题库 ID，单调递增不复用（#131） |
| `user_id` | Integer | FK → users.id, NOT NULL | | 所属用户 |
| `title` | String(200) | NOT NULL | | 题库名称，如"数据结构基础" |
| `description` | Text | NULLABLE | | 题库描述 |
| `created_at` | DateTime | | `utcnow()` | 创建时间 |
| `updated_at` | DateTime | | `utcnow()` | 更新时间，ORM onupdate 自动维护 |

**索引：** `user_id` 上的普通索引（外键索引）。

---

## Questions

**说明：** 题目表。支持 choice / fill / judge / multiple 四种题型。选项和答案字段使用 Text 列存储 JSON 字符串（SQLite 无原生 JSON 列类型）。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK, AUTOINCREMENT | | 题目 ID，单调递增不复用（#131） |
| `bank_id` | Integer | FK → question_banks.id, NOT NULL | | 所属题库 |
| `type` | String(10) | NOT NULL | | 题型：`choice` / `fill` / `judge` / `multiple` |
| `chapter` | String(200) | NULLABLE | | 章节名称，如"第一章 基础" |
| `content` | Text | NOT NULL | | 题目正文，填空用 `____` 占位 |
| `options` | Text | NULLABLE | | JSON 数组字符串，如 `'["1","2"]'`；choice/multiple 使用，fill/judge 为 null |
| `answer` | Text | NOT NULL | | 单空/判断为普通字符串；多空/multiple 为 JSON 数组字符串 |
| `analysis` | Text | NULLABLE | | 题目解析 |
| `sort_order` | Integer | | 0 | 排序序号，同一题库内按此字段+ID 排序 |

**索引：** `bank_id` 上普通索引（外键索引，联表查询常用）。

---

## ExamRecords

**说明：** 一次答题会话。记录答题的设置、进度和统计结果。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK | | 答题记录 ID |
| `user_id` | Integer | FK → users.id, NOT NULL | | 用户 |
| `bank_ids` | Text | NOT NULL | | JSON 数组，所选题库 ID 列表 |
| `mode` | String(10) | NOT NULL | | `sequential`（顺序）或 `random`（随机） |
| `question_count` | Integer | | 0 | 题目总数 |
| `question_ids` | Text | NULLABLE | | JSON 数组或 null；随机抽题子集时记录选中题目 ID 列表 |
| `correct_count` | Integer | | 0 | 正确数 |
| `wrong_count` | Integer | | 0 | 错误数 |
| `duration_seconds` | Integer | | 0 | 总用时（秒） |
| `status` | String(15) | | `in_progress` | `in_progress`（进行中）或 `completed`（已完成） |
| `timer_mode` | String(15) | | `per_question` | `per_question`（单题计时）或 `elapsed`（整卷计时） |
| `started_at` | DateTime | | `utcnow()` | 开始时间 |
| `finished_at` | DateTime | NULLABLE | | 完成时间 |

**索引：** `user_id` 上普通索引。

---

## AnswerRecords

**说明：** 每道题的答题记录。记录用户的答案和批改结果。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK | | 答题记录 ID |
| `exam_id` | Integer | FK → exam_records.id, NOT NULL | | 所属答题会话 |
| `question_id` | Integer | FK → questions.id, NULLABLE | | 题目 ID（可为 null 兼容题目删除后历史可查） |
| `user_answer` | Text | NULLABLE | | 用户答案。普通字符串或 JSON 数组字符串 |
| `is_correct` | Boolean | | false | 批改结果 |
| `time_spent_seconds` | Integer | | 0 | 本题用时（秒） |
| `answered_at` | DateTime | | `utcnow()` | 作答时间 |

**索引：** `exam_id` 上普通索引（按会话查询）；`question_id` 上普通索引。

---

## ReviewRecords

**说明：** 背题模式中的掌握标记。每个用户 + 题目只有一条记录。

| 字段 | 类型 | 约束 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | Integer | PK | | 记录 ID |
| `user_id` | Integer | FK → users.id, NOT NULL | | 用户 |
| `question_id` | Integer | FK → questions.id, NOT NULL | | 题目 ID（题目删除时本记录级联删除） |
| `status` | String(20) | | `reviewing` | `known`（已掌握）或 `reviewing`（待复习） |
| `reviewed_at` | DateTime | | `utcnow()` | 最近标记时间 |
| `review_count` | Integer | | 1 | 累计标记次数 |

**唯一约束：** `(user_id, question_id)` 联合唯一 (`uq_user_question_review`)。

**级联：** 删除 `Question` 时本表记录随之删除，见下文「题目删除时关联记录的两种策略」。

---

## 关键设计说明

### 为什么 JSON 字段用 Text 列而非 SQLite JSON 类型

SQLite 3.38+ 支持 `JSON` 数据类型，但为保持与更广泛版本的兼容性，项目中所有列表/数组字段均存储为 `Text` 列 + JSON 字符串。反序列化统一使用 `utils.parse_json_field()` 函数，避免在各路由中重复 `startswith("[")` + `json.loads()` + `try/except`。

### 为什么 `answer` 字段不拆分

题目答案（`Question.answer`）和用户答案（`AnswerRecord.user_answer`）可能为字符串（单空、判断）或 JSON 数组（多空、多选）。使用单一 `Text` 列 + 调用方判断 `json.loads()` 的序列化策略，避免了字符串和复合类型分表存储的复杂度。

### UTC naive datetime 策略

所有时间字段使用 `datetime.now(timezone.utc).replace(tzinfo=None)` 生成。SQLite 默认不存储时区信息，统一使用 UTC naive datetime 避免时区混乱。前端展示时由 JS 转换为本地时间。

### 题目删除时关联记录的两种策略

两张引用 `questions.id` 的表刻意采用了相反的策略：

| 表 | 策略 | 理由 |
|------|------|------|
| `answer_records` | `question_id` 置空保留 | 属于历史答卷，题目删除后成绩单仍需可查，留痕优先 |
| `review_records` | 级联删除 | 表达的是「当前掌握状态」，题目不存在时该状态没有任何含义 |

`review_records` 必须真删而不能只在查询时过滤：掌握状态在题目不存在后没有任何含义。历史上（#131 之前）这里还叠加了主键复用问题——`questions` 主键无 `AUTOINCREMENT` 时，删除最大 id 的题目后新增题目会复用该 id，残留记录被全新题目继承，表现为从未标记过的题目直接显示「已掌握」。级联在 ORM 层实现（`Question.review_records` 的 `cascade="all, delete-orphan"`），删除题库时经由 `QuestionBank.questions` 逐级触发。

存量孤儿记录由 migration `afa1757b2ecd` 一次性清理，该迁移不可回滚（无备份）。

### 主键 AUTOINCREMENT 与外键强制（issue #131）

SQLite 普通 `INTEGER PRIMARY KEY` 是 rowid 别名，会复用已删除行的 id。「考试快照/答题记录里存的 id」与「id 指向的行」之间只要存在时间差，删除+复用就能让旧 id 重新指向他人（或另一道）题目——这是 #84/#123/#125 一整类跨用户缺口的共同根因。

- **`questions` / `question_banks` 主键带 `AUTOINCREMENT`**（models.py `sqlite_autoincrement=True`，migration `3159d3fe4acc` 重建两表）：id 单调递增永不复用，快照里的 id 永远指向同一行或「已删除」。迁移同时把 `sqlite_sequence` 过种子到历史引用过的最大 id（含答题记录和快照 JSON 里已删除的高位 id），堵住迁移前已释放 id 被复用一次的残余缺口。种子候选按 `SEED_MAX_GAP` 钳制：`exam_records.bank_ids` 存的是客户端原样提交的整数列表（#125），未钳制时一次请求即可顶爆序列让全站建库报 `SQLITE_FULL`。
- **其余四张表保持普通 rowid 主键**——判据是「id 是否被外部存储引用」，不是「是否会被删除」：`users`/`exam_records`/`answer_records` 无删除路径；`review_records` 有级联删除、id 确实会复用，但它不出现在任何快照、外键或接口响应里，复用无从被旧引用指向。**未来若新增保存 `review_records.id` 的功能（如复习会话快照），需要一并加 `AUTOINCREMENT`。**
- **应用连接强制 `PRAGMA foreign_keys=ON`**（database.py connect 事件）：绕过 ORM 的原生 SQL 删除会被外键直接拦截，不再产生悬垂引用。仅挂在应用 engine 实例上，alembic 迁移连接保持外键关闭以支持 batch 整表重建。
- #123/#130 引入的取题归属校验（join `QuestionBank.user_id`）保留为纵深防御。

### 唯一索引选择

`ReviewRecords` 使用 `UniqueConstraint("user_id", "question_id")` 而非普通唯一索引，因为这是业务语义约束——每个用户对每道题只能有一个掌握状态。`username` 直接设 `unique=True` 是 SQLAlchemy 语法糖，效果等价于唯一索引。
