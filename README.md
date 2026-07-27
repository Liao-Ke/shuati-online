# 刷题在线

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个轻量级在线刷题平台，支持题库管理、答题练习、背题模式和错题本。

## 功能

- **题库管理** — 批量导入 JSON 格式题库，支持多文件同时导入；题库信息可编辑，支持 JSON 导出
- **题目编辑** — 支持在题库中新增、编辑和删除单道题目，四种题型均可修改
- **答题模式** — 顺序/随机出题，单题/整卷两种视图
- **背题模式** — 一次展示全部题目，逐题标记掌握状态
- **计时方式** — 单题倒计时或整卷计时（记录总用时）
- **题型支持** — 单选题、多选题、填空题、判断题
- **答题导航** — 上一题/下一题/题号跳转，题号侧边栏实时显示进度
- **结果统计** — 答题结束展示正确率、用时、逐题回顾
- **错题本** — 自动收集答错题目
- **练习历史** — 查看过往练习记录
- **自定义题数** — 选择题库后可选题目数量（全部或随机抽题）
- **Docker 部署** — 提供 Dockerfile 和 docker-compose.yml

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.11 + FastAPI |
| 数据库 | SQLite + SQLAlchemy ORM |
| 前端 | 原生 JavaScript + Bootstrap 5 |
| 认证 | JWT Token |
| 容器 | Docker + docker-compose |

## 快速开始

### 本地运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 打开浏览器访问
# http://localhost:8000
```

### Docker 部署

```bash
# 构建并启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

国内环境下可使用清华镜像加速构建：

```bash
docker compose build --build-arg PIP_INDEX_URL=https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple
docker compose up -d
```

## API 概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/me` | GET | 当前用户信息 |
| `/api/exam/start` | POST | 开始答题 |
| `/api/exam/{id}/current` | GET | 获取当前题目 |
| `/api/exam/{id}/preview` | GET | 整卷预览 |
| `/api/exam/{id}/answer` | POST | 提交答案 |
| `/api/exam/{id}/progress` | GET | 答题进度 |
| `/api/exam/{id}/finish` | POST | 结束答题 |
| `/api/exam/{id}/result` | GET | 答题结果 |
| `/api/exam/unfinished` | GET | 未完成考试列表（恢复入口） |
| `/api/history` | GET | 练习历史（分页） |
| `/api/history/{id}` | GET | 历史详情 |
| `/api/question-banks` | GET | 题库列表 |
| `/api/question-banks/{id}` | GET | 题库详情 |
| `/api/question-banks/import` | POST | 导入题库 |
| `/api/question-banks/import-multiple` | POST | 批量导入 |
| `/api/question-banks/{id}` | PUT | 更新题库信息 |
| `/api/question-banks/{id}` | DELETE | 删除题库 |
| `/api/question-banks/{id}/export` | GET | 导出题库 |
| `/api/question-banks/{bank_id}/questions` | POST | 新增题目 |
| `/api/questions/{id}` | PUT | 编辑题目 |
| `/api/questions/{id}` | DELETE | 删除题目 |
| `/api/review/questions` | POST | 背题列表 |
| `/api/review/mark` | POST | 标记掌握状态 |
| `/api/review/stats` | GET | 背题统计 |
| `/api/review/chapters` | POST | 获取章节列表（用于筛选） |
| `/api/wrong-answers` | GET | 错题本 |
| `/api/wrong-answers/start` | POST | 错题练习 |
| `/api/dashboard` | GET | 首页统计 |
| `/api/health` | GET | 健康检查（无需认证） |

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `DATABASE_URL` | `sqlite:///./exam.db` | 数据库连接。Docker 下为 `sqlite:///./data/exam.db` |
| `SECRET_KEY` | **无默认值（生产环境必须设置）** | JWT 签名密钥。开发环境未设置时自动生成并持久化到 `.secret_key` 文件，重启后复用；生产环境通过环境变量注入 |

## 题库格式

导入的 JSON 文件格式：

```json
{
  "title": "题库名称",
  "description": "题库描述（可选）",
  "questions": [
    {
      "type": "choice",
      "chapter": "第一章",
      "content": "题目内容",
      "options": ["选项一", "选项二", "选项三", "选项四"],
      "answer": "B",
      "analysis": "解析内容（可选）"
    },
    {
      "type": "fill",
      "content": "填空题内容____。",
      "answer": "答案"
    },
    {
      "type": "judge",
      "content": "判断题内容",
      "answer": "对"
    },
    {
      "type": "multiple",
      "chapter": "第一章",
      "content": "多选题内容",
      "options": ["选项一", "选项二", "选项三", "选项四"],
      "answer": ["A", "C"],
      "analysis": "解析内容（可选）"
    }
  ]
}
```

## 相关文档

| 文档 | 位置 | 说明 |
|------|------|------|
| 产品需求文档 | [docs/prd/exam-platform.md](docs/prd/exam-platform.md) | 功能定义与验收标准 |
| 架构描述 | [docs/arch/system.md](docs/arch/system.md) | 模块职责、ER 关系、数据流 |
| 接口文档 | [docs/api/endpoints.md](docs/api/endpoints.md) | 完整 API 参考 |
| 数据库设计 | [docs/db/schema.md](docs/db/schema.md) | 表结构、索引、设计决策 |
| 部署方案 | [docs/deploy/guide.md](docs/deploy/guide.md) | Docker/本地部署、环境配置 |
| 开发指南 | [docs/designs/development-guide.md](docs/designs/development-guide.md) | 环境搭建、开发流程、代码规范 |
| 前端设计稿 | [docs/designs/page-designs.md](docs/designs/page-designs.md) | 所有页面的布局与交互 |
| 前端风格指南 | [docs/designs/frontend-style-guide.md](docs/designs/frontend-style-guide.md) | 色彩、字体、组件规范 |
| 项目规则 | [RULES.md](RULES.md) | 技术栈约束、代码规范、反模式 |
| 功能记录（CHANGELOG） | [docs/features/](docs/features/) | 每次功能实现的修改范围与验证 |

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。
