from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db import Base, engine, SessionLocal
from models import User
from schemas import RegisterRequest, LoginRequest, TokenResponse, MeResponse
from auth import hash_password, verify_password, create_access_token, decode_token

app = FastAPI(title="Friendly Messenger API")

USERNAME_BLANK_DETAIL = "Username cannot be blank"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_username(username: str) -> str:
    return username.strip().lower()


def require_non_blank_username(username: str) -> str:
    normalized = normalize_username(username)
    if not normalized:
        raise HTTPException(status_code=422, detail=USERNAME_BLANK_DETAIL)
    return normalized


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=MeResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    username = require_non_blank_username(payload.username)

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    u = User(username=username, password_hash=hash_password(payload.password))
    db.add(u)
    db.commit()
    db.refresh(u)

    return MeResponse(id=u.id, username=u.username)


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = require_non_blank_username(payload.username)

    u = db.query(User).filter(User.username == username).first()
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user_id=u.id, username=u.username)
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=MeResponse)
def me(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=401, detail="User not found")

    return MeResponse(id=u.id, username=u.username)
