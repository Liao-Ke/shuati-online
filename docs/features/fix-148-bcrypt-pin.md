# 修复：bcrypt 钉回 4.0.1，消除 passlib 首次哈希的 AttributeError traceback（issue #148）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #148

## 问题

passlib 1.7.4（2020 年后未再发版）加载 bcrypt 后端时读取 `bcrypt.__about__.__version__`，
bcrypt 4.1 起移除了 `__about__`。每个进程第一次哈希/校验密码时日志打印一段
`(trapped) error reading bcrypt version` WARNING + AttributeError traceback，
形似崩溃，混入每次部署/重启后的日志、CI 与 Docker 日志。功能不受影响。
`logging_config.py` 已把 passlib 压到 WARNING，但该条本身就是 WARNING，压不掉。

## 修复

`requirements.txt`：`bcrypt==4.1.3` → `bcrypt==4.0.1`（最后一个与 passlib 1.7.4 兼容的版本），
附注释说明原因。不改任何代码——压制日志属于掩盖症状，降级消除的是根因（版本不兼容）。
同步更新 `docs/designs/development-guide.md` 中的排障命令版本号。

## 为什么不是其他方案

- **迁移掉 passlib（直接用 bcrypt）**：passlib 已停维护，长期看合理，但属于认证实现的
  设计变更，超出本 issue 范围，需单独提案。
- **monkeypatch `bcrypt.__about__`**：hack 第三方模块内部，升级面前更脆。
- **拉高 passlib logger 到 ERROR**：掩盖症状，且会吞掉未来真实告警。

## 行为影响评估

- 哈希格式均为 `$2b$`，**存量用户密码不受影响**——已实测交叉验证：
  4.1.3 环境生成的哈希在 4.0.1 环境 `verify` 通过。
- 72 字节截断差异无关：注册边界已拒绝超 72 字节密码（#80）。
- bcrypt 4.0.1 → 4.1.x 之间无安全修复，降级无安全损失。

## 验证方式

```bash
# 干净 venv 按新 requirements.txt 全量安装（与 CI 一致）
python -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python -m pytest -q       # 161 passed
# DEBUG 日志确认后端加载干净：
# detected 'bcrypt' backend, version '4.0.1'（不再出现 (trapped) traceback）
```

复现确认：本机 miniconda（passlib 1.7.4 + bcrypt 4.1.3）首次哈希稳定打印 traceback；
新 venv（4.0.1）同一操作无任何告警输出。

## 已知限制

- passlib 上游已停止维护，bcrypt 长期钉在 4.0.1；若未来需要新版 bcrypt 特性，
  应走「迁移掉 passlib」的独立提案（见上）。
- 本机 miniconda 环境仍装着 bcrypt 4.1.3，跑测试时日志仍会出现该 traceback（不影响结果）；
  如需对齐可手动 `pip install bcrypt==4.0.1`。
