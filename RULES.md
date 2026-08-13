# RULES

## 技术栈约束

| 层面 | 技术 | 版本 |
|------|------|------|
| 语言 | Python | >= 3.11 |
| Web 框架 | FastAPI | 最新 |
| ORM | SQLAlchemy | 最新 |
| 数据库 | SQLite | 内置 |
| 数据库迁移 | Alembic | 1.14+ |
| 前端 | 原生 JavaScript | ES6+ |
| UI 框架 | Bootstrap 5 | CDN |
| 图标 | Bootstrap Icons | CDN |
| 认证 | JWT (python-jose) | 最新 |
| 密码 | bcrypt (passlib) | 最新 |
| 容器 | Docker + docker-compose | 最新 |
| 测试 | pytest + TestClient | 最新 |

## 代码规范

### Python

| 规范 | 要求 |
|------|------|
| 版本 | Python 3.11+ |
| 格式 | 通用 PEP 8 |
| import 顺序 | 标准库 → 第三方库 → 本地模块 |
| 路由函数 | 不强制标注 `response_model`，但可加 |
| 类型提示 | 推荐使用，不强制 |

### 命名约定

| 场景 | 约定 | 示例 |
|------|------|------|
| 路由模块文件名 | 复数名词 | `banks.py`, `questions.py` |
| 路由前缀 | `/api/复数` | `/api/question-banks` |
| 私有函数 | `_` 前缀 | `_load_exam_questions()` |
| 前端路由 | hash path | `#/banks`, `#/exam/setup` |
| API 端点 | RESTful | `POST /import`, `POST /mark` |

### 项目文件树

```
刷题在线/
├── main.py                 # FastAPI 入口 + 路由挂载
├── database.py             # 引擎 + Session + get_db
├── models.py               # ORM 模型（6 张表）
├── schemas.py              # Pydantic 请求/响应模型
├── auth.py                 # JWT + bcrypt + get_current_user
├── logging_config.py       # 日志配置
├── utils.py                # 工具函数（JSON 反序列化等）
├── requirements.txt        # 依赖清单
├── alembic.ini             # Alembic 配置
├── conftest.py             # 测试根配置：集成测试落隔离临时库（#140）
├── test_integration.py     # 集成测试（#140 后全部用例可独立运行）
├── test_auth.py            # 认证单元测试
├── test_migration.py       # 迁移测试（自管临时库，真跑 alembic）
├── pyproject.toml          # 工具配置（ruff 等）
├── Dockerfile              # 容器构建
├── docker-compose.yml      # 容器编排
├── AGENTS.md               # Agent 指南
├── README.md               # 项目说明
├── RULES.md                # 本文件
│
├── routers/                # 路由模块
│   ├── __init__.py
│   ├── auth.py             # 注册/登录/me
│   ├── banks.py            # 题库 CRUD + 导入
│   ├── exam.py             # 答题全流程
│   ├── history.py          # 练习历史
│   ├── dashboard.py        # 仪表盘
│   ├── wrong_answers.py    # 错题本
│   ├── review.py           # 背题模式
│   ├── questions.py        # 题目 CURD
│   └── limiter.py          # 限流
│
├── alembic/                # 数据库迁移
│   ├── env.py
│   └── versions/           # 迁移链（初始 schema → 孤儿清理 → 答题快照 → 主键 AUTOINCREMENT …）
│       ├── 519b18b6e049_initial_schema.py
│       ├── afa1757b2ecd_cleanup_orphan_review_records.py
│       ├── fc868b9a7b87_add_answer_question_snapshot.py
│       └── 3159d3fe4acc_pk_autoincrement_no_rowid_reuse.py
│
├── static/                 # 前端 SPA
│   ├── index.html          # SPA 入口
│   ├── css/style.css       # 自定义样式
│   └── js/
│       ├── api.js          # API 调用层
│       └── app.js          # 路由 + 渲染
│
├── tests/
│   └── frontend/           # 前端测试（node --test，无 npm 依赖）
│
├── docs/                   # 项目文档
│   ├── prd/                # PRD
│   ├── arch/               # 架构描述
│   ├── api/                # 接口文档
│   ├── db/                 # 数据库设计
│   ├── deploy/             # 部署方案
│   ├── features/           # CHANGELOG / 功能记录
│   └── designs/            # 概要设计/设计稿
│
├── landing/                # 产品落地页（非文档）
│   ├── index.html
│   └── screenshots/
│
└── openspec/               # 变更历史（代码辅助，非文档）
    └── archive/
```

## 禁止事项

- **不引入新依赖**，除非经过审批（严禁新增 npm/pip 包）
- **不直接操作 DOM 绕过 app.js 路由**——所有页面切换遵守 hash 路由
- **不在路由中重复 JSON 反序列化逻辑**——统一使用 `utils.parse_json_field()`
- **不硬编码 SECRET_KEY**——生产环境通过环境变量注入
- **不在 commit 中包含 `exam.db`、`.superpowers/`、`.codegraph/`**——已在 `.gitignore` 排除
- **不删除历史 RULES 条目**——可标注"已过时"，不删除

## 反模式记录

### 不要使用 `__import__` 动态导入模块

- **为什么：** `__import__("routers.xxx")` 是 Python 内部实现细节，语义晦涩，IDE/LSP 无法追踪引用，Python 官方文档不推荐。
- **正确做法：** 在 `main.py` 中用 `from routers import auth, banks, ...` 显式导入每个路由模块。

### 不要在 `Base.metadata.create_all` 后预期表一定存在

- **为什么：** 引入 Alembic 后 Docker 入口已经通过 `alembic upgrade head` 创建表，`create_all` 作为开发环境兜底。生产环境应依赖迁移而非自动建表。
- **正确做法：** Docker 入口链：`alembic upgrade head && uvicorn main:app ...`；开发时仍可用 `uvicorn main:app`（内建 `create_all`）。

### 不要累加 `duration_seconds` 时忽略 `time_spent_seconds` 为 null 的情况

- **为什么：** 某些历史数据 `time_spent_seconds` 可能为 null，直接累加会抛异常。
- **正确做法：** `sum(ar.time_spent_seconds or 0 for ar in answer_records)`。

### 不要在路由中重复 `startswith("[")` + `json.loads` + `try/except`

- **为什么：** 这个模式分散在多个路由中，修改序列化逻辑时需要逐个排查。
- **正确做法：** 统一使用 `utils.parse_json_field(value)`。

### 不要直接展示 `user_answer` 原始 JSON 字符串给前端

- **为什么：** 多空的 `user_answer` 存为 JSON 数组字符串，前端需要反序列化后展示。
- **正确做法：** 在 API 响应中统一通过 `schemas.py` 的 Pydantic 模型处理序列化，或在前端 `api.js` 中统一解析。

## 文档约定

- 所有文档位于 `docs/` 下，按类别分入子目录
- 核心文档 8 个：PRD → `docs/prd/`、架构描述 → `docs/arch/`、接口文档 → `docs/api/`、数据库设计 → `docs/db/`、README 和 RULES → 项目根、CHANGELOG → `docs/features/`、部署方案 → `docs/deploy/`
- PRD 实现前写，验收标准可测试；架构描述持续更新；CHANGELOG 功能完成后追加
- 文档记录"为什么"而非"是什么"——代码已有的不写
- 变更后同步更新相关文档
