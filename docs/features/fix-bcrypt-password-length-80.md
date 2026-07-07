# 修复：注册接口限制 bcrypt 72 字节密码上限

**日期：** 见文件修改时间 &emsp; **关联 Issue：** [#80](https://github.com/Liao-Ke/shuati-online/issues/80)

## 目标

修复注册接口未限制 bcrypt 72 字节密码上限的问题。bcrypt 只处理前 72 字节，超出部分被静默忽略，导致两个前 72 字节相同、后缀不同的密码可互相验证通过。

## 问题

1. `routers/auth.py` 注册函数只校验 `len(data.password) < 6`，无最大长度限制
2. bcrypt 截断使超长密码后缀失效，构成安全隐患
3. 多字节字符（如中文）密码按 UTF-8 编码后字节数可能远超字符数

## 方案

在注册入口按 UTF-8 字节长度限制密码，超过 72 字节返回 400。不采用 bcrypt_sha256 / 预哈希方案（会改变安全特性并需要旧 hash 迁移策略，超出本任务范围）。

## 改动

| 文件 | 改动 |
|------|------|
| `routers/auth.py` | 在 `len(data.password) < 6` 校验之后，新增 `len(data.password.encode("utf-8")) > 72` 校验，超过返回 400 |
| `test_integration.py` | 新增 `test_01g_register_password_byte_limit`，覆盖 73 字节 ASCII → 400、72 字节 ASCII → 200、多字节超限 → 400、多字节未超限 → 200 |

## 影响范围

- 仅 `POST /api/auth/register` 请求边界
- 现有 6~72 字节密码行为完全不变，向后兼容
- 不涉及登录、数据库、其他路由或前端

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 全部通过（含新增 test_01g）
3. 新增测试覆盖：73 字节 ASCII → 400，72 字节 ASCII → 200，多字节超限 → 400，多字节未超限 → 200
