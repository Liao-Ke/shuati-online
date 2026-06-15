import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, TokenResponse, UserInfo
from auth import hash_password, verify_password, create_access_token, get_current_user
from routers.limiter import limiter

logger = logging.getLogger("shuati")

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if len(data.username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 个字符")
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"用户 {data.username} 注册成功")
    token = create_access_token({"user_id": user.id})
    return TokenResponse(access_token=token, user=UserInfo(id=user.id, username=user.username))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    logger.info(f"用户 {data.username} 登录成功")
    token = create_access_token({"user_id": user.id})
    return TokenResponse(access_token=token, user=UserInfo(id=user.id, username=user.username))


@router.get("/me", response_model=UserInfo)
def me(user: User = Depends(get_current_user)):
    return UserInfo(id=user.id, username=user.username)
