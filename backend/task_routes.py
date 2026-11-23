from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import date
from pathlib import Path
from threading import Lock
import json
import os

from auth import get_current_user
from target_routes import file_lock as target_file_lock

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TASKS_FILE = DATA_DIR / "user_tasks.json"
TARGETS_FILE = DATA_DIR / "targets.json"
HISTORY_FILE = DATA_DIR / "progress_history.json"
TIME_FILE = DATA_DIR / "study_time.json"
file_lock = Lock()


class TaskCreate(BaseModel):
    target_id: str = Field(min_length=1)
    task_name: str = Field(min_length=3)
    task_description: str = ""
    deadline: date
    priority: str = "Trung binh"
    estimated_hours: float = Field(default=1.0, gt=0, le=1000)


class TaskUpdate(BaseModel):
    task_name: str = Field(min_length=3)
    task_description: str = ""
    deadline: date
    priority: str = "Trung binh"
    status: str = "Chua bat dau"
    estimated_hours: float | None = Field(default=None, gt=0, le=1000)


def read_json(file_path):
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Khong doc duoc {file_path.name}") from exc
    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail=f"Du lieu {file_path.name} khong hop le")
    return data


def save_json(file_path, data):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = file_path.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, file_path)


def validate_priority(priority):
    if priority not in ["Thap", "Trung binh", "Cao"]:
        raise HTTPException(status_code=400, detail="Muc uu tien khong hop le")


def get_owned_target(targets, target_id, user):
    target = next((t for t in targets if str(t.get("target_id")) == str(target_id)), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Khong tim thay muc tieu")
    if target.get("user_id") is None or str(target["user_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Ban khong co quyen thay doi cong viec cua muc tieu nay")
    if target.get("progress_mode") != "task_based":
        raise HTTPException(status_code=403, detail="Muc tieu nay khong duoc quan ly tien do theo cong viec")
    return target


def prepare_progress(target, tasks, user_id, history, time_records):
    """Tinh tien do va chuan bi lich su, khong tu ghi file."""
    target_id = str(target["target_id"])
    related = [t for t in tasks if str(t.get("target_id")) == target_id and str(t.get("user_id")) == str(user_id)]
    if not related:
        # Khong co task: giu nguyen % hien tai, khong suy dien 0%.
        return None

    completed = sum(t.get("status") == "Hoan thanh" for t in related)
    progress = round(100 * completed / len(related), 2)
    previous = round(float(target.get("target_completion_pct") or 0), 2)
    if progress == previous:
        return None

    today = date.today()
    overdue = sum(
        t.get("status") != "Hoan thanh"
        and bool(t.get("deadline"))
        and str(t["deadline"]) < today.isoformat()
        for t in related
    )
    try:
        start = date.fromisoformat(str(target["start_date"]))
        end = date.fromisoformat(str(target["deadline"]))
        duration = (end - start).days
        if duration <= 0:
            planned = 100.0 if today >= end else 0.0
        else:
            planned = round(max(0, min(100, (today - start).days / duration * 100)), 2)
    except (ValueError, TypeError, KeyError):
        planned = None

    gap = round(progress - planned, 2) if planned is not None else None
    if progress >= 100:
        status = "Hoan thanh"
    elif overdue > 0 or (gap is not None and gap < -15):
        status = "Cham tien do"
    elif gap is not None and gap < -5:
        status = "Co nguy co cham"
    else:
        status = "Dung tien do"

    # Gio hoc trong ngay lay tu ban ghi thuc te, khong lay tu du lieu mo phong.
    hours = round(sum(
        float(r.get("study_hours") or 0)
        for r in time_records
        if str(r.get("target_id")) == target_id
        and str(r.get("user_id")) == str(user_id)
        and r.get("study_date") == today.isoformat()
    ), 2)

    # Chi cap nhat ban ghi do he thong tao; KHONG ghi de synthetic_simulation.
    existing = next((r for r in history if
                     str(r.get("target_id")) == target_id
                     and r.get("date") == today.isoformat()
                     and r.get("data_source") == "user_activity"), None)
    if existing is None:
        ids = [int(str(r.get("log_id", ""))[2:]) for r in history
               if str(r.get("log_id", "")).startswith("PL")
               and str(r.get("log_id", ""))[2:].isdigit()]
        existing = {"log_id": f"PL{max(ids, default=0) + 1:07d}"}
        history.append(existing)

    existing.update({
        "student_id": target.get("student_id"),
        "target_id": target_id,
        "subject_id": target.get("subject_id"),
        "date": today.isoformat(),
        "planned_progress_pct": planned,
        "actual_progress_pct": progress,
        "progress_gap_pct": gap,
        "study_hours": hours,
        "available_hours": None,  # Khong co so lieu kha dung da xac thuc.
        "completed_tasks": completed,
        "overdue_tasks": overdue,
        "remaining_work_pct": round(100 - progress, 2),
        "status": status,
        "data_source": "user_activity",
    })
    target["target_completion_pct"] = progress
    target["status"] = "Hoan thanh" if progress == 100 else "Dang thuc hien"
    target["updated_at"] = today.isoformat()
    return progress


def persist_changes(tasks, targets, user, target_id):
    """Goi khi da giu file_lock va target_file_lock."""
    target = get_owned_target(targets, target_id, user)
    history = read_json(HISTORY_FILE)
    time_records = read_json(TIME_FILE)
    progress = prepare_progress(target, tasks, user["id"], history, time_records)
    # File task luu truoc, sau do dong bo target va lich su.
    # JSON nhieu file khong phai transaction: nen sao luu du lieu truoc khi trien khai.
    save_json(TASKS_FILE, tasks)
    if progress is not None:
        save_json(TARGETS_FILE, targets)
        save_json(HISTORY_FILE, history)
    return progress


@router.get("")
def get_tasks(target_id: str = None, user=Depends(get_current_user)):
    tasks = read_json(TASKS_FILE)
    tasks = [t for t in tasks if str(t.get("user_id")) == str(user["id"])]
    if target_id:
        tasks = [t for t in tasks if str(t.get("target_id")) == target_id]
    result = []
    for task in tasks:
        item = task.copy()
        if item.get("estimated_hours") is None:
            item["estimated_hours"] = 1.0
            item["estimated_hours_is_default"] = True
        else:
            item["estimated_hours_is_default"] = False
        result.append(item)
    return result


@router.post("", status_code=201)
def create_task(data: TaskCreate, user=Depends(get_current_user)):
    target_id = data.target_id.strip()
    task_name = data.task_name.strip()
    if len(task_name) < 3:
        raise HTTPException(status_code=400, detail="Ten nhiem vu phai co it nhat 3 ky tu")
    validate_priority(data.priority)
    with file_lock, target_file_lock:
        targets = read_json(TARGETS_FILE)
        get_owned_target(targets, target_id, user)
        tasks = read_json(TASKS_FILE)
        ids = [int(str(t.get("task_id", ""))[4:]) for t in tasks
               if str(t.get("task_id", "")).startswith("TASK")
               and str(t.get("task_id", ""))[4:].isdigit()]
        new_task = {
            "task_id": f"TASK{max(ids, default=0) + 1:04d}",
            "user_id": user["id"],
            "target_id": target_id,
            "task_name": task_name,
            "task_description": data.task_description.strip(),
            "deadline": data.deadline.isoformat(),
            "priority": data.priority,
            "status": "Chua bat dau",
            "estimated_hours": data.estimated_hours,
            "created_at": date.today().isoformat(),
        }
        tasks.append(new_task)
        progress = persist_changes(tasks, targets, user, target_id)
    return {"message": "Them nhiem vu thanh cong", "task": new_task, "target_progress_pct": progress}


@router.put("/{task_id}")
def update_task(task_id: str, data: TaskUpdate, user=Depends(get_current_user)):
    validate_priority(data.priority)
    if data.status not in ["Chua bat dau", "Dang thuc hien", "Hoan thanh"]:
        raise HTTPException(status_code=400, detail="Trang thai khong hop le")
    task_name = data.task_name.strip()
    if len(task_name) < 3:
        raise HTTPException(status_code=400, detail="Ten nhiem vu phai co it nhat 3 ky tu")
    with file_lock, target_file_lock:
        tasks = read_json(TASKS_FILE)
        task = next((t for t in tasks if t.get("task_id") == task_id
                     and str(t.get("user_id")) == str(user["id"])), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Khong tim thay nhiem vu")
        targets = read_json(TARGETS_FILE)
        target_id = str(task.get("target_id"))
        get_owned_target(targets, target_id, user)
        task["task_name"] = task_name
        task["task_description"] = data.task_description.strip()
        task["deadline"] = data.deadline.isoformat()
        task["priority"] = data.priority
        task["status"] = data.status
        if data.estimated_hours is not None:
            task["estimated_hours"] = data.estimated_hours
        task["updated_at"] = date.today().isoformat()
        progress = persist_changes(tasks, targets, user, target_id)
    return {"message": "Cap nhat nhiem vu thanh cong", "task": task, "target_progress_pct": progress}


@router.delete("/{task_id}")
def delete_task(task_id: str, user=Depends(get_current_user)):
    with file_lock, target_file_lock:
        tasks = read_json(TASKS_FILE)
        task = next((t for t in tasks if t.get("task_id") == task_id
                     and str(t.get("user_id")) == str(user["id"])), None)
        if task is None:
            raise HTTPException(status_code=404, detail="Khong tim thay nhiem vu")
        targets = read_json(TARGETS_FILE)
        target_id = str(task.get("target_id"))
        get_owned_target(targets, target_id, user)
        updated_tasks = [t for t in tasks if not (
            t.get("task_id") == task_id and str(t.get("user_id")) == str(user["id"]))]
        progress = persist_changes(updated_tasks, targets, user, target_id)
    return {"message": "Xoa nhiem vu thanh cong", "task_id": task_id, "target_progress_pct": progress}
