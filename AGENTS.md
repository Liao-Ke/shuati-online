# 刷题在线 -- Agent 指南

## 启动

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# http://localhost:8000
```

Docker 部署（端口映射 8175:8000）：
```bash
docker compose up -d
# 国内镜像：docker compose build --build-arg PIP_INDEX_URL=https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple && docker compose up -d
```

## 测试

```bash
# 后端全量测试（目录收集，与 CI 一致；勿逐个点名文件，曾漏跑 test_auth.py，#138）
pytest -v
# 覆盖 test_integration.py（集成，落隔离临时库，#140 后可独立运行）、
# test_auth.py、test_migration.py（真跑 alembic）。TestClient 基于 httpx（requirements 已含）。

# 前端测试（Node 内置 test runner，无 npm 依赖）
node --test tests/frontend/*.test.js
```

## 项目结构

```
main.py                # FastAPI 入口，挂载路由和静态文件
database.py            # SQLAlchemy engine + SessionLocal + get_db / get_write_db（写事务 BEGIN IMMEDIATE，issue #132）
models.py              # User, QuestionBank, Question, ExamRecord, AnswerRecord, ReviewRecord
schemas.py             # Pydantic 请求/响应模型
auth.py                # JWT 签发/验证，get_current_user 依赖
routers/               # 按功能拆分的 APIRouter
  auth.py banks.py exam.py history.py dashboard.py wrong_answers.py review.py questions.py limiter.py
static/
  index.html           # SPA 入口，hash 路由 (#/dashboard, #/banks, #/exam/setup 等)
  css/style.css
  js/api.js app.js
docs/
  designs/frontend-style-guide.md   # 设计规范（色彩、字体、组件）
  designs/page-designs.md           # 所有页面 mockup
  api/ arch/ db/ prd/ deploy/ features/   # 接口/架构/数据库/需求/部署/功能记录
tests/frontend/        # 前端测试（node --test）
features/              # 功能实现说明文档（历史位置，与 docs/features/ 并存，见 #169）
```

## 技术要点

- **FastAPI** SPWA，后端渲染 SPA，前端用原生 JS + Bootstrap 5 + hash 路由
- **SQLite** schema 由 Alembic 迁移管理（Docker 启动自动 `alembic upgrade head`），开发环境 `Base.metadata.create_all(bind=engine)` 兜底建表；应用连接强制 `PRAGMA foreign_keys=ON`，`questions`/`question_banks` 主键带 `AUTOINCREMENT` 不复用（#131）
- **JWT** 7 天过期，`python-jose[cryptography]`，bearer 认证
- **密码** bcrypt via passlib
- **题库导入** JSON 格式（见 README），支持 choice/fill/judge/multiple 四种题型
- **答题模式** sequential（按排序） / random（打乱），单题计时或整卷计时
- **JSON 字段** `bank_ids`、`question_ids` 存为 JSON 字符串，`user_answer` 列表存为 JSON 数组

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DATABASE_URL` | `sqlite:///./exam.db` | 数据库连接 |
| `SECRET_KEY` | 无默认值 | JWT 签名密钥。缺省时自动生成并持久化到 `.secret_key`（开发用，#8）；**生产环境必须显式设置** |
| `CORS_ORIGINS` | `*` | 跨域来源白名单，逗号分隔；通配时自动关闭 credentials（main.py） |
| `ALLOWED_HOSTS` | `*` | TrustedHostMiddleware 的 Host 白名单，逗号分隔（main.py） |

## 代码约定

- 路由函数不标注类型检查装饰器（`response_model` 可选）
- `_load_exam_questions` vs `_load_all_exam_questions`：前者返回(剩余, 已回答)，后者返回(全部, 已回答映射)
- `_serialize_question(q, hide_answer=True)`：未答题隐藏答案
- 填空题 answer 可为字符串或列表，用 `json.loads` / `startswith("[")` 区分
- 用户回答列表也存为 JSON 字符串

## 关键约束

- 生产环境必须显式设置 `SECRET_KEY`（无硬编码默认值；开发环境缺省自动生成并持久化到 `.secret_key`）
- SQLite 默认不支持并发写，`check_same_thread=False`
- `.gitignore` 排除 `.superpowers/`、`exam.db`、`.codegraph/` -- 重建索引需重新初始化
- 每次功能实现后在 `features/` 新增说明文档
