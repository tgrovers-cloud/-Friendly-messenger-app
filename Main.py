from typing import Dict, List, Set

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from auth import create_access_token, decode_token, hash_password, verify_password
from db import Base, SessionLocal, engine
from models import Conversation, ConversationParticipant, Message, User
from schemas import (
    ConversationCreateRequest,
    ConversationSummary,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
    MessageCreateRequest,
    MessageOut,
)

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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login/form")


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[int, Set[WebSocket]] = {}

    async def connect(self, conversation_id: int, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(conversation_id, set()).add(websocket)

    def disconnect(self, conversation_id: int, websocket: WebSocket):
        if conversation_id in self.rooms:
            self.rooms[conversation_id].discard(websocket)
            if not self.rooms[conversation_id]:
                del self.rooms[conversation_id]

    async def broadcast(self, conversation_id: int, payload: dict):
        if conversation_id not in self.rooms:
            return

        dead: List[WebSocket] = []
        for ws in list(self.rooms[conversation_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(conversation_id, ws)


manager = ConnectionManager()


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


def get_current_user(token: str, db: Session) -> User:
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
    return u


def require_member(db: Session, user_id: int, conversation_id: int) -> None:
    membership = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")


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


@app.post("/auth/login/form", response_model=TokenResponse)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = require_non_blank_username(form_data.username)

    u = db.query(User).filter(User.username == username).first()
    if not u or not verify_password(form_data.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user_id=u.id, username=u.username)
    return TokenResponse(access_token=token)


@app.get("/auth/me", response_model=MeResponse)
def me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    u = get_current_user(token, db)
    return MeResponse(id=u.id, username=u.username)


@app.post("/conversations", response_model=ConversationSummary)
def create_or_get_conversation(
    payload: ConversationCreateRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    me_user = get_current_user(token, db)

    other_username = require_non_blank_username(payload.username)
    if other_username == me_user.username:
        raise HTTPException(status_code=400, detail="You cannot chat with yourself")

    other_user = db.query(User).filter(User.username == other_username).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    me_id = me_user.id
    other_id = other_user.id
    cp = ConversationParticipant

    existing = (
        db.query(cp.conversation_id)
        .filter(cp.user_id.in_([me_id, other_id]))
        .group_by(cp.conversation_id)
        .having(func.count() == 2)
        .having(func.count(func.distinct(cp.user_id)) == 2)
        .first()
    )

    if existing:
        convo_id = existing[0]
        return ConversationSummary(id=convo_id, other_username=other_user.username)

    convo = Conversation()
    db.add(convo)
    db.commit()
    db.refresh(convo)

    db.add_all(
        [
            ConversationParticipant(conversation_id=convo.id, user_id=me_id),
            ConversationParticipant(conversation_id=convo.id, user_id=other_id),
        ]
    )
    db.commit()

    return ConversationSummary(id=convo.id, other_username=other_user.username)


@app.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    me_user = get_current_user(token, db)

    cp_me = aliased(ConversationParticipant)
    cp_other = aliased(ConversationParticipant)
    other_user = aliased(User)

    rows = (
        db.query(Conversation.id, other_user.username)
        .join(cp_me, cp_me.conversation_id == Conversation.id)
        .join(cp_other, cp_other.conversation_id == Conversation.id)
        .join(other_user, other_user.id == cp_other.user_id)
        .filter(cp_me.user_id == me_user.id)
        .filter(cp_other.user_id != me_user.id)
        .order_by(Conversation.id.desc())
        .all()
    )

    return [ConversationSummary(id=row[0], other_username=row[1]) for row in rows]


@app.post("/conversations/{conversation_id}/messages", response_model=MessageOut)
async def send_message(
    conversation_id: int,
    payload: MessageCreateRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    me_user = get_current_user(token, db)
    require_member(db, me_user.id, conversation_id)

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message cannot be blank")

    msg = Message(conversation_id=conversation_id, sender_id=me_user.id, text=text)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    out = MessageOut(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_username=me_user.username,
        text=msg.text,
        created_at=msg.created_at,
    )

    await manager.broadcast(conversation_id, {"type": "message", "data": out.model_dump()})
    return out


@app.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
def list_messages(
    conversation_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    me_user = get_current_user(token, db)
    require_member(db, me_user.id, conversation_id)

    sender = aliased(User)

    rows = (
        db.query(Message, sender.username)
        .join(sender, sender.id == Message.sender_id)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    out: List[MessageOut] = []
    for msg, sender_username in rows:
        out.append(
            MessageOut(
                id=msg.id,
                conversation_id=msg.conversation_id,
                sender_username=sender_username,
                text=msg.text,
                created_at=msg.created_at,
            )
        )
    return out


@app.websocket("/ws/conversations/{conversation_id}")
async def ws_conversation(websocket: WebSocket, conversation_id: int):
    token = websocket.query_params.get("token", "").strip()
    if not token:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        user = get_current_user(token, db)
        require_member(db, user.id, conversation_id)

        await manager.connect(conversation_id, websocket)

        while True:
            # keep connection alive; ignore incoming messages
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
    finally:
        db.close()
