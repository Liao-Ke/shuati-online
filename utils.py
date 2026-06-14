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
