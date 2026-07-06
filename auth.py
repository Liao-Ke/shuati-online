import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User

logger = logging.getLogger("shuati")

_DEFAULT_KEY_PATH = Path(__file__).parent / ".secret_key"


def _load_secret_key(path: Path | None = None) -> str:
    env_key = os.getenv("SECRET_KEY")
    if env_key:
        return env_key

    key_path = path or _DEFAULT_KEY_PATH
    try:
        if key_path.is_file():
            stored = key_path.read_text(encoding="utf-8").strip()
            if stored:
                logger.info("从 %s 读取 SECRET_KEY", key_path)
                return stored
    except OSError:
        logger.warning("读取 %s 失败，将生成新密钥", key_path)

    generated = secrets.token_hex(32)
    logger.warning(
        "SECRET_KEY 未设置，已生成随机密钥并持久化到 %s。生产环境请通过环境变量设置 SECRET_KEY。",
        key_path,
    )
    try:
        key_path.write_text(generated, encoding="utf-8")
    except OSError:
        logger.warning("无法写入 %s，密钥仅在本次进程有效，重启后 JWT 将失效", key_path)
    return generated


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
JWT_ISSUER = "shuati-online"
JWT_AUDIENCE = "shuati-api"
JWT_LEEWAY = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(UTC).replace(tzinfo=None)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未认证")
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
                "require_exp": True,
                "leeway": JWT_LEEWAY,
            },
        )
        user_id = payload.get("user_id")
        if user_id is None:
            logger.warning("JWT 解码成功但缺少 user_id")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 token")
    except JWTError:
        logger.warning("JWT 验证失败")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的 token"
        ) from None
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning(f"user_id={user_id} 对应的用户不存在")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user
