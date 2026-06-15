## 1. 日志基础设施

- [x] 1.1 创建 `logging_config.py`：定义 `setup_logging(level=logging.INFO)` 函数，创建 `logging.getLogger("shuati")`，添加 `StreamHandler(sys.stdout)`，格式 `"%(asctime)s [%(levelname)s] %(name)s - %(message)s"`
- [x] 1.2 在 `setup_logging()` 中抑制第三方库日志：`sqlalchemy.engine` → WARNING，`passlib` → WARNING

## 2. 主入口集成

- [x] 2.1 修改 `main.py`：导入 `setup_logging`，在 app 创建后调用 `logger = setup_logging()` + `logger.info("服务启动")`

## 3. 路由日志

- [x] 3.1 修改 `routers/auth.py`：login 成功 log `info`（含 username，不含 password）；register 成功 log `info`；`get_current_user` 中 401 时 log `warning`
- [x] 3.2 修改 `routers/exam.py`：start_exam log `info`（含 user_id、exam_id）；finish_exam log `info`
- [x] 3.3 修改 `routers/banks.py`：import_bank log `info`（含 user_id、title、question_count）；delete_bank log `info`

## 4. 验证

- [x] 4.1 启动应用，检查 stdout 输出 "服务启动" 日志
- [x] 4.2 注册新用户 + 登录，检查 stdout 有对应日志，且无密码明文
- [x] 4.3 导入题库，检查 stdout 有导入日志
- [x] 4.4 运行 `pytest test_integration.py -v`，确认日志不干扰测试
