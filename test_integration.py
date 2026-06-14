import uuid
from main import app
from fastapi.testclient import TestClient
import pytest


BANK_DATA = {
    "title": "测试题库",
    "description": "这是一个测试",
    "questions": [
        {"type": "choice", "chapter": "基础", "content": "1+1=?", "options": ["A.1", "B.2", "C.3", "D.4"], "answer": "B"},
        {"type": "fill", "chapter": "基础", "content": "中国的首都是____", "answer": "北京"},
        {"type": "fill", "chapter": "进阶", "content": "四大发明是____、____、____和____", "answer": ["造纸术", "印刷术", "火药", "指南针"]},
        {"type": "judge", "chapter": "基础", "content": "地球是圆的", "answer": "对"},
        {"type": "multiple", "chapter": "基础", "content": "以下哪些是数字？", "options": ["A. 一", "B. 二", "C. 三", "D. 四"], "answer": ["A", "B", "C", "D"]},
    ],
}

ANSWERS = [
    ("choice", "B"),
    ("fill", "上海"),
    ("fill", ["造纸术", "印刷术", "火药", "指南针"]),
    ("judge", "错"),
    ("multiple", ["A", "B", "C", "D"]),
]


class State:
    """模块级可变状态，在测试间传递数据"""
    token = None
    username = None
    bank_id = None
    exam_id = None
    nav_exam_id = None
    correct_count = 0


state = State()


# ── Fixtures ──


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_headers(client):
    suffix = uuid.uuid4().hex[:8]
    state.username = f"test_{suffix}"
    r = client.post("/api/auth/register", json={"username": state.username, "password": "123456"})
    assert r.status_code == 200, f"注册失败: {r.text}"
    state.token = r.json()["access_token"]
    return {"Authorization": f"Bearer {state.token}"}


# ── Test: 注册 + 题库导入 ──


def test_01_register(auth_headers):
    assert state.token is not None
    assert state.username is not None


def test_02_import_bank(client, auth_headers):
    r = client.post("/api/question-banks/import", json=BANK_DATA, headers=auth_headers)
    assert r.status_code == 201, f"导入失败: {r.text}"
    state.bank_id = r.json()["id"]
    assert r.json()["question_count"] == 5


def test_03_list_banks(client, auth_headers):
    r = client.get("/api/question-banks", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


# ── Test: 答题流程 ──


def test_04_start_exam(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice", "fill", "judge", "multiple"],
        "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    assert r.status_code == 200
    state.exam_id = r.json()["exam_id"]
    assert r.json()["total_count"] == 5


def test_05_answer_all(client, auth_headers):
    exam_id = state.exam_id
    correct_count = 0
    for i, (qtype, ans) in enumerate(ANSWERS, 1):
        r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["question"] is not None, f"没有题目了 (index {data['current_index']})"
        qid = data["question"]["id"]
        r = client.post(f"/api/exam/{exam_id}/answer", json={
            "exam_id": exam_id, "question_id": qid,
            "user_answer": ans, "time_spent_seconds": 5,
        }, headers=auth_headers)
        assert r.status_code == 200
        if r.json()["is_correct"]:
            correct_count += 1
    state.correct_count = correct_count
    assert correct_count == 3


def test_06_exam_result(client, auth_headers):
    r = client.get(f"/api/exam/{state.exam_id}/result", headers=auth_headers)
    assert r.status_code == 200
    res = r.json()
    assert res["total_count"] == 5
    assert res["correct_count"] == state.correct_count


# ── Test: 错题本 + 历史 ──


def test_07_wrong_answers(client, auth_headers):
    r = client.get("/api/wrong-answers", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_08_history(client, auth_headers):
    r = client.get("/api/history", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_09_history_detail(client, auth_headers):
    r = client.get(f"/api/history/{state.exam_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["exam_id"] == state.exam_id


def test_10_dashboard(client, auth_headers):
    r = client.get("/api/dashboard", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["total_banks"] >= 1
    assert d["total_exams"] >= 1


def test_11_static_file(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "刷题在线" in r.text


# ── Test: 题库详情 + 删除 ──


def test_12_bank_detail(client, auth_headers):
    r = client.get(f"/api/question-banks/{state.bank_id}", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()["questions"]) == 5


def test_13_delete_bank(client, auth_headers):
    r = client.delete(f"/api/question-banks/{state.bank_id}", headers=auth_headers)
    assert r.status_code == 204


def test_14_verify_delete(client, auth_headers):
    r = client.get("/api/question-banks", headers=auth_headers)
    assert len(r.json()) == 0


# ── Test: 重新导入 + 答题导航 ──


def test_15_reimport(client, auth_headers):
    r = client.post("/api/question-banks/import", json=BANK_DATA, headers=auth_headers)
    assert r.status_code == 201
    state.bank_id = r.json()["id"]


def test_16_start_exam_for_nav(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice", "fill", "judge", "multiple"],
        "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    assert r.status_code == 200
    state.nav_exam_id = r.json()["exam_id"]
    assert r.json()["total_count"] == 5


def test_17_answer_q1(client, auth_headers):
    r = client.get(f"/api/exam/{state.nav_exam_id}/current", headers=auth_headers)
    q1_id = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{state.nav_exam_id}/answer", json={
        "exam_id": state.nav_exam_id, "question_id": q1_id,
        "user_answer": "B", "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.json()["is_correct"]


def test_18_navigate_index_0(client, auth_headers):
    r = client.get(f"/api/exam/{state.nav_exam_id}/current?index=0", headers=auth_headers)
    data = r.json()
    assert data["current_index"] == 1
    assert data["is_answered"] is True
    assert data["user_answer"] is not None
    assert data["is_correct"] is True
    assert data["correct_answer"] is not None


def test_19_navigate_index_1(client, auth_headers):
    r = client.get(f"/api/exam/{state.nav_exam_id}/current?index=1", headers=auth_headers)
    data = r.json()
    assert data["current_index"] == 2
    assert data["is_answered"] is False
    assert data["question"] is not None
    assert data["question"]["answer"] is None


def test_20_navigate_out_of_bounds(client, auth_headers):
    r = client.get(f"/api/exam/{state.nav_exam_id}/current?index=999", headers=auth_headers)
    assert r.status_code == 400


# ── Test: 背题模式 ──


def test_22_review_questions(client, auth_headers):
    r = client.post("/api/review/questions", json={
        "bank_ids": [state.bank_id],
        "types": ["choice", "fill", "judge", "multiple"],
    }, headers=auth_headers)
    assert r.status_code == 200
    questions = r.json()
    assert len(questions) == 5
    for q in questions:
        assert q["answer"] is not None
        assert q["review_status"] is None


def test_23_mark_known(client, auth_headers):
    r = client.post("/api/review/questions", json={
        "bank_ids": [state.bank_id],
        "types": ["choice", "fill", "judge", "multiple"],
    }, headers=auth_headers)
    first_qid = r.json()[0]["id"]
    r = client.post("/api/review/mark", json={
        "question_id": first_qid, "status": "known",
    }, headers=auth_headers)
    stats = r.json()
    assert stats["known_count"] == 1
    assert stats["reviewing_count"] == 0
    assert stats["total_reviewed"] == 1
    state._review_first_qid = first_qid


def test_24_mark_reviewing(client, auth_headers):
    r = client.post("/api/review/mark", json={
        "question_id": state._review_first_qid, "status": "reviewing",
    }, headers=auth_headers)
    stats = r.json()
    assert stats["known_count"] == 0
    assert stats["reviewing_count"] == 1
    assert stats["total_reviewed"] == 1


def test_25_review_stats(client, auth_headers):
    r = client.get("/api/review/stats", headers=auth_headers)
    stats = r.json()
    assert stats["total_reviewed"] >= 1


def test_26_filter_reviewing_only(client, auth_headers):
    r = client.post("/api/review/mark", json={
        "question_id": state._review_first_qid, "status": "known",
    }, headers=auth_headers)
    assert r.status_code == 200
    r = client.post("/api/review/questions", json={
        "bank_ids": [state.bank_id],
        "show_reviewing_only": True,
    }, headers=auth_headers)
    filtered = r.json()
    known_ids = [q["id"] for q in filtered if q["review_status"] == "known"]
    assert len(known_ids) == 0


def test_27_review_type_filter_choice(client, auth_headers):
    r = client.post("/api/review/questions", json={
        "bank_ids": [state.bank_id],
        "types": ["choice"],
    }, headers=auth_headers)
    type_filtered = r.json()
    assert len(type_filtered) == 1
    assert type_filtered[0]["type"] == "choice"


def test_28_review_type_filter_multiple(client, auth_headers):
    r = client.post("/api/review/questions", json={
        "bank_ids": [state.bank_id],
        "types": ["multiple"],
    }, headers=auth_headers)
    multi_filtered = r.json()
    assert len(multi_filtered) == 1
    assert multi_filtered[0]["type"] == "multiple"
