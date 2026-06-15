## 1. 定义工具函数

- [x] 1.1 修改 `models.py`：在文件顶部（import 之后、class 定义之前）新增 `from datetime import datetime, timezone` 和 `def utcnow() -> datetime: return datetime.now(timezone.utc).replace(tzinfo=None)`

## 2. 替换模型层

- [x] 2.1 `models.py`：`User.created_at` — `default=datetime.datetime.utcnow` → `default=utcnow`
- [x] 2.2 `models.py`：`QuestionBank.created_at` — 同上
- [x] 2.3 `models.py`：`QuestionBank.updated_at` — `default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow` → `default=utcnow, onupdate=utcnow`
- [x] 2.4 `models.py`：`ExamRecord.started_at` — 同上
- [x] 2.5 `models.py`：`AnswerRecord.answered_at` — 同上
- [x] 2.6 `models.py`：`ReviewRecord.reviewed_at` — 同上

## 3. 替换路由层

- [x] 3.1 修改 `auth.py`：`create_access_token` 中的 `datetime.datetime.utcnow()` 替换为 `datetime.now(timezone.utc).replace(tzinfo=None)`
- [x] 3.2 修改 `routers/exam.py`：第 224 行 `datetime.datetime.utcnow()` → `from models import utcnow` + `utcnow()`
- [x] 3.3 修改 `routers/exam.py`：第 290 行 `__import__("datetime").datetime.utcnow()` → `utcnow()`
- [x] 3.4 修改 `routers/review.py`：第 83 行 `datetime.datetime.utcnow()` → `from models import utcnow` + `utcnow()`

## 4. 验证

- [x] 4.1 运行 `pytest test_integration.py -v`，全部 43 个测试通过（实际 43 个，无 utcnow 相关 DeprecationWarning）
- [x] 4.2 运行 `python -W all -c "from models import utcnow; print(utcnow())"`，确认无 DeprecationWarning
