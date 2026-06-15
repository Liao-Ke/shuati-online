# 应用日志系统

## 目标

为系统添加统一的 stdout 日志输出，实现关键操作可追踪，支持容器化部署下的问题排查。

## 修改范围

| 文件 | 修改内容 |
|------|---------|
| `logging_config.py` | 新建，定义 `setup_logging()` 函数，统一 `shuati` logger、stdout handler、格式 `%(asctime)s [%(levelname)s] %(name)s - %(message)s` |
| `main.py` | 导入 `setup_logging`，应用启动时调用并输出"服务启动" |
| `auth.py` | JWT 验证失败、用户不存在时 log WARNING |
| `routers/auth.py` | 注册成功 / 登录成功 log INFO（含 username，不含 password） |
| `routers/exam.py` | 开始考试 / 完成考试 log INFO（含 user_id、exam_id） |
| `routers/banks.py` | 导入题库 / 删除题库 log INFO（含 user_id、title、题数） |
| `openspec/changes/add-app-logging/` | OpenSpec 变更集（已归档） |
| `openspec/specs/app-logging/spec.md` | 新建 main spec |

## 核心实现

- **日志库**: Python 标准库 `logging`
- **输出目标**: `StreamHandler(sys.stdout)`，容器化部署最佳实践
- **Logger 名称**: `"shuati"`，各模块统一命名空间
- **格式**: `2026-06-15 12:00:00 [INFO] shuati - 消息`
- **第三方库抑制**: `sqlalchemy.engine`、`passlib` → WARNING
- **审计要点**: 记录 username 但绝不记录 password 明文

## 影响范围

- 所有应用启动、认证、答题、题库管理操作均有日志
- 测试通过 TestClient 运行，日志不干扰测试流程
- 第三方库日志噪音被抑制

## 验证方式

```bash
pytest test_integration.py -v
# 48 passed，日志不干扰测试
```

## 已知限制

- 同步 logging 在高并发时可能阻塞，当前 SQLite 单写瓶颈远大于日志瓶颈
- 未接入外部日志聚合（ELK/Loki）
