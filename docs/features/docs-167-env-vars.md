# 文档：补齐 CORS_ORIGINS 与 ALLOWED_HOSTS 环境变量说明（issue #167）

**日期：** 2026-07-27  &emsp; **关联 Issue：** #167

## 问题

`main.py` 支持两个安全相关环境变量（`CORS_ORIGINS` 通配时自动关 credentials；
`ALLOWED_HOSTS` 为 TrustedHostMiddleware 白名单），但项目全部三处环境变量
文档只列 `DATABASE_URL` 与 `SECRET_KEY`。生产部署者无从知道可以收紧，
只能保持默认全放行。

## 修改范围

- `docs/deploy/guide.md`：配置表补两行，含格式示例与生产取值建议（加粗）。
- `README.md`：配置表补两行（精简口径）。
- `AGENTS.md`：配置表补两行（指向 main.py）。

已核对代码中 `os.getenv` 全部读取点共 4 个环境变量
（DATABASE_URL/SECRET_KEY/CORS_ORIGINS/ALLOWED_HOSTS），三处文档表现已完整覆盖。

## 验证方式

```bash
grep -rn "CORS_ORIGINS\|ALLOWED_HOSTS" docs/ README.md AGENTS.md   # 三处均有
```

## 已知限制

- AGENTS.md 的 SECRET_KEY 行默认值描述过时（属 issue #164 的开发者文档整治范围，
  本次不扩大改动）。
