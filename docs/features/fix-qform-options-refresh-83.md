# 修复新增题目选项输入后答案候选不刷新（#83）

**日期：** 2026-07-06  &emsp; **关联 Issue：** [#83](https://github.com/Liao-Ke/shuati-online/issues/83)

## 目标

新增选择题/多选题时，用户在"选项"textarea 输入内容后，"答案"区域的 radio/checkbox 候选不会刷新，导致无法选择正确答案、无法保存题目。本次修复使选项输入实时触发答案候选渲染。

## 修改范围

- `static/index.html`：在 `qform-options` textarea 上添加 `oninput="onQFormTypeChange()"`

## 核心实现

`onQFormTypeChange()`（app.js:2077）已实现按行拆分选项文本、生成 A/B/C… 标签、渲染 radio（choice）/checkbox（multiple）候选到 `qform-answer-group`。但该函数仅在题型 select 的 `onchange` 和弹窗打开时被调用，textarea 输入时不会触发。

修复方式：在 `qform-options` textarea 绑定 `oninput="onQFormTypeChange()"`，使用户输入/编辑/粘贴选项时答案候选立即刷新。

```html
<textarea class="form-control" id="qform-options" rows="4"
          placeholder="选项一&#10;选项二&#10;选项三&#10;选项四"
          oninput="onQFormTypeChange()"></textarea>
```

## 影响范围

- 仅影响前端事件绑定，一行 HTML 属性变更
- 不改变 `onQFormTypeChange()` 的渲染逻辑
- 不改变后端、数据结构、API
- 编辑题目流程（`showEditQuestion`）行为保持一致；用户调整选项时也会刷新，属预期正向行为

## 验证方式

1. `node --check static/js/app.js` 语法校验通过
2. `ruff check .` 通过
3. `pytest test_integration.py -v` 全绿
4. 手动验证：新增 choice/multiple 题目 → 输入选项 → 答案区立即出现对应 radio/checkbox → 选中并保存成功；编辑已有题目回归验证

## 已知限制

- 纯前端 DOM 事件修复，无法通过 TestClient 集成测试覆盖；以 `node --check` 语法校验作为最低自动化验证
