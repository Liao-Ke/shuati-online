# 替换已弃用的 `datetime.datetime.utcnow()`

## 目标

消除全项目中所有已弃用的 `datetime.datetime.utcnow()` 调用，统一使用 naive UTC 时间戳，移除 Python 3.12+ 的 `DeprecationWarning`。

## 修改范围

- `models.py`：新增 `utcnow()` 工具函数，替换 7 处 `datetime.datetime.utcnow` 引用
- `auth.py`：替换 `create_access_token` 中的 `datetime.datetime.utcnow()`
- `routers/exam.py`：替换 2 处（含 `__import__("datetime").datetime.utcnow()` 的 hack 写法）
- `routers/review.py`：替换 1 处
- `openspec/specs/naive-utc-timestamps/spec.md`：新增主 spec

## 核心实现

- `models.py` 顶部定义 `def utcnow() -> datetime: return datetime.now(timezone.utc).replace(tzinfo=None)`
- 所有 `Column(default=datetime.datetime.utcnow)` → `default=utcnow`
- 所有 `onupdate=datetime.datetime.utcnow` → `onupdate=utcnow`
- 路由层通过 `from models import utcnow` 复用同一函数

## 影响范围

- 所有涉及时间戳默认值的 SQLAlchemy 模型列
- JWT 创建时的 exp/iat 计算
- 考试完成和背题标记的时间记录

## 验证方式

- `pytest test_integration.py -v`：43/43 全部通过
- `python -W all -c "from models import utcnow; print(utcnow())"`：无 DeprecationWarning

## 已知限制

- 保持 naive datetime 风格，与 SQLite 兼容
- 未来迁移 PostgreSQL 的 `TIMESTAMPTZ` 时只需改动 `utcnow()` 实现
