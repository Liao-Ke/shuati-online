## Why

全项目使用了 Python 3.12+ 已弃用的 `datetime.datetime.utcnow()`。SQLAlchemy 2.0 文档推荐使用 `datetime.now(timezone.utc).replace(tzinfo=None)`（naive UTC），或使用 `func.now()` 交由数据库生成时间戳。继续使用已弃用 API 在未来的 Python 版本中将产生 `DeprecationWarning`。

## What Changes

- `models.py` 新增 `utcnow()` 工具函数，封装 `datetime.now(timezone.utc).replace(tzinfo=None)`
- `models.py` 中 7 处 `Column(default=datetime.datetime.utcnow)` 全部改为 `default=utcnow`
- `models.py` 中 `onupdate=datetime.datetime.utcnow` 改为 `onupdate=utcnow`
- `auth.py` 中 `datetime.datetime.utcnow()` 替换
- `routers/exam.py` 中 2 处替换
- `routers/review.py` 中 1 处替换

## Capabilities

### New Capabilities

- `naive-utc-timestamps`: 所有 DateTime 列默认值使用 naive UTC 时间戳

### Modified Capabilities

<!-- 无 -->

## Impact

- `models.py`：新增 `utcnow()`、7 处列默认值修改
- `auth.py`：JWT 过期计算
- `routers/exam.py`：finish 时间记录
- `routers/review.py`：reviewed_at 时间记录
