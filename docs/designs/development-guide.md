# 开发指南

## 环境搭建

### 前置要求

```bash
# Python 3.11+
python --version

# pip
pip --version
```

### 本地开发环境

```bash
# 克隆项目
git clone <repo-url>
cd 刷题在线

# 创建虚拟环境（可选但推荐）
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Docker 开发环境

```bash
docker compose build --build-arg PIP_INDEX_URL=https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple
docker compose up -d
docker compose logs -f
```

---

## 项目结构速览

```
刷题在线/
├── main.py                 # 入口：FastAPI 初始化 + 路由挂载 + 静态文件
├── database.py             # 数据库引擎 + Session + get_db
├── models.py               # ORM 模型（6 张表）
├── schemas.py              # Pydantic 请求/响应模型
├── auth.py                 # JWT + bcrypt + get_current_user
├── logging_config.py       # 日志配置
├── utils.py                # 工具函数（JSON 反序列化等）
├── requirements.txt        # 所有 Python 依赖
├── alembic.ini             # Alembic 配置
├── RULES.md                # 项目规则
├── test_integration.py     # 集成测试（单文件，TestClient）
│
├── routers/                # 按功能拆分的路由模块
│   ├── auth.py             # 注册/登录/me
│   ├── banks.py            # 题库 CRUD + 导入
│   ├── exam.py             # 答题全流程
│   ├── history.py          # 练习历史
│   ├── dashboard.py        # 仪表盘统计
│   ├── wrong_answers.py    # 错题本 + 错题练习
│   ├── review.py           # 背题模式
│   ├── questions.py        # 题目 CURD
│   └── limiter.py          # 登录限流
│
├── alembic/                # 数据库迁移
│   ├── env.py
│   └── versions/
│       └── 519b18b6e049_initial_schema.py
│
├── static/                 # 前端 SPA
│   ├── index.html          # 入口，导航栏
│   ├── css/style.css       # 自定义样式
│   └── js/
│       ├── api.js          # API 调用封装
│       └── app.js          # 路由 + 渲染 + 事件
│
├── docs/                   # 文档
│   ├── prd/                # PRD
│   ├── arch/               # 架构描述
│   ├── api/                # 接口文档
│   ├── db/                 # 数据库设计
│   ├── deploy/             # 部署方案
│   ├── features/           # 功能实现说明
│   └── designs/            # 设计稿
│
└── landing/                # 产品落地页
    ├── index.html
    └── screenshots/
```

---

## 常规开发流程

### 新增一个路由模块

以下步骤以新增"收藏夹"功能为例（`routers/favorites.py`）：

**1. 创建路由文件**

```python
# routers/favorites.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth import get_current_user

router = APIRouter(prefix="/api/favorites", tags=["收藏"])


@router.get("")
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"favorites": []}
```

**2. 注册到 main.py**

```python
from routers import favorites
app.include_router(favorites.router)
```

**3. 新增模型（如需新表）**

在 `models.py` 中添加 ORM 类，然后生成并应用迁移：

```bash
alembic revision --autogenerate -m "add favorites"
alembic upgrade head
```

开发环境下 `uvicorn main:app` 启动时也会通过 `create_all()` 建表，但生产环境请始终使用迁移。

**4. 新增 Schemas（如需新请求/响应）**

在 `schemas.py` 中添加 Pydantic 模型。

**5. 前端对接**

- `static/js/api.js` — 添加 API 调用函数
- `static/js/app.js` — 添加路由和页面渲染函数
- `static/index.html` — 如需导航入口则添加

**6. 更新测试**

在 `test_integration.py` 末尾追加测试。

### 修改数据库模型

1. 修改 `models.py` 中的 ORM 类
2. 生成自动迁移脚本：`alembic revision --autogenerate -m "描述"`
3. 检查生成的版本文件（`alembic/versions/` 下）
4. 应用迁移：`alembic upgrade head`
5. 重启开发服务器

数据自动保留，不需要删库。如果迁移脚本不满足需求（如重命名列、转换数据），可手动编辑生成的版本文件。

### 前端新增页面

1. 在 `app.js` 的 `routes` 对象中添加 `"pageName": renderPageFunction` 映射
2. 实现 `renderXxxPage()` 函数
3. 如果需要新的 API 调用，在 `api.js` 中添加方法
4. 如果导航栏需要新入口，在 `index.html` 中添加 `<li class="nav-item">` 链接

### 完成功能后

1. 验证测试通过：`pytest test_integration.py -v`
2. 在 `docs/features/` 中新增 Markdown 文档（按 CHANGELOG 模板），说明目标、修改范围、核心实现、验证方式

---

## 测试

### 运行测试

```bash
# 后端全量（目录收集，与 CI 一致；勿逐个点名文件——曾因此漏跑 test_auth.py，issue #138）
pytest -v

# 单个测试（#140 后所有用例可独立运行）
pytest test_integration.py::test_xxx -v

# 前端测试（Node 内置 test runner，无 npm 依赖）
node --test tests/frontend/*.test.js
```

### 测试说明

- 后端测试共 3 个文件：`test_integration.py`（集成全流程）、`test_auth.py`（认证单元）、
  `test_migration.py`（自管临时库、真跑 alembic，覆盖 create_all 走不到的迁移路径）
- 根 `conftest.py` 把 `DATABASE_URL` 指向隔离临时库（#140/#141）——集成测试**不触碰**开发库 `exam.db`
- `TestClient` 基于 `httpx`（`requirements.txt` 已显式依赖）
- 每次运行使用随机 UUID 用户名，避免重复注册冲突
- #140/#142 起**无测试间顺序依赖**，全部用例可独立运行；新增测试仍惯例追加在文件末尾（减少多 PR 冲突面）

### 测试编写规范

```python
# 共享 fixture 见 test_integration.py 顶部，遵守其只读契约：
# - session 级 bank_id 是只读共享题库（5 题），仅用于开考/筛选/4xx 校验等不改内容的场景
# - 会突变题库的场景用函数级 own_bank
# - 需要精确断言用户级全局计数（错题数、背题统计等）用 _register_isolated_user
def test_example(client, auth_headers, bank_id):
    r = client.get("/api/question-banks", headers=auth_headers)
    assert r.status_code == 200

# 反模式（#142 已移除，勿再引入）：模块级 State 共享数据、测试间顺序依赖
```

### 手动测试

```bash
# 注册
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'

# 查看 API 的 OpenAPI 文档
# http://localhost:8000/docs
```

---

## 代码规范

### Python

| 规范 | 要求 |
|------|------|
| 版本 | Python 3.11+ |
| 格式 | 通用 PEP 8，无格式化工具要求 |
| import 顺序 | 标准库 → 第三方 → 本地（见已有文件） |
| 路由函数 | 不强制标注 `response_model`，但可加 |
| 类型提示 | 推荐使用，但不强制 |

### 命名约定

| 场景 | 约定 | 示例 |
|------|------|------|
| 路由模块文件名 | 复数名词 | `banks.py`, `questions.py` |
| 路由前缀 | `/api/复数` | `/api/question-banks` |
| 私有函数 | `_` 前缀 | `_load_exam_questions()` |
| 前端路由 | hash path | `#/banks`, `#/exam/setup` |
| API 端点 | RESTful | `POST /import`, `POST /mark` |

### 前端规范

详见 `docs/designs/frontend-style-guide.md`，关键点：
- 统一使用 Bootstrap 5 + Bootstrap Icons
- 字体：Poppins（标题）/ Open Sans（正文）
- Hash 路由，不依赖构建工具

---

## 数据库操作惯例

### 查询

```python
# 通过 get_db 依赖注入获取 session
def list_banks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    banks = db.query(QuestionBank).filter(
        QuestionBank.user_id == user.id
    ).order_by(QuestionBank.updated_at.desc()).all()
```

### JSON 字段处理

```python
from utils import parse_json_field

# 写入
bank_ids_str = json.dumps([1, 2, 3])
options_str = json.dumps(["1", "2"], ensure_ascii=False)

# 读取（统一使用 parse_json_field）
bank_ids = parse_json_field(exam.bank_ids)
options = parse_json_field(question.options)
answer = parse_json_field(question.answer)
user_answer = parse_json_field(record.user_answer)
```

### 事务与提交

```python
# 简单操作：add + commit
db.add(record)
db.commit()

# 复杂操作：flush 获取 id，最后 commit
db.add(bank)
db.flush()
# 现在可以使用 bank.id
db.commit()
```

---

## 已知注意事项

| 事项 | 说明 |
|------|------|
| 数据库并发 | SQLite 默认不支持并发写。如果服务在多人场景下出现 `database is locked` 错误，可启用 WAL 模式 |
| 测试隔离 | 集成测试落在 conftest 指定的隔离临时库（#140/#141），不触碰开发库 `exam.db`；`test_migration.py` 自管临时库 |
| 静态文件缓存 | 修改 CSS/JS 后浏览器可能缓存旧版本。开发时使用 `--reload` 并配合浏览器硬刷新（Ctrl+F5） |
| 依赖安装 | 如果某些库安装失败（如 `bcrypt` 需要 C 扩展），可尝试：`pip install bcrypt==4.1.3 --no-binary bcrypt` |
| Python 路径 | 如果使用项目中的 `sys.path.insert(0, '.')`（测试文件），确保工作目录是项目根目录 |
