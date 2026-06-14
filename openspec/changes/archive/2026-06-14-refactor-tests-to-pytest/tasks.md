## 1. 重写为 pytest fixture + test function

- [x] 1.1 移除 `sys.path.insert`，添加 `from main import app` 替代
- [x] 1.2 添加 session fixture：`client`、`auth_headers`、`bank_id`
- [x] 1.3 将注册/登录步骤移到 `auth_headers` fixture 中
- [x] 1.4 将导入题库步骤移到 `bank_id` fixture 中
- [x] 1.5 将 28 个测试步骤拆分为独立的 test function，按顺序组织

## 2. 验证

- [x] 2.1 运行 `pytest test_integration.py -v`，确认收集到测试项且全部通过
- [x] 2.2 运行 `python test_integration.py` 作为对比，确认行为等价
