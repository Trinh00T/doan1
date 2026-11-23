
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import date
from pathlib import Path
from threading import Lock
import json
import os
import uuid

from auth import get_current_user

router = APIRouter(
    prefix="/api/study-time",
    tags=["Study Time"]
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

TIME_FILE = DATA_DIR / "study_time.json"
TARGETS_FILE = DATA_DIR / "targets.json"

file_lock = Lock()


# Du lieu ghi nhan thoi gian hoc
class StudyTimeCreate(BaseModel):
    target_id: str = Field(min_length=1)
    study_date: date
    study_hours: float = Field(gt=0, le=24)
    description: str = ""


# Du lieu cap nhat thoi gian hoc
class StudyTimeUpdate(BaseModel):
    study_date: date
    study_hours: float = Field(gt=0, le=24)
    description: str = ""


# Doc du lieu JSON
def read_json(file_path):
    if not file_path.exists():
        return []

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu JSON khong hop le"
        )

    return data


# Luu du lieu JSON
def save_json(file_path, data):
    file_path.parent.mkdir(parents=True, exist_ok=True)

    temp_file = file_path.with_suffix(".tmp")

    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    os.replace(temp_file, file_path)


# Kiem tra muc tieu ton tai
def check_target(target_id):
    targets = read_json(TARGETS_FILE)

    return any(
        str(item.get("target_id")) == target_id
        for item in targets
    )


# API 1: Lay danh sach thoi gian hoc
@router.get("")
def get_study_time(
    target_id: str = None,
    user=Depends(get_current_user)
):
    records = read_json(TIME_FILE)

    records = [
        item for item in records
        if item.get("user_id") == user["id"]
    ]

    if target_id:
        records = [
            item for item in records
            if item.get("target_id") == target_id
        ]

    return records


# API 2: Them thoi gian hoc
@router.post("", status_code=201)
def create_study_time(
    data: StudyTimeCreate,
    user=Depends(get_current_user)
):
    target_id = data.target_id.strip()

    if not check_target(target_id):
        raise HTTPException(
            status_code=404,
            detail="Khong tim thay muc tieu hoc tap"
        )

    with file_lock:
        records = read_json(TIME_FILE)

        new_record = {
            "time_id": "TIME" + uuid.uuid4().hex[:12].upper(),
            "user_id": user["id"],
            "target_id": target_id,
            "study_date": data.study_date.isoformat(),
            "study_hours": data.study_hours,
            "description": data.description.strip(),
            "created_at": date.today().isoformat()
        }

        records.append(new_record)
        save_json(TIME_FILE, records)

    return {
        "message": "Ghi nhan thoi gian hoc thanh cong",
        "record": new_record
    }


# API 3: Cap nhat thoi gian hoc
@router.put("/{time_id}")
def update_study_time(
    time_id: str,
    data: StudyTimeUpdate,
    user=Depends(get_current_user)
):
    with file_lock:
        records = read_json(TIME_FILE)

        for item in records:
            if (
                item.get("time_id") == time_id
                and item.get("user_id") == user["id"]
            ):
                item["study_date"] = data.study_date.isoformat()
                item["study_hours"] = data.study_hours
                item["description"] = data.description.strip()
                item["updated_at"] = date.today().isoformat()

                save_json(TIME_FILE, records)

                return {
                    "message": "Cap nhat thoi gian hoc thanh cong",
                    "record": item
                }

    raise HTTPException(
        status_code=404,
        detail="Khong tim thay ban ghi thoi gian hoc"
    )


# API 4: Xoa thoi gian hoc
@router.delete("/{time_id}")
def delete_study_time(
    time_id: str,
    user=Depends(get_current_user)
):
    with file_lock:
        records = read_json(TIME_FILE)

        found = any(
            item.get("time_id") == time_id
            and item.get("user_id") == user["id"]
            for item in records
        )

        if not found:
            raise HTTPException(
                status_code=404,
                detail="Khong tim thay ban ghi thoi gian hoc"
            )

        updated_records = [
            item for item in records
            if not (
                item.get("time_id") == time_id
                and item.get("user_id") == user["id"]
            )
        ]

        save_json(TIME_FILE, updated_records)

    return {
        "message": "Xoa thoi gian hoc thanh cong",
        "time_id": time_id
    }
