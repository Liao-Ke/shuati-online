# 修复 start_exam 把未经归属校验的 bank_ids 写入考试快照（issue #125）

## 背景

`start_exam` 用 `QuestionBank.user_id == user.id` 过滤出 `banks` 后只断言"至少有一个是自己的"即放行，随后却把用户原始请求体 `data.bank_ids` 整体存进 `exam.bank_ids`。快照因此成为攻击者可控、可指向任意他人题库的集合。单独看不直接泄露数据，但破坏了下游 `_load_all_exam_questions` 用 `Question.bank_id.in_(bank_ids)` 收窄取题范围的隐含归属前提——与 #123（取题不校验题目归属）组合后，SQLite rowid 复用可被定向利用读到他人题目。

## 修改范围

- `routers/exam.py`：`start_exam` 创建 `ExamRecord` 时改存已通过归属校验的 `[b.id for b in banks]`，不再存原始请求。采用 issue 推荐的零行为变更修法：正常请求下 `banks` 就是 `data.bank_ids` 对应的全部题库；保留既有"部分题库不属于自己也放行"的宽松语义。与 `routers/review.py` 中已有的同款写法保持一致。
- `test_integration.py`：新增 `test_125_start_exam_stores_only_owned_bank_ids`，第二个用户导入题库后，攻击者混入其题库 id 开考，直接查库断言快照只含自己的题库 id。已反向验证：撤销修复时该测试失败。

## 验证

- 本地执行 `pytest test_integration.py -q`，140 个测试全部通过；`pytest test_auth.py -q` 4 个通过。
- 未引入新依赖，未改动数据结构、接口签名或前端。

## 已知限制

- 存量 `exam_records` 中已被污染的快照不做数据迁移：其 `question_ids` 快照只含用户自己的题目，风险来源是 id 复用（#123），修复 #123 后即无法利用。
- 根因的另一半在 #123（读取路径不校验题目归属），两者独立可修，本修复只挡住"定向指定受害者题库"这一环。
