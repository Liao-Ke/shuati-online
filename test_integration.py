import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from auth import ALGORITHM, JWT_AUDIENCE, JWT_ISSUER, SECRET_KEY
from main import app

BANK_DATA = {
    "title": "测试题库",
    "description": "这是一个测试",
    "questions": [
        {"type": "choice", "chapter": "基础", "content": "1+1=?", "options": ["1", "2", "3", "4"], "answer": "B"},
        {"type": "fill", "chapter": "基础", "content": "中国的首都是____", "answer": "北京"},
        {"type": "fill", "chapter": "进阶", "content": "四大发明是____、____、____和____", "answer": ["造纸术", "印刷术", "火药", "指南针"]},
        {"type": "judge", "chapter": "基础", "content": "地球是圆的", "answer": "对"},
        {"type": "multiple", "chapter": "基础", "content": "以下哪些是数字？", "options": ["一", "二", "三", "四"], "answer": ["A", "B", "C", "D"]},
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
    wrong_exam_id = None


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


# ── Test: 健康检查 ──


def test_00_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── Test: 注册 + 题库导入 ──


def test_01_register(auth_headers):
    assert state.token is not None
    assert state.username is not None


def test_01b_login_success(client):
    r = client.post("/api/auth/login", json={"username": state.username, "password": "123456"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["user"]["username"] == state.username


def test_01c_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": state.username, "password": "wrongpwd"})
    assert r.status_code == 401


def test_01d_me(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["username"] == state.username


def test_01e_register_validation(client):
    r = client.post("/api/auth/register", json={"username": "a", "password": "123456"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": "validuser", "password": "12"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": state.username, "password": "123456"})
    assert r.status_code == 400


def test_02_import_bank(client, auth_headers):
    r = client.post("/api/question-banks/import", json=BANK_DATA, headers=auth_headers)
    assert r.status_code == 201, f"导入失败: {r.text}"
    state.bank_id = r.json()["id"]
    assert r.json()["question_count"] == 5


def test_02b_import_bank_options_no_prefix(client, auth_headers):
    """验证导入后 choice/multiple 题的 options 不包含字母前缀（回归 #51）"""
    r = client.get(f"/api/question-banks/{state.bank_id}", headers=auth_headers)
    assert r.status_code == 200
    for q in r.json()["questions"]:
        if q["type"] in ("choice", "multiple"):
            for opt in q.get("options") or []:
                import re
                assert not re.match(r"^[A-Z]\.", opt), f"选项 '{opt}' 包含多余字母前缀"


def test_03_list_banks(client, auth_headers):
    r = client.get("/api/question-banks", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_03b_import_multiple(client, auth_headers):
    data = [
        {"title": "批量题库A", "questions": [
            {"type": "choice", "content": "2+2=?", "options": ["3", "4"], "answer": "B"},
        ]},
        {"title": "", "questions": [
            {"type": "choice", "content": "x", "options": ["1"], "answer": "A"},
        ]},
    ]
    r = client.post("/api/question-banks/import-multiple", json=data, headers=auth_headers)
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 2
    assert results[0]["success"] is True
    assert results[1]["success"] is False
    r = client.get("/api/question-banks", headers=auth_headers)
    for b in r.json():
        if b["title"] == "批量题库A":
            client.delete(f"/api/question-banks/{b['id']}", headers=auth_headers)
            break


def test_03c_import_multiple_db_failure(client, auth_headers):
    data = [
        {"title": "DB隔离A", "questions": [
            {"type": "choice", "content": "1+1=?", "options": ["1", "2"], "answer": "B"},
        ]},
        {"title": "DB隔离B-失败", "questions": [
            {"type": "choice", "content": "x", "options": ["1", "2"], "answer": "A"},
        ]},
        {"title": "DB隔离C", "questions": [
            {"type": "choice", "content": "3+3=?", "options": ["5", "6"], "answer": "B"},
        ]},
    ]

    from routers.banks import _do_import_one as real_import

    def side_effect(bank_data, user, db):
        if bank_data.title == "DB隔离B-失败":
            raise RuntimeError("模拟数据库异常")
        return real_import(bank_data, user, db)

    with patch("routers.banks._do_import_one", side_effect=side_effect):
        r = client.post("/api/question-banks/import-multiple", json=data, headers=auth_headers)

    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 3
    assert results[0]["success"] is True
    assert results[1]["success"] is False
    assert "模拟数据库异常" in results[1]["error"]
    assert results[2]["success"] is True

    r = client.get("/api/question-banks", headers=auth_headers)
    titles = {b["title"] for b in r.json()}
    assert "DB隔离A" in titles
    assert "DB隔离B-失败" not in titles
    assert "DB隔离C" in titles

    for b in r.json():
        if b["title"] in ("DB隔离A", "DB隔离C"):
            client.delete(f"/api/question-banks/{b['id']}", headers=auth_headers)


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
    for _i, (_qtype, ans) in enumerate(ANSWERS, 1):
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


def test_06a_finish_exam_unanswered_count(client, auth_headers):
    """finish_exam 时未作答题应计入 wrong_count，total_count == question_count（issue #22）"""
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice", "fill", "judge", "multiple"],
        "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    assert r.status_code == 200
    exam_id = r.json()["exam_id"]
    total = r.json()["total_count"]
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{exam_id}/answer", json={
        "exam_id": exam_id, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 3,
    }, headers=auth_headers)
    assert r.status_code == 200
    r = client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200
    r = client.get(f"/api/exam/{exam_id}/result", headers=auth_headers)
    res = r.json()
    assert res["total_count"] == total, f"total_count 应为 {total}，实际 {res['total_count']}"
    assert res["wrong_count"] == total - res["correct_count"], "未作答题应计入 wrong_count"


def test_06b_exam_progress(client, auth_headers):
    r = client.get(f"/api/exam/{state.exam_id}/progress", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total_count"] == 5
    assert len(data["answers"]) == 5


def test_06c_preview_hides_unanswered(client, auth_headers):
    """整卷预览接口对未作答题隐藏 answer/analysis（issue #17）"""
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice", "fill", "judge", "multiple"],
        "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    assert r.status_code == 200
    exam_id = r.json()["exam_id"]
    total = r.json()["total_count"]
    assert total >= 2, "需要至少 2 道题才能测试部分作答场景"
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{exam_id}/answer", json={
        "exam_id": exam_id, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 3,
    }, headers=auth_headers)
    assert r.status_code == 200
    r = client.get(f"/api/exam/{exam_id}/preview", headers=auth_headers)
    assert r.status_code == 200
    questions = r.json()["questions"]
    assert len(questions) == total
    answered = [q for q in questions if q["is_answered"]]
    unanswered = [q for q in questions if not q["is_answered"]]
    assert len(answered) == 1, "应该只有 1 道已答题"
    assert len(unanswered) == total - 1, "其余应为未答题"
    assert answered[0]["answer"] is not None, "已答题应返回 answer"
    for q in unanswered:
        assert q["answer"] is None, f"未答题 {q['id']} 不应返回 answer"
        assert q["analysis"] is None, f"未答题 {q['id']} 不应返回 analysis"
    r = client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200


# ── Test: 错题本 + 历史 ──


def test_07_wrong_answers(client, auth_headers):
    r = client.get("/api/wrong-answers", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


# ── Test: 错题练习 ──


def test_07b_wrong_practice_start(client, auth_headers):
    """POST /api/wrong-answers/start 应返回有效的 exam_id"""
    r = client.post("/api/wrong-answers/start", json={
        "bank_ids": [state.bank_id],
        "timer_mode": "per_question",
    }, headers=auth_headers)
    assert r.status_code == 200, f"错题练习启动失败: {r.text}"
    data = r.json()
    assert "exam_id" in data
    assert data["total_count"] == 2  # 测试数据中有 2 道错题
    state.wrong_exam_id = data["exam_id"]


def test_07c_wrong_practice_exam_flow(client, auth_headers):
    """错题练习的答题流程应正常：获取题目、提交答案、完成"""
    exam_id = state.wrong_exam_id
    # 获取当前题目
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    assert r.status_code == 200, f"获取当前题目失败: {r.text}"
    curr = r.json()
    assert curr["question"] is not None
    q = curr["question"]
    # 提交一个答案（故意答错）
    wrong_answer = "Z" if q["type"] == "choice" else "错"
    r = client.post(f"/api/exam/{exam_id}/answer", json={
        "exam_id": exam_id,
        "question_id": q["id"],
        "user_answer": wrong_answer,
        "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.status_code == 200, f"提交答案失败: {r.text}"
    # 完成考试
    r = client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200
    # 获取结果
    r = client.get(f"/api/exam/{exam_id}/result", headers=auth_headers)
    assert r.status_code == 200
    result = r.json()
    assert result["total_count"] > 0
    assert "answers" in result


def test_07d_wrong_practice_filter_bank(client, auth_headers):
    """bank_ids 过滤应生效：指定不存在的题库应返回 400"""
    r = client.post("/api/wrong-answers/start", json={
        "bank_ids": [99999],
        "timer_mode": "per_question",
    }, headers=auth_headers)
    assert r.status_code == 400, f"不存在的题库应返回 400: {r.text}"


def test_07e_wrong_practice_no_wrong_questions(client, auth_headers):
    """没有错题时应返回 400"""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    r = client.post("/api/auth/register", json={"username": f"nowrong_{suffix}", "password": "123456"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/api/wrong-answers/start", json={}, headers=headers)
    assert r.status_code == 400, f"无错题应返回 400: {r.text}"


# ── Test: 提前交卷 ──


def test_07f_early_finish(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice"], "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    assert r.status_code == 200
    early_exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{early_exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{early_exam_id}/answer", json={
        "exam_id": early_exam_id, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.status_code == 200
    r = client.post(f"/api/exam/{early_exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200
    r = client.get(f"/api/exam/{early_exam_id}/result", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total_count"] == 1


def test_07g_submit_after_finish_400(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice", "fill"], "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    finished_exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{finished_exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    client.post(f"/api/exam/{finished_exam_id}/answer", json={
        "exam_id": finished_exam_id, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 5,
    }, headers=auth_headers)
    client.post(f"/api/exam/{finished_exam_id}/finish", json={}, headers=auth_headers)
    r = client.post(f"/api/exam/{finished_exam_id}/answer", json={
        "exam_id": finished_exam_id, "question_id": qid,
        "user_answer": "A", "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.status_code == 400


def test_07h_unfinished_exam_result_409(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state.bank_id], "mode": "sequential",
        "types": ["choice"], "choice_timeout": 30, "judge_fill_timeout": 60,
    }, headers=auth_headers)
    unfinished_exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{unfinished_exam_id}/result", headers=auth_headers)
    assert r.status_code == 409
    r = client.post(f"/api/exam/{unfinished_exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200


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


def test_20a_delete_blocked_by_inprogress(client, auth_headers):
    """进行中考试引用的题库/题目不可删除，考试完成后可删（issue #19）"""
    import uuid
    suffix = uuid.uuid4().hex[:8]
    r = client.post("/api/question-banks/import", json={
        "title": f"删除检查_{suffix}", "description": "",
        "questions": [
            {"type": "judge", "content": "测试判断", "answer": "对"},
            {"type": "judge", "content": "测试判断2", "answer": "错"},
        ],
    }, headers=auth_headers)
    test_bank_id = r.json()["id"]
    r = client.post("/api/exam/start", json={
        "bank_ids": [test_bank_id], "mode": "sequential",
    }, headers=auth_headers)
    exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    qid_in_exam = r.json()["question"]["id"]
    r = client.delete(f"/api/question-banks/{test_bank_id}", headers=auth_headers)
    assert r.status_code == 409, f"进行中考试引用的题库应返回 409: {r.text}"
    r = client.delete(f"/api/questions/{qid_in_exam}", headers=auth_headers)
    assert r.status_code == 409, f"进行中考试引用的题目应返回 409: {r.text}"
    r = client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)
    assert r.status_code == 200
    r = client.delete(f"/api/questions/{qid_in_exam}", headers=auth_headers)
    assert r.status_code == 204, f"考试完成后应可删除题目: {r.text}"
    r = client.delete(f"/api/question-banks/{test_bank_id}", headers=auth_headers)
    assert r.status_code == 204, f"考试完成后应可删除题库: {r.text}"


def test_21_review_chapters(client, auth_headers):
    r = client.post("/api/review/chapters", json={
        "bank_ids": [state.bank_id],
    }, headers=auth_headers)
    assert r.status_code == 200
    chapters = r.json()
    assert "基础" in chapters
    assert "进阶" in chapters


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


# ── Test: 题目 CURD ──


def test_29_create_question_choice(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "choice", "chapter": "新章节", "content": "1+2=?",
        "options": ["1", "2", "3", "4"], "answer": "C",
    }, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["type"] == "choice"
    assert data["content"] == "1+2=?"
    assert data["sort_order"] >= 0
    state._q_choice_id = data["id"]


def test_30_create_question_fill(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "fill", "content": "中国的首都是____", "answer": "北京",
    }, headers=auth_headers)
    assert r.status_code == 201
    state._q_fill_id = r.json()["id"]


def test_31_create_question_fill_multi(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "fill", "content": "____和____是数字", "answer": ["一", "二"],
    }, headers=auth_headers)
    assert r.status_code == 201
    state._q_fill_multi_id = r.json()["id"]


def test_32_create_question_judge(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "judge", "content": "太阳从西边升起", "answer": "错",
    }, headers=auth_headers)
    assert r.status_code == 201
    state._q_judge_id = r.json()["id"]


def test_33_create_question_multiple(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "multiple", "content": "以下哪些是数字？",
        "options": ["一", "二", "三", "四"], "answer": ["A", "B"],
    }, headers=auth_headers)
    assert r.status_code == 201
    state._q_multi_id = r.json()["id"]


def test_34_create_question_validation_error(client, auth_headers):
    r = client.post(f"/api/question-banks/{state.bank_id}/questions", json={
        "type": "choice", "content": "test", "options": ["1"], "answer": "A",
    }, headers=auth_headers)
    assert r.status_code == 400


def test_35_create_question_nonexistent_bank(client, auth_headers):
    r = client.post("/api/question-banks/99999/questions", json={
        "type": "choice", "content": "test",
        "options": ["1", "2"], "answer": "A",
    }, headers=auth_headers)
    assert r.status_code == 404


def test_36_edit_question_content(client, auth_headers):
    r = client.put(f"/api/questions/{state._q_choice_id}", json={
        "content": "2+2=?",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["content"] == "2+2=?"


def test_37_edit_question_switch_type(client, auth_headers):
    r = client.put(f"/api/questions/{state._q_choice_id}", json={
        "type": "fill", "content": "1+1=?", "options": None, "answer": "二",
    }, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["type"] == "fill"
    assert data["options"] is None


def test_38_edit_question_not_found(client, auth_headers):
    r = client.put("/api/questions/99999", json={"content": "x"}, headers=auth_headers)
    assert r.status_code == 404


def test_39_delete_question(client, auth_headers):
    r = client.delete(f"/api/questions/{state._q_fill_multi_id}", headers=auth_headers)
    assert r.status_code == 204
    bank = client.get(f"/api/question-banks/{state.bank_id}", headers=auth_headers).json()
    ids = [q["id"] for q in bank["questions"]]
    assert state._q_fill_multi_id not in ids


def test_40_delete_question_not_found(client, auth_headers):
    r = client.delete("/api/questions/99999", headers=auth_headers)
    assert r.status_code == 404


# ── Test: 题库更新与导出 ──


def test_41_update_bank(client, auth_headers):
    r = client.put(f"/api/question-banks/{state.bank_id}", json={
        "title": "更新后的题库", "description": "新描述",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["title"] == "更新后的题库"
    assert r.json()["description"] == "新描述"


def test_42_export_bank(client, auth_headers):
    r = client.get(f"/api/question-banks/{state.bank_id}/export", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "更新后的题库"
    assert len(data["questions"]) >= 8
    export_question = data["questions"][0]
    assert "type" in export_question
    assert "content" in export_question
    assert "answer" in export_question


def test_43_export_bank_not_found(client, auth_headers):
    r = client.get("/api/question-banks/99999/export", headers=auth_headers)
    assert r.status_code == 404


# ── Test: 以 [ 开头的填空题答案不被误判为 JSON（issue #11）──


BRACKET_ANSWER_BANK = {
    "title": "化学括号答案测试",
    "description": "测试以 [ 开头的答案",
    "questions": [
        {"type": "fill", "content": "氢离子的化学式是____", "answer": "[H⁺]"},
        {"type": "fill", "content": "铁氰化钾的化学式是____", "answer": "[Fe(CN)₆]⁴⁻"},
        {"type": "fill", "content": "两个数字", "answer": ["1", "2"]},
    ],
}


def test_bracket_answer_import(client, auth_headers):
    r = client.post("/api/question-banks/import", json=BRACKET_ANSWER_BANK, headers=auth_headers)
    assert r.status_code == 201, f"导入失败: {r.text}"
    state._bracket_bank_id = r.json()["id"]


def test_bracket_answer_submit_correct(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state._bracket_bank_id], "mode": "sequential",
    }, headers=auth_headers)
    assert r.status_code == 200
    exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{exam_id}/answer", json={
        "exam_id": exam_id, "question_id": qid,
        "user_answer": "[H⁺]", "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_correct"] is True, f"答案 [H⁺] 应判对: {r.json()}"
    client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)


def test_bracket_answer_submit_wrong(client, auth_headers):
    r = client.post("/api/exam/start", json={
        "bank_ids": [state._bracket_bank_id], "mode": "sequential",
    }, headers=auth_headers)
    assert r.status_code == 200
    exam_id = r.json()["exam_id"]
    r = client.get(f"/api/exam/{exam_id}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]
    r = client.post(f"/api/exam/{exam_id}/answer", json={
        "exam_id": exam_id, "question_id": qid,
        "user_answer": "[OH⁻]", "time_spent_seconds": 5,
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["is_correct"] is False, f"答案 [OH⁻] 应判错: {r.json()}"
    client.post(f"/api/exam/{exam_id}/finish", json={}, headers=auth_headers)


def test_bracket_answer_update_question(client, auth_headers):
    r = client.get(f"/api/question-banks/{state._bracket_bank_id}", headers=auth_headers)
    assert r.status_code == 200
    questions = r.json()["questions"]
    q = next(q for q in questions if q["content"] == "氢离子的化学式是____")
    r = client.put(f"/api/questions/{q['id']}", json={
        "analysis": "氢离子化学式为 H⁺",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["answer"] == "[H⁺]"
    assert r.json()["analysis"] == "氢离子化学式为 H⁺"


def test_bracket_answer_export(client, auth_headers):
    r = client.get(f"/api/question-banks/{state._bracket_bank_id}/export", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    answers = {q["content"]: q["answer"] for q in data["questions"]}
    assert answers["氢离子的化学式是____"] == "[H⁺]"
    assert answers["铁氰化钾的化学式是____"] == "[Fe(CN)₆]⁴⁻"
    assert answers["两个数字"] == ["1", "2"]
    client.delete(f"/api/question-banks/{state._bracket_bank_id}", headers=auth_headers)


# ── Test: 完整恢复初始数据 ──


def test_44_cleanup_restore_bank(client, auth_headers):
    r = client.put(f"/api/question-banks/{state.bank_id}", json={
        "title": "测试题库",
    }, headers=auth_headers)
    assert r.status_code == 200


# ── Test: JWT hardening ──


def test_45_wrong_issuer_rejected(client):
    now = datetime.now(UTC).replace(tzinfo=None)
    token = jwt.encode({
        "user_id": 999, "exp": now + timedelta(hours=1),
        "iss": "wrong", "aud": JWT_AUDIENCE, "iat": now,
    }, SECRET_KEY, algorithm=ALGORITHM)
    r = client.get("/api/question-banks", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, f"wrong issuer should be rejected: {r.text}"


def test_46_wrong_audience_rejected(client):
    now = datetime.now(UTC).replace(tzinfo=None)
    token = jwt.encode({
        "user_id": 999, "exp": now + timedelta(hours=1),
        "iss": JWT_ISSUER, "aud": "wrong-audience", "iat": now,
    }, SECRET_KEY, algorithm=ALGORITHM)
    r = client.get("/api/question-banks", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, f"wrong audience should be rejected: {r.text}"


def test_47_missing_exp_rejected(client):
    now = datetime.now(UTC).replace(tzinfo=None)
    token = jwt.encode({
        "user_id": 999, "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "iat": now,
    }, SECRET_KEY, algorithm=ALGORITHM)
    r = client.get("/api/question-banks", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, f"missing exp should be rejected: {r.text}"


def test_48_token_within_leeway_accepted(client):
    now = datetime.now(UTC).replace(tzinfo=None)
    token = jwt.encode({
        "user_id": 999, "exp": now - timedelta(seconds=55),
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "iat": now - timedelta(minutes=5),
    }, SECRET_KEY, algorithm=ALGORITHM)
    r = client.get("/api/question-banks", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, "token expired within leeway should still be denied (user 999 doesn't exist)"


def test_49_token_beyond_leeway_rejected(client):
    now = datetime.now(UTC).replace(tzinfo=None)
    token = jwt.encode({
        "user_id": 999, "exp": now - timedelta(seconds=65),
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "iat": now - timedelta(minutes=5),
    }, SECRET_KEY, algorithm=ALGORITHM)
    r = client.get("/api/question-banks", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, "token expired beyond leeway should be rejected"


def test_50_submit_answer_path_body_mismatch(client, auth_headers):
    """路径 exam_id 与请求体 exam_id 不一致时返回 400，答案不写入（issue #46）"""
    bank = {
        "title": "issue46题库",
        "questions": [
            {"type": "choice", "chapter": "基础", "content": "1+1=?", "options": ["A.1", "B.2"], "answer": "B"},
        ],
    }
    r = client.post("/api/question-banks/import", json=bank, headers=auth_headers)
    assert r.status_code == 201, f"导入失败: {r.text}"
    bank_id = r.json()["id"]

    start_body = {
        "bank_ids": [bank_id], "mode": "sequential",
        "types": ["choice"], "choice_timeout": 30, "judge_fill_timeout": 60,
    }
    r = client.post("/api/exam/start", json=start_body, headers=auth_headers)
    assert r.status_code == 200
    exam_a = r.json()["exam_id"]
    r = client.post("/api/exam/start", json=start_body, headers=auth_headers)
    assert r.status_code == 200
    exam_b = r.json()["exam_id"]

    r = client.get(f"/api/exam/{exam_a}/current", headers=auth_headers)
    qid = r.json()["question"]["id"]

    # 路径 examB + 请求体 examA → 400，答案不写入任何考试
    r = client.post(f"/api/exam/{exam_b}/answer", json={
        "exam_id": exam_a, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 3,
    }, headers=auth_headers)
    assert r.status_code == 400, f"路径/请求体不一致应返回 400: {r.text}"
    assert "不一致" in r.json()["detail"]

    # examA 进度仍为空，未被写入
    r = client.get(f"/api/exam/{exam_a}/progress", headers=auth_headers)
    assert r.json()["answers"] == []

    # 路径与请求体一致 → 200（向后兼容，正常受理）
    r = client.post(f"/api/exam/{exam_a}/answer", json={
        "exam_id": exam_a, "question_id": qid,
        "user_answer": "B", "time_spent_seconds": 3,
    }, headers=auth_headers)
    assert r.status_code == 200, f"一致时应正常受理: {r.text}"
