
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "users.db"

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "Chua cau hinh JWT_SECRET_KEY"
    )

ALGORITHM = "HS256"

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()


# Ket noi SQLite
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# Tao bang tai khoan
def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
        """)


init_db()


# Du lieu dang ky
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)


# Du lieu dang nhap
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Dang ky
@router.post("/register", status_code=201)
def register(data: RegisterRequest):
    email = str(data.email).strip().lower()

    if len(data.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Mat khau qua dai"
        )

    password_hash = bcrypt.hashpw(
        data.password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    try:
        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users
                (full_name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (
                    data.full_name.strip(),
                    email,
                    password_hash
                )
            )
            user_id = cursor.lastrowid

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="Email da duoc dang ky"
        )

    return {
        "message": "Dang ky thanh cong",
        "user_id": user_id
    }


# Dang nhap
@router.post("/login")
def login(data: LoginRequest):
    email = str(data.email).strip().lower()

    with get_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

    if not user or not bcrypt.checkpw(
        data.password.encode("utf-8"),
        user["password_hash"].encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="Email hoac mat khau khong dung"
        )

    expire = datetime.now(timezone.utc) + timedelta(hours=2)

    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "exp": expire
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"]
        }
    }


# Kiem tra token
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = int(payload["sub"])

    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=401,
            detail="Token khong hop le hoac het han"
        )

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, full_name, email FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Tai khoan khong ton tai"
        )

    return dict(user)


# Lay thong tin tai khoan
@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return user
