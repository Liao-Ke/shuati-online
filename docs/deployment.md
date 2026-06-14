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

### 2. 启动

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- `--reload` 开发模式下修改代码自动重启，生产环境移除
- `--host 0.0.0.0` 允许局域网访问
- 访问 `http://localhost:8000`

### 3. 后台运行（生产）

```bash
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &
```

或使用 systemd / supervisor 管理进程。

---

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DATABASE_URL` | `sqlite:///./exam.db` | 数据库连接。Docker 下应为 `sqlite:///./data/exam.db` |
| `SECRET_KEY` | `exam-platform-secret-key-change-in-production` | JWT 签名密钥 |

### 生产环境必须修改

```bash
# Docker
docker run -e SECRET_KEY="your-random-secret-here" ...

# docker-compose.yml
environment:
  - SECRET_KEY="your-random-secret-here"

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

### 重建数据库

项目无迁移系统，修改模型后需删库重建：

```bash
# 本地
rm exam.db
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# 启动时会自动建表

# Docker
docker compose down
docker volume rm shuati-data
docker compose up -d
```

### WAL 模式（可选优化）

SQLite 默认是 journal 模式，写入并发能力有限。可手动启用 WAL：

```python
# 在 database.py 的 engine 创建后添加
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
```

---

## 升级

```bash
# Docker
git pull
docker compose build
docker compose up -d

# 本地
git pull
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

数据库无迁移脚本。如果模型变更，按"重建数据库"步骤操作。

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

目前没有迁移系统。修改 `models.py` 后需要删库重建。如果已有数据需要保留，建议先备份：

```bash
cp exam.db exam.db.bak
# 修改模型后删库
rm exam.db
# 启动（自动建新表）
uvicorn main:app ...
# 如果需要导回数据：暂无官方工具，需自行编写脚本
```

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
