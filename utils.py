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
