## Purpose

支持在题库内对单道题目进行增、删、改操作，覆盖四种题型（choice/fill/judge/multiple）。解决导入后无法修改题目的问题。

## ADDED Requirements

### Requirement: 用户可在题库中新增单道题目

用户在题库详情页点击"新增题目"按钮，弹出编辑表单，填写题目信息后提交即添加到题库末尾。

#### Scenario: 新增选择题
- **WHEN** 用户在题库详情页选择新增选择题，填写题目内容、章节、选项（至少2个）、答案和解析并提交
- **THEN** 系统返回新题目信息，包含自动分配的 sort_order，题库详情中可见该题

#### Scenario: 新增填空题
- **WHEN** 用户新增填空题，填写题目内容、答案（单空时提交字符串，多空时提交数组）并提交
- **THEN** 系统成功创建填空题，在详情页中按 sort_order 排列显示

#### Scenario: 新增判断题
- **WHEN** 用户新增判断题，填写内容、答案（对/错）并提交
- **THEN** 系统成功创建判断题

#### Scenario: 新增多选题
- **WHEN** 用户新增多选题，填写内容、选项、答案（多选，数组提交）并提交
- **THEN** 系统成功创建多选题

#### Scenario: 新增题目到不存在的题库
- **WHEN** 用户向不存在的 bank_id 新增题目
- **THEN** 系统返回 404 错误

### Requirement: 用户可编辑已有题目

用户在题库详情页或查看题目时点击"编辑"，在弹窗中修改题目内容后保存。

#### Scenario: 编辑题目所有字段
- **WHEN** 用户修改题目的 type、content、chapter、options、answer、analysis 并保存
- **THEN** 系统更新该题目的所有字段，后续答题和背题使用更新后的内容

#### Scenario: 编辑后试卷中已回答题目不受影响
- **WHEN** 用户编辑了一道已经存在于某个 ExamRecord 中的题目
- **THEN** 该 ExamRecord 已经记录的 AnswerRecord 不受影响，继续显示原有答案

#### Scenario: 编辑不存在的题目
- **WHEN** 用户提交对不存在的 question_id 的编辑
- **THEN** 系统返回 404 错误

#### Scenario: 编辑题目时切换题型
- **WHEN** 用户将 choice 题改为 fill 题，同时清空 options 字段
- **THEN** 系统更新题目 type 和 content，options 置空，原有 answer 保留

### Requirement: 用户可删除题目

用户在题库详情页可删除某道题目，删除后该题不再参与答题和背题。

#### Scenario: 删除成功
- **WHEN** 用户确认删除某道题目
- **THEN** 系统删除该题目，题库详情中不再显示该题，总题数减1

#### Scenario: 删除已存在于答题记录中的题目
- **WHEN** 用户删除某道已被答过的题目
- **THEN** 题目从题库移除，但已有的 AnswerRecord 和 ReviewRecord 记录保留，历史详情中显示"题目已删除"

#### Scenario: 删除不存在的题目
- **WHEN** 用户删除不存在的 question_id
- **THEN** 系统返回 404

### Requirement: 行内校验题目数据的合法性

后端在新增和编辑题目时校验必要字段。

#### Scenario: 选择题缺少 options
- **WHEN** 用户提交 type=choice 但 options 为空或少于2个
- **THEN** 系统返回 400 和错误信息"选择题至少需要2个选项"

#### Scenario: 多选题答案超出选项范围
- **WHEN** 用户提交 type=multiple 但 answer 包含 options 中不存在的值
- **THEN** 系统返回 400 和错误信息"答案超出选项范围"
