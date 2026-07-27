import json


def parse_json_field(val: str | None) -> object:
    if not val:
        return val
    try:
        if val.startswith("["):
            return json.loads(val)
        return val
    except (json.JSONDecodeError, TypeError):
        return val


def parse_json_list(val: str | None) -> list:
    """解析 JSON 数组快照，损坏/非数组按空列表处理。

    parse_json_field 解析失败会原样返回字符串，直接做 `int in 返回值` 会
    TypeError → 500（issue #172）；成员判断/集合构造场景一律用本函数，
    降级口径与 _load_all_exam_questions（issue #43）一致。
    """
    parsed = parse_json_field(val)
    return parsed if isinstance(parsed, list) else []


def parse_answer(answer: str | None, question_type: str) -> object:
    if not answer:
        return answer
    if question_type in ("choice", "judge"):
        return answer
    try:
        parsed = json.loads(answer)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return answer
