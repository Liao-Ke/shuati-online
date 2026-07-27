# 部署指南

## 环境要求

| 组件 | 版本 |
|------|------|
| Python | >= 3.11 |
| pip | 任意（安装 requirements.txt） |
| Docker | 任意（容器化部署） |
| 磁盘 | >= 100MB（含 SQLite 数据） |

---

## 方式一：Docker 部署（推荐）

### 构建与启动

```bash
docker compose up -d
```

端口映射：宿主机 **8175** → 容器内 **8000**。  
访问 `http://localhost:8175`。

### 查看日志

```bash
docker compose logs -f
```

### 停止

```bash
docker compose down
```

### 国内镜像加速

```bash
docker compose build --build-arg PIP_INDEX_URL=https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple
docker compose up -d
```

### 健康检查

容器内置 healthcheck，每 30s 请求 `/api/health`。可通过以下命令手动检查：

```bash
docker exec shuati-web python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/api/health').read())"
```

### 数据持久化

SQLite 文件通过 volume `shuati-data` 持久化：

```yaml
volumes:
  shuati-data:/app/data
```

容器内数据库路径为 `/app/data/exam.db`。删除容器不影响数据。

如需备份数据：

```bash
# 查看 volume 位置
docker volume inspect shuati-data

# 复制到本地（需要 root 权限或通过容器）
docker cp shuati-web:/app/data/exam.db ./backup-exam.db
```

---

## 方式二：本地运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

建议使用虚拟环境：

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 初始化/更新数据库 schema

```bash
alembic upgrade head
```

首次部署与每次拉新代码后都应执行（与 §升级 一致；Docker 路径由入口自动执行）。
漏跑时应用仍能启动，但启动日志会出现 `schema 版本落后` 的 ERROR 告警（issue #136），
未迁移的库上安全修复不生效。

### 3. 启动

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `--reload` 开发模式下修改代码自动重启，生产环境移除
- `--host 0.0.0.0` 允许局域网访问
- 访问 `http://localhost:8000`

### 4. 后台运行（生产）

```bash
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
```

或使用 systemd / supervisor 管理进程。

---

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DATABASE_URL` | `sqlite:///./exam.db` | 数据库连接。Docker 下应为 `sqlite:///./data/exam.db` |
| `SECRET_KEY` | **无默认值（生产环境必须设置）** | JWT 签名密钥。开发环境未设置时自动生成并持久化到 `.secret_key` 文件，重启后复用；生产环境通过 `docker-compose.yml` 或环境变量注入 |

### 生产环境必须设置

```bash
# Docker（docker-compose.yml 中已有 ${SECRET_KEY:?...}，启动前需 export）
export SECRET_KEY="your-random-secret-here"
docker compose up -d

# 本地
export SECRET_KEY="your-random-secret-here"
uvicorn main:app --host 0.0.0.0 --port 8000
```

密钥生成建议：

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 数据库

### SQLite 文件位置

| 部署方式 | 路径 |
|----------|------|
| 本地运行 | 项目目录下的 `exam.db` |
| Docker | volume `shuati-data` 中的 `exam.db`，容器内 `/app/data/exam.db` |

### Alembic 迁移

项目使用 Alembic 管理数据库 schema 版本。Docker 启动时自动执行 `alembic upgrade head`，开发环境通过 `uvicorn main:app` 启动时仍保留 `Base.metadata.create_all()` 作为兜底。

#### 运行迁移

```bash
# 手动执行迁移（本地开发）
alembic upgrade head

# 回滚一步
alembic downgrade -1

# 查看当前版本
alembic current

# 查看迁移历史
alembic history
```

#### 生成新的迁移

修改 `models.py` 后，生成自动迁移脚本：

```bash
alembic revision --autogenerate -m "描述性名称"
```

检查生成的版本文件后，执行 `alembic upgrade head` 应用迁移。

#### 重建数据库（开发环境）

```bash
# 本地
rm exam.db
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Docker
docker compose down
docker volume rm shuati-data
docker compose up -d
# 启动时自动执行 alembic upgrade head
```

### WAL 模式（可选优化）

SQLite 默认是 journal 模式，写入并发能力有限。可手动启用 WAL——`database.py` 已有一个 connect 事件监听器为每个应用连接执行 `PRAGMA foreign_keys=ON`（issue #131），WAL 参数可追加在同一监听器中：

```python
# database.py 的 _enforce_sqlite_foreign_keys 内追加
cursor.execute("PRAGMA journal_mode=WAL")
cursor.execute("PRAGMA synchronous=NORMAL")
```

注意监听器挂在 `engine` 实例而非 `Engine` 类上：alembic 迁移自建的连接必须保持外键关闭，batch 整表重建才能安全执行。

---

## 升级

```bash
# Docker
git pull
docker compose build
docker compose up -d
# 数据库迁移在容器启动时自动执行 alembic upgrade head

# 本地
git pull
pip install -r requirements.txt
alembic upgrade head          # 如有模型变更则自动迁移
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 常见问题

### Q: Docker 启动后访问报 502

检查 healthcheck 是否通过：

```bash
docker ps --filter name=shuati-web
```

查看日志：

```bash
docker compose logs
```

常见原因：端口冲突（8175 被占用）或镜像未构建成功。

### Q: 导入页面显示 "加载失败，请重试"

常见原因：
1. 数据库文件损坏 —— 删库重建
2. Token 过期（7 天） —— 重新登录
3. 服务未启动或端口不对

### Q: 数据库迁移怎么做？

项目使用 Alembic 管理 schema 迁移。修改 `models.py` 后：

```bash
# 1. 生成迁移脚本
alembic revision --autogenerate -m "修改说明"

# 2. 检查生成的版本文件（alembic/versions/ 下）

# 3. 应用迁移
alembic upgrade head
```

已有数据会自动保留，不需要删库。如果迁移脚本不满足需求（如重命名列），可手动编辑版本文件。详见 `docs/db/schema.md`。

### Q: 如何修改端口？

**Docker：** 修改 `docker-compose.yml` 中的 `ports` 段：

```yaml
ports:
  - "9000:8000"  # 宿主机 9000 → 容器 8000
```

**本地：** 修改 `--port` 参数：

```bash
uvicorn main:app --host 0.0.0.0 --port 9000
```

### Q: Docker 下数据库不持久化，重启后数据丢失？

检查 volume 挂载是否正确：

```bash
docker inspect shuati-web | grep -A 10 Mounts
```

应该看到 `shuati-data` volume 挂载到 `/app/data`。如果 mount 丢失，检查 `docker-compose.yml` 中的 `volumes` 配置。
