import json
import sys
sys.path.insert(0, '.')

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

suffix = __import__('uuid').uuid4().hex[:8]
username = f"test_{suffix}"

# 1. Register
r = client.post('/api/auth/register', json={'username': username, 'password': '123456'})
assert r.status_code == 200, f"注册失败: {r.text}"
data = r.json()
token = data['access_token']
headers = {'Authorization': f'Bearer {token}'}
print(f'1. Register/Login: {username}')

# 2. Import bank
bank_data = {
    "title": "测试题库",
    "description": "这是一个测试",
    "questions": [
        {"type": "choice", "chapter": "基础", "content": "1+1=?", "options": ["A.1", "B.2", "C.3", "D.4"], "answer": "B"},
        {"type": "fill", "chapter": "基础", "content": "中国的首都是____", "answer": "北京"},
        {"type": "fill", "chapter": "进阶", "content": "四大发明是____、____、____和____", "answer": ["造纸术", "印刷术", "火药", "指南针"]},
        {"type": "judge", "chapter": "基础", "content": "地球是圆的", "answer": "对"},
    ]
}
r = client.post('/api/question-banks/import', json=bank_data, headers=headers)
assert r.status_code == 201, f"导入失败: {r.text}"
bank_id = r.json()['id']
print(f'2. Import bank: id={bank_id}, {r.json()["question_count"]} 题')

# 3. List banks
r = client.get('/api/question-banks', headers=headers)
assert r.status_code == 200
print(f'3. List banks: {len(r.json())} 个')

# 4. Start exam
r = client.post('/api/exam/start', json={
    "bank_ids": [bank_id], "mode": "sequential",
    "types": ["choice", "fill", "judge"],
    "choice_timeout": 30, "judge_fill_timeout": 60
}, headers=headers)
exam_id = r.json()['exam_id']
total = r.json()['total_count']
print(f'4. Start exam: id={exam_id}, total={total}')

# 5. Answer all questions
correct_count = 0
answers = [
    ("choice", "B"),  # Correct
    ("fill", "上海"),  # Wrong
    ("fill", ["造纸术", "印刷术", "火药", "指南针"]),  # Correct
    ("judge", "错"),  # Wrong
]
for i, (qtype, ans) in enumerate(answers, 1):
    r = client.get(f'/api/exam/{exam_id}/current', headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data['question'] is not None, f"没有题目了 (index {data['current_index']})"
    qid = data['question']['id']
    r = client.post(f'/api/exam/{exam_id}/answer', json={
        "exam_id": exam_id, "question_id": qid,
        "user_answer": ans, "time_spent_seconds": 5
    }, headers=headers)
    res = r.json()
    if res['is_correct']:
        correct_count += 1
    print(f'   Q{i} ({qtype}): ans={ans} -> {"✓" if res["is_correct"] else "✗"} correct_ans={res["correct_answer"]}')

print(f'5. Correct: {correct_count}/{total}')

# 6. Exam result
r = client.get(f'/api/exam/{exam_id}/result', headers=headers)
res = r.json()
assert res['total_count'] == total
assert res['correct_count'] == correct_count
print(f'6. Result: {res["correct_count"]}/{res["total_count"]} correct, accuracy={res["accuracy"]}')

# 7. Wrong answers
r = client.get('/api/wrong-answers', headers=headers)
wrongs = r.json()
print(f'7. Wrong answers: {len(wrongs)} 道')

# 8. History
r = client.get('/api/history', headers=headers)
history = r.json()
print(f'8. History: {len(history)} 条记录')

# 9. History detail
r = client.get(f'/api/history/{exam_id}', headers=headers)
assert r.status_code == 200
detail = r.json()
assert detail['exam_id'] == exam_id
print(f'9. History detail: {detail["total_count"]} 题')

# 10. Dashboard
r = client.get('/api/dashboard', headers=headers)
d = r.json()
assert d['total_banks'] == 1
assert d['total_exams'] >= 1
print(f'10. Dashboard: banks={d["total_banks"]}, qs={d["total_questions"]}, exams={d["total_exams"]}')

# 11. Static file serving
r = client.get('/')
assert r.status_code == 200
assert '刷题在线' in r.text
print(f'11. Static index.html: OK')

# 12. Bank detail
r = client.get(f'/api/question-banks/{bank_id}', headers=headers)
assert r.status_code == 200
bank = r.json()
assert len(bank['questions']) == 4
print(f'12. Bank detail: {len(bank["questions"])} 题, chapters: {set(q.get("chapter") for q in bank["questions"])}')

# 13. Delete bank
r = client.delete(f'/api/question-banks/{bank_id}', headers=headers)
assert r.status_code == 204
print(f'13. Delete bank: OK')

# 14. Verify bank deleted
r = client.get('/api/question-banks', headers=headers)
assert len(r.json()) == 0
print(f'14. Verify deleted: {len(r.json())} banks')

# 15. Re-import bank for review test
r = client.post('/api/question-banks/import', json=bank_data, headers=headers)
assert r.status_code == 201
new_bank_id = r.json()['id']
print(f'15. Re-import bank: id={new_bank_id}')

# 16. Review questions
r = client.post('/api/review/questions', json={
    "bank_ids": [new_bank_id],
    "types": ["choice", "fill", "judge"],
}, headers=headers)
assert r.status_code == 200
questions = r.json()
assert len(questions) == 4
for q in questions:
    assert q['answer'] is not None  # 答案可见
    assert q['review_status'] is None  # 未标记过
print(f'16. Review questions: {len(questions)} 题, 所有答案可见')

# 17. Mark question as known
first_qid = questions[0]['id']
r = client.post('/api/review/mark', json={
    "question_id": first_qid, "status": "known",
}, headers=headers)
assert r.status_code == 200
stats = r.json()
assert stats['known_count'] == 1
assert stats['reviewing_count'] == 0
assert stats['total_reviewed'] == 1
print(f'17. Mark known: OK, stats={stats}')

# 18. Mark question as reviewing
r = client.post('/api/review/mark', json={
    "question_id": first_qid, "status": "reviewing",
}, headers=headers)
assert r.status_code == 200
stats = r.json()
assert stats['known_count'] == 0
assert stats['reviewing_count'] == 1
assert stats['total_reviewed'] == 1
print(f'18. Mark reviewing: OK, stats={stats}')

# 19. Review stats
r = client.get('/api/review/stats', headers=headers)
stats = r.json()
assert stats['total_reviewed'] == 1
print(f'19. Stats: {stats}')

# 20. Filter by show_reviewing_only (mark first as known first, then only reviewing should show)
r = client.post('/api/review/mark', json={
    "question_id": first_qid, "status": "known",
}, headers=headers)
assert r.status_code == 200
r = client.post('/api/review/questions', json={
    "bank_ids": [new_bank_id],
    "show_reviewing_only": True,
}, headers=headers)
filtered = r.json()
known_ids = [q['id'] for q in filtered if q['review_status'] == 'known']
assert len(known_ids) == 0  # 不应包含已掌握的
print(f'20. Show reviewing only: {len(filtered)} 题, 已排除已掌握的')

# 21. Review with type filter
r = client.post('/api/review/questions', json={
    "bank_ids": [new_bank_id],
    "types": ["choice"],
}, headers=headers)
type_filtered = r.json()
assert len(type_filtered) == 1
assert type_filtered[0]['type'] == 'choice'
print(f'21. Type filter: {len(type_filtered)} 题')

print('\n=== All 21 tests passed! ===')
