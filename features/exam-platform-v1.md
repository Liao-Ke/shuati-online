# 在线刷题平台

## 目标
构建一个功能完整的在线刷题平台，支持用户注册登录、题库管理（JSON 导入/删除）、
随机/顺序答题、多题库组合、单题计时、自动评分、错题记录和练习历史。

## 修改范围
在 `/home/Lsk/Documents/Code/Projects/刷题在线` 新建完整项目。

## 核心实现

### 技术栈
- **后端**: FastAPI + SQLAlchemy + SQLite + JWT 认证
- **前端**: Bootstrap 5 + 原生 JS SPA（Hash 路由）

### 后端模块
| 模块 | 文件 | 功能 |
|------|------|------|
| 数据模型 | `models.py` | User, QuestionBank, Question, ExamRecord, AnswerRecord |
| 请求校验 | `schemas.py` | Pydantic 模型，含 Answer 兼容字符串/数组 |
| 认证 | `auth.py` + `routers/auth.py` | JWT 注册/登录 |
| 题库 | `routers/banks.py` | 导入 JSON、列表、详情、删除 |
| 答题 | `routers/exam.py` | 开始、获取当前题、提交答案、结果 |
| 历史 | `routers/history.py` | 分页列表、详情 |
| 仪表盘 | `routers/dashboard.py` | 聚合统计 |
| 错题 | `routers/wrong_answers.py` | 错题列表（去重） |

### 前端 SPA 页面
| 路由 | 页面 |
|------|------|
| `#/login` | 登录 |
| `#/register` | 注册 |
| `#/dashboard` | 仪表盘 |
| `#/banks` | 题库管理 |
| `#/banks/:id` | 题库详情（按章节分组） |
| `#/exam/setup` | 答题设置（题库选择多选、模式、题型、章节筛选、计时） |
| `#/exam` | 答题中（选择题/填空题/判断题 + 单题倒计时） |
| `#/result/:id` | 答题结果（正确/错误统计、逐题反馈） |
| `#/history` | 练习历史列表 |
| `#/history/:id` | 历史详情（档案化视图） |
| `#/wrong-answers` | 错题本 |

### 关键设计
- JSON 导入的 answer 字段兼容字符串和数组（填空多空场景）
- 答题模式支持随机和顺序，支持全题型或多题型组合，支持按章节筛选
- 背题模式支持题库多选、题型筛选、章节多选筛选
- 单题计时由前端控制，超时自动提交
- 答题中途退出不保留进度（每次生成新练习）
- 错题本按题库分组，每题只保留最近一次错误记录
- 仪表盘聚合统计数据（总题库数、总题数、练习次数、平均正确率）

## 影响范围
无 — 全新项目，不涉及现有系统。

## 验证方式
`test_integration.py` 覆盖 14 项后端 API 测试：
注册 → 登录 → 导入题库 → 列表 → 开始答题 → 提交答案（选择/填空/判断） → 结果 → 错题 → 历史 → 仪表盘 → 静态文件 → 题库详情 → 删除 → 验证删除

## 已知限制
- 答题中途退出不保存进行中的练习（每次开始是新练习）
- 答案字段暴露在 current_question 中：虽然后端设为了 None，但前端 app.js 仅用于展示反馈，不做二次暴露
- SQLite 并发能力有限，适合个人使用
- 答题模式 question_ids 始终持久化精确题目 ID 列表（选全部时也存 ID），防止 _load_all_exam_questions 绕过类型/章节过滤
