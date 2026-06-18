# GitHub CI/CD 流水线

**日期：** 见文件修改时间  &emsp; **关联 PRD：** 无（基础设施/工具链）

## 目标

引入 GitHub Actions 持续集成（CI）与 Docker 镜像构建流水线，确保代码质量与构建可重复性。

## 改动

### 新增

| 文件 | 说明 |
|------|------|
| `pyproject.toml` | 项目元信息 + ruff 配置（E/F/I/UP/B/SIM 规则集，target py311） |
| `.github/workflows/ci.yml` | CI 工作流 |
| `.github/workflows/docker.yml` | Docker 镜像构建产出工作流 |

### 修改

| 文件 | 说明 |
|------|------|
| `requirements.txt` | 追加 `ruff==0.11.8` |
| `auth.py` | B904 修复：`raise ... from None` |
| `routers/exam.py` | B905 修复：`zip(strict=True)` |
| `test_integration.py` | B007 修复：重命名未使用的循环变量 |
| `routers/wrong_answers.py` | 恢复合法 SQLAlchemy 用法，通过 per-file-ignores 抑制 E712 |

## CI 流水线（ci.yml）

**触发条件：** `push` 或 `pull_request` 到 `main` 分支

三个并行 job：

| Job | 命令 | 职责 |
|-----|------|------|
| `lint` | `ruff check .` | 代码规范检查 |
| `test` | `pytest test_integration.py -v` | 集成测试（52 项） |
| `docker-build` | `docker build` | Dockerfile 构建验证 |

## Docker 镜像构建（docker.yml）

**触发条件：** `push` 到 `main` 或推送 `v*` tag

- 构建 Docker 镜像
- 保存为 `.tar` 文件
- 上传至 Actions Artifact（保留 7 天）
- 预留将来推送到容器仓库的接口

## 验证方式

1. `ruff check .` — 0 错误
2. `pytest test_integration.py -v` — 52 项全部通过
3. GitHub 仓库启用 Actions 后，推送即可触发流水线
