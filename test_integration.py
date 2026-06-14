import json
import sys
sys.path.insert(0, '.')

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

# 1. Register
r = client.post('/api/auth/register', json={'username': 'test', 'password': '123456'})
assert r.status_code == 200, f"注册失败: {r.text}"
data = r.json()
token = data['access_token']
headers = {'Authorization': f'Bearer {token}'}
print('1. Register/Login: OK')

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
print(f'2. Import bank: {r.json()["question_count"]} 题')

# 3. List banks
r = client.get('/api/question-banks', headers=headers)
assert r.status_code == 200
print(f'3. List banks: {len(r.json())} 个')

# 4. Start exam
r = client.post('/api/exam/start', json={
    "bank_ids": [1], "mode": "sequential",
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
r = client.get('/api/question-banks/1', headers=headers)
assert r.status_code == 200
bank = r.json()
assert len(bank['questions']) == 4
print(f'12. Bank detail: {len(bank["questions"])} 题, chapters: {set(q.get("chapter") for q in bank["questions"])}')

# 13. Delete bank
r = client.delete('/api/question-banks/1', headers=headers)
assert r.status_code == 204
print(f'13. Delete bank: OK')

# 14. Verify bank deleted
r = client.get('/api/question-banks', headers=headers)
assert len(r.json()) == 0
print(f'14. Verify deleted: {len(r.json())} banks')

print('\n=== All 14 tests passed! ===')
