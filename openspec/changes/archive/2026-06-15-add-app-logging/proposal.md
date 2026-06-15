## Why

当前项目无任何应用日志。生产环境出现认证失败、数据异常、性能问题时无法追踪根因。容器化部署下，stdout 日志是最佳实践。

## What Changes

- 新建 `logging_config.py`：封装 `setup_logging(level)` 函数，配置 stdout handler、统一格式、抑制第三方库噪音
- `main.py` 启动时调用 `setup_logging()`
- 关键路由添加 INFO/WARNING 日志：登录成功/失败、注册、考试开始/结束、题库导入/删除

## Capabilities

### New Capabilities

- `app-logging`: 统一日志系统，stdout 输出，关键操作可追踪

### Modified Capabilities

<!-- 无 -->

## Impact

- 新增 `logging_config.py`
- `main.py`：日志初始化
- `routers/auth.py`：login/register 日志
- `routers/exam.py`：start/finish 日志
- `routers/banks.py`：import/delete 日志
