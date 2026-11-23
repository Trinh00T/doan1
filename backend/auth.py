
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field


# =====================================
# 1. CAU HINH DUONG DAN DATABASE
# =====================================

BASE_DIR = Path(__file__).resolve().parent

# Tren may tinh: backend/users.db
# Tren Render: cau hinh DATABASE_PATH=/var/data/users.db
DB_PATH = Path(
    os.getenv(
        "DATABASE_PATH",
        str(BASE_DIR / "users.db")
    )
)

DB_PATH.parent.mkdir(parents=True, exist_ok=True)


# =====================================
# 2. CAU HINH JWT
# =====================================

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "Chua cau hinh JWT_SECRET_KEY"
    )

ALGORITHM = "HS256"

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

security = HTTPBearer()


# =====================================
# 3. KET NOI SQLITE
# =====================================

def get_connection():
    conn = sqlite3.connect(
        DB_PATH,
        timeout=30
    )

    conn.row_factory = sqlite3.Row

    return conn


# =====================================
# 4. KHOI TAO BANG TAI KHOAN
# =====================================

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


# =====================================
# 5. DU LIEU DANG KY
# =====================================

class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)


# =====================================
# 6. DU LIEU DANG NHAP
# =====================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# =====================================
# 7. API DANG KY
# =====================================

@router.post("/register", status_code=201)
def register(data: RegisterRequest):

    email = str(data.email).strip().lower()
    full_name = data.full_name.strip()

    if len(full_name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Ho ten phai co it nhat 2 ky tu"
        )

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
                    full_name,
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


# =====================================
# 8. API DANG NHAP
# =====================================

@router.post("/login")
def login(data: LoginRequest):

    email = str(data.email).strip().lower()

    with get_connection() as conn:
        user = conn.execute(
            """
            SELECT *
            FROM users
            WHERE email = ?
            """,
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

    expire = (
        datetime.now(timezone.utc)
        + timedelta(hours=2)
    )

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


# =====================================
# 9. KIEM TRA TOKEN
# =====================================

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

    except (
        jwt.PyJWTError,
        ValueError,
        KeyError
    ):
        raise HTTPException(
            status_code=401,
            detail="Token khong hop le hoac het han"
        )

    with get_connection() as conn:
        user = conn.execute(
            """
            SELECT id, full_name, email
            FROM users
            WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Tai khoan khong ton tai"
        )

    return dict(user)


# =====================================
# 10. API LAY THONG TIN TAI KHOAN
# =====================================

@router.get("/me")
def get_me(
    user=Depends(get_current_user)
):
    return user
