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
# 运行集成测试。单文件，用 TestClient，不需 httpx。
pytest test_integration.py -v
# 测试会注册临时用户、导入题库、完整走一遍答题流程。
```

## 项目结构

```
main.py                # FastAPI 入口，挂载路由和静态文件
database.py            # SQLAlchemy engine + SessionLocal + get_db
models.py              # User, QuestionBank, Question, ExamRecord, AnswerRecord, ReviewRecord
schemas.py             # Pydantic 请求/响应模型
auth.py                # JWT 签发/验证，get_current_user 依赖
routers/               # 按功能拆分的 APIRouter
  auth.py banks.py exam.py history.py dashboard.py wrong_answers.py review.py
static/
  index.html           # SPA 入口，hash 路由 (#/dashboard, #/banks, #/exam/setup 等)
  css/style.css
  js/api.js app.js
docs/
  frontend-style-guide.md   # 设计规范（色彩、字体、组件）
  page-designs.md           # 所有页面 mockup
features/              # 功能实现说明文档
```

## 技术要点

- **FastAPI** SPWA，后端渲染 SPA，前端用原生 JS + Bootstrap 5 + hash 路由
- **SQLite** schema 由 Alembic 迁移管理（Docker 启动自动 `alembic upgrade head`），开发环境 `Base.metadata.create_all(bind=engine)` 兜底建表；应用连接强制 `PRAGMA foreign_keys=ON`，`questions`/`question_banks` 主键带 `AUTOINCREMENT` 不复用（#131）
- **JWT** 7 天过期，`python-jose[cryptography]`，bearer 认证
- **密码** bcrypt via passlib
- **多选题库导入** JSON 格式（见 README），支持 choice/fill/judge 三种题型
- **答题模式** sequential（按排序） / random（打乱），单题计时或整卷计时
- **JSON 字段** `bank_ids`、`question_ids` 存为 JSON 字符串，`user_answer` 列表存为 JSON 数组

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DATABASE_URL` | `sqlite:///./exam.db` | 数据库连接 |
| `SECRET_KEY` | `exam-platform-secret-key-change-in-production` | **生产环境必须修改** |

## 代码约定

- 路由函数不标注类型检查装饰器（`response_model` 可选）
- `_load_exam_questions` vs `_load_all_exam_questions`：前者返回(剩余, 已回答)，后者返回(全部, 已回答映射)
- `_serialize_question(q, hide_answer=True)`：未答题隐藏答案
- 填空题 answer 可为字符串或列表，用 `json.loads` / `startswith("[")` 区分
- 用户回答列表也存为 JSON 字符串

## 关键约束

- 生产环境必须修改 `SECRET_KEY`（当前硬编码默认值）
- SQLite 默认不支持并发写，`check_same_thread=False`
- `.gitignore` 排除 `.superpowers/`、`exam.db`、`.codegraph/` -- 重建索引需重新初始化
- 每次功能实现后在 `features/` 新增说明文档
