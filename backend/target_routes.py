from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import date
from pathlib import Path
from threading import Lock
import json
import os

from auth import get_current_user

router = APIRouter(prefix="/api/targets", tags=["Targets"])
BASE_DIR = Path(__file__).resolve().parent
TARGETS_FILE = BASE_DIR / "data" / "targets.json"
file_lock = Lock()


class TargetCreate(BaseModel):
    student_id: str = Field(min_length=1)
    subject_id: str = Field(min_length=1)
    target_name: str = Field(min_length=3)
    target_description: str = ""
    start_date: date
    deadline: date


class TargetUpdate(BaseModel):
    target_name: str = Field(min_length=3)
    target_description: str = ""
    start_date: date
    deadline: date


def read_targets():
    if not TARGETS_FILE.exists():
        raise HTTPException(status_code=404, detail="Khong tim thay file targets.json")
    try:
        with open(TARGETS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="Khong doc duoc du lieu muc tieu")
    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="Du lieu muc tieu khong hop le")
    return data


def save_targets(data):
    TARGETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = TARGETS_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, TARGETS_FILE)


def require_owned_target(target, user):
    # Legacy/sample targets have no owner and cannot be changed by ordinary users.
    if target.get("user_id") is None or str(target.get("user_id")) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Ban khong co quyen thay doi muc tieu nay")


@router.post("", status_code=201)
def create_target(data: TargetCreate, user=Depends(get_current_user)):
    if data.deadline < data.start_date:
        raise HTTPException(status_code=400, detail="Han hoan thanh phai sau ngay bat dau")
    student_id = data.student_id.strip()
    subject_id = data.subject_id.strip()
    target_name = data.target_name.strip()
    if not student_id or not subject_id or len(target_name) < 3:
        raise HTTPException(status_code=400, detail="Thong tin muc tieu khong hop le")

    with file_lock:
        targets = read_targets()
        existing_numbers = []
        for item in targets:
            target_id = str(item.get("target_id", ""))
            if target_id.startswith("TG") and target_id[2:].isdigit():
                existing_numbers.append(int(target_id[2:]))
        next_number = max(existing_numbers, default=0) + 1
        new_target = {
            "target_id": f"TG{next_number:04d}",
            "user_id": user["id"],
            "student_id": student_id,
            "subject_id": subject_id,
            "target_name": target_name,
            "target_description": data.target_description.strip(),
            "start_date": data.start_date.isoformat(),
            "deadline": data.deadline.isoformat(),
            "target_completion_pct": 0.0,
            "progress_mode": "task_based",
            "status": "Dang thuc hien",
            "created_at": date.today().isoformat(),
        }
        targets.append(new_target)
        save_targets(targets)
    return {"message": "Them muc tieu thanh cong", "target": new_target}


@router.put("/{target_id}")
def update_target(target_id: str, data: TargetUpdate, user=Depends(get_current_user)):
    if data.deadline < data.start_date:
        raise HTTPException(status_code=400, detail="Han hoan thanh phai sau ngay bat dau")
    target_name = data.target_name.strip()
    if len(target_name) < 3:
        raise HTTPException(status_code=400, detail="Ten muc tieu phai co it nhat 3 ky tu")

    with file_lock:
        targets = read_targets()
        for target in targets:
            if str(target.get("target_id")) == target_id:
                require_owned_target(target, user)
                target["target_name"] = target_name
                target["target_description"] = data.target_description.strip()
                target["start_date"] = data.start_date.isoformat()
                target["deadline"] = data.deadline.isoformat()
                target["updated_at"] = date.today().isoformat()
                save_targets(targets)
                return {"message": "Cap nhat muc tieu thanh cong", "target": target}
    raise HTTPException(status_code=404, detail="Khong tim thay muc tieu")


@router.delete("/{target_id}")
def delete_target(target_id: str, user=Depends(get_current_user)):
    if not target_id.startswith("TG") or not target_id[2:].isdigit():
        raise HTTPException(status_code=400, detail="Ma muc tieu khong hop le")
    if int(target_id[2:]) <= 300:
        raise HTTPException(status_code=403, detail="Khong duoc xoa muc tieu du lieu mau")

    with file_lock:
        targets = read_targets()
        target = next((item for item in targets if str(item.get("target_id")) == target_id), None)
        if target is None:
            raise HTTPException(status_code=404, detail="Khong tim thay muc tieu")
        require_owned_target(target, user)
        updated_targets = [item for item in targets if str(item.get("target_id")) != target_id]
        save_targets(updated_targets)
    return {"message": "Xoa muc tieu thanh cong", "target_id": target_id}
