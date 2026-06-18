# 前端风格指南

## 设计语言

专业、干净、高对比、功能优先。适配学习专注场景，无冗余装饰。

## 色彩体系

| 角色 | 色值 | 用途 |
|------|------|------|
| Primary | `#1E40AF` | 导航栏、主要按钮、链接 |
| Primary Light | `#3B82F6` | 悬停态、次要按钮、选中态 |
| Success / CTA | `#22C55E` | 提交按钮、正确标记、进度条 |
| Danger | `#EF4444` | 错误标记、删除、计时器超时 |
| Warning | `#F59E0B` | 待定状态、提醒 |
| Bg Page | `#EFF6FF` | 页面主背景 |
| Bg Card | `#FFFFFF` | 卡片、表单区域 |
| Bg Muted | `#F8FAFC` | 表格条纹、次级背景 |
| Text Primary | `#1E3A8A` | 正文字色 |
| Text Muted | `#64748B` | 辅助文字、标签 |
| Border | `#CBD5E1` | 分割线、输入框边框 |

## 字体

| 层级 | 字体 | 字重 | 字号 | 行高 |
|------|------|------|------|------|
| H1 页面标题 | Poppins | 700 | 1.75rem (28px) | 2.25rem |
| H2 区块标题 | Poppins | 600 | 1.375rem (22px) | 1.75rem |
| H3 卡片标题 | Poppins | 600 | 1.125rem (18px) | 1.5rem |
| Body 正文 | Open Sans | 400 | 1rem (16px) | 1.5 |
| Body Small | Open Sans | 400 | 0.875rem (14px) | 1.5 |
| Caption | Open Sans | 400 | 0.75rem (12px) | 1.4 |
| Timer / Score | Poppins | 700 | 2rem (32px) | 1.2 |

```html
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
```

## 组件规范

### 按钮

| 变体 | 背景 | 文字 | 边框 | 圆角 |
|------|------|------|------|------|
| Primary | `#1E40AF` | White | 无 | 8px |
| Primary hover | `#1E3A8A` | White | 无 | 8px |
| Success | `#22C55E` | White | 无 | 8px |
| Danger | `#EF4444` | White | 无 | 8px |
| Outline | 透明 | `#1E40AF` | `#1E40AF` | 8px |

过渡：`transition: all 0.2s ease`

### 卡片

- 背景：`#FFFFFF`
- 阴影：`0 1px 3px rgba(0,0,0,0.1)`
- 圆角：`8px`
- 内边距：`1.5rem`
- hover 阴影加深：`0 4px 12px rgba(0,0,0,0.12)`

### 输入框 / 表单

- 边框：`1px solid #CBD5E1`
- 聚焦态：`border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15)`
- 圆角：`6px`
- Label 在上方，不依赖 placeholder

### 导航栏

- 背景：`#1E40AF`
- 文字：白色
- 高度：`64px`（含内边距）
- 激活项：底部白色下划线或背景色加深
- 固定顶部，z-index 保证置顶

### 进度条

- Bootstrap 原生 progress
- 背景：`#E2E8F0`
- 填充：`#22C55E` (正确进度)
- 高度：`8px`
- 圆角：`4px`

### 计时器

- 字体：Poppins 700
- 字号：2rem (32px)
- 正常：`#1E40AF`
- 少于 30s：`#F59E0B` + 轻微脉冲
- 少于 10s：`#EF4444` + 脉冲

### 模态框

- 遮罩：`rgba(0,0,0,0.5)`
- 内容：居中白色卡片
- 圆角：`12px`
- 用于：删除确认、导入弹窗

### 表格

- 条纹行：`:nth-child(even) { background: #F8FAFC }`
- 行 hover：`#EFF6FF`
- 表头：`#1E40AF` 背景白色文字或 `#F1F5F9` 背景深色文字

### 选择题选项

- 样式：Bootstrap btn-group 样式或单选卡片
- 选中：蓝色边框 + 浅蓝背景
- 正确/错误反馈：绿色/红色边框，瞬时变化

## 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| xs | < 576px | 单列，导航折叠 |
| sm | ≥ 576px | 单列 |
| md | ≥ 768px | 双列网格可用 |
| lg | ≥ 992px | 完整布局 |
| xl | ≥ 1200px | 最大宽度容器 |

## 动画规则

- 过渡统一 `150-300ms ease`
- 页面切换：淡入 `fadeIn 0.2s`
- 结果页分数：数字递增动画
- 计时器 < 10s：脉冲闪烁吸引注意
- 尊重 `prefers-reduced-motion`

## icon 使用

- 统一使用 Bootstrap Icons
- 所有可点击元素添加 `cursor: pointer`
- hover 态有视觉反馈（颜色变化或阴影加深）
