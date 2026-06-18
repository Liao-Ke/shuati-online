# 项目整理 — 准备上传 GitHub

**日期：** 见文件修改时间  &emsp; **关联 PRD：** 无（基础设施/工具链）


## 目标
完善项目文档、配置和环境准备，使仓库可直接上传 GitHub。

## 改动

### 新增
- `README.md` — 项目简介、功能列表、技术栈、快速开始、API 概览、配置说明、题库格式

### 修改
- `.gitignore` — 添加 `.pytest_cache/`、`.DS_Store`
- `auth.py` — `SECRET_KEY` 改为 `os.getenv("SECRET_KEY", ...)` 环境变量读取

## 验证
27 项集成测试全部通过。
