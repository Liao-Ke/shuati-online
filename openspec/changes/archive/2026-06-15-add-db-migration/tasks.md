## 1. 依赖与初始化

- [x] 1.1 在 `requirements.txt` 新增 `alembic==1.14.1`
- [x] 1.2 执行 `pip install alembic==1.14.1`
- [x] 1.3 执行 `alembic init alembic` 生成 `alembic.ini` 和 `alembic/` 目录

## 2. 配置 env.py

- [x] 2.1 修改 `alembic/env.py`：在 `target_metadata = None` 行之后，添加 `from database import Base, SQLALCHEMY_DATABASE_URL`、`import models`（触发模型注册）、`config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)`、`target_metadata = Base.metadata`

## 3. 生成初始迁移

- [x] 3.1 执行 `alembic revision --autogenerate -m "initial schema"`，确认生成 `alembic/versions/*_initial_schema.py`
- [x] 3.2 执行 `alembic upgrade head`，确认 `exam.db` 中所有表正确创建

## 4. Dockerfile 修改

- [x] 4.1 修改 `Dockerfile`：在 `COPY . .` 之后，CMD 改为 `CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000`
- [x] 4.2 确认 `alembic.ini` 和 `alembic/` 目录被 COPY 到镜像中

## 5. main.py 日志提示

- [x] 5.1 修改 `main.py`：`create_all` 调用后添加 logger warning 提示生产环境应使用 alembic

## 6. 验证

- [x] 6.1 删除 `exam.db`，执行 `alembic upgrade head`，确认数据库重建
- [x] 6.2 运行 `pytest test_integration.py -v`，确认全部测试通过
- [x] 6.3 再次执行 `alembic upgrade head`，确认幂等（无错误）
