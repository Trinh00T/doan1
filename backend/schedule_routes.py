
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
from datetime import date, timedelta
import json

router = APIRouter(
    prefix="/api/schedule",
    tags=["Rule-Based Scheduling"]
)

DATA_DIR = Path(__file__).resolve().parent / "data"


# DOC DU LIEU JSON
def read_json(filename):
    path = DATA_DIR / filename

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Khong tim thay file {filename}"
        )

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise HTTPException(
            status_code=500,
            detail=f"Du lieu {filename} khong hop le"
        )

    return data


# CHAM DIEM MUC DO UU TIEN
def priority_score(priority):
    scores = {
        "Cao": 3,
        "Trung binh": 2,
        "Thap": 1
    }

    return scores.get(priority, 1)


# LAY SO GIO DU KIEN CUA CONG VIEC
def get_estimated_hours(task, reference_hours):
    task_id = task.get("task_id")

    estimated = task.get("estimated_hours")

    # Uu tien so gio du kien da luu
    if estimated is not None:
        try:
            hours = float(estimated)

            if 0 < hours <= 1000:
                return hours
        except (TypeError, ValueError):
            pass

    # Tuong thich voi cong viec cu
    return max(
        1.0,
        reference_hours.get(task_id, 0)
    )


# API DE XUAT LICH HOC
@router.get("/recommend/{target_id}")
def recommend_schedule(
    target_id: str,
    available_hours: float = Query(
        default=2,
        gt=0,
        le=24,
        description="So gio co the hoc moi ngay"
    ),
    days: int = Query(
        default=7,
        ge=1,
        le=30,
        description="So ngay lap lich"
    )
):
    # 1. DOC DU LIEU
    targets = read_json("targets.json")
    tasks = read_json("user_tasks.json")
    old_schedule = read_json("study_schedule.json")

    # 2. TIM MUC TIEU
    target = next(
        (
            t for t in targets
            if t.get("target_id") == target_id
        ),
        None
    )

    if target is None:
        raise HTTPException(
            status_code=404,
            detail="Khong tim thay muc tieu"
        )

    progress = float(
        target.get("target_completion_pct") or 0
    )

    # 3. KIEM TRA MUC TIEU HOAN THANH
    if (
        progress >= 100
        or target.get("status") in [
            "Hoan thanh",
            "Hoàn thành"
        ]
    ):
        return {
            "target_id": target_id,
            "message": "Muc tieu da hoan thanh",
            "recommendations": [],
            "total_required_hours": 0,
            "scheduled_hours": 0,
            "unscheduled_hours": 0
        }

    # 4. LOC CONG VIEC CHUA HOAN THANH
    unfinished_tasks = [
        task for task in tasks
        if task.get("target_id") == target_id
        and task.get("status") not in [
            "Hoan thanh",
            "Hoàn thành"
        ]
    ]

    # 5. SAP XEP THEO UU TIEN VA DEADLINE
    unfinished_tasks.sort(
        key=lambda task: (
            -priority_score(
                task.get("priority", "")
            ),
            task.get("deadline") or "9999-12-31"
        )
    )

    if not unfinished_tasks:
        return {
            "target_id": target_id,
            "message": (
                "Chua co nhiem vu chua hoan thanh. "
                "Hay them nhiem vu de lap lich."
            ),
            "recommendations": [],
            "total_required_hours": 0,
            "scheduled_hours": 0,
            "unscheduled_hours": 0
        }

    # 6. KIEM TRA THOI HAN MUC TIEU
    today = date.today()
    deadline_text = target.get("deadline")

    try:
        deadline = date.fromisoformat(
            deadline_text
        )
    except (ValueError, TypeError):
        deadline = None

    overdue = (
        deadline is not None
        and deadline < today
    )

    # 7. LAY SO GIO THAM KHAO TU LICH CU
    reference_hours = {}

    for item in old_schedule:
        if item.get("target_id") != target_id:
            continue

        task_id = item.get("task_id")

        if not task_id:
            continue

        try:
            allocated = float(
                item.get("allocated_hours") or 0
            )
        except (TypeError, ValueError):
            allocated = 0

        if allocated > 0:
            reference_hours[task_id] = (
                reference_hours.get(task_id, 0)
                + allocated
            )

    # 8. TINH SO GIO DU KIEN CAN PHAN BO
    remaining_hours = {}

    for task in unfinished_tasks:
        task_id = task.get("task_id")

        if not task_id:
            continue

        remaining_hours[task_id] = (
            get_estimated_hours(
                task,
                reference_hours
            )
        )

    # Tong khoi luong gio du kien ban dau
    total_required_hours = round(
        sum(remaining_hours.values()),
        2
    )

    # 9. LAP LICH HOC THEO QUY TAC
    recommendations = []

    for day_index in range(days):
        current_date = (
            today + timedelta(days=day_index)
        )

        hours_left = available_hours

        for task in unfinished_tasks:
            task_id = task.get("task_id")

            if task_id not in remaining_hours:
                continue

            hours_needed = remaining_hours[task_id]

            if hours_needed <= 0:
                continue

            if hours_left <= 0:
                break

            allocated = min(
                hours_needed,
                hours_left
            )

            recommendations.append({
                "date": current_date.isoformat(),
                "task_id": task_id,
                "task_name": task.get("task_name"),
                "priority": task.get("priority"),
                "allocated_hours": round(
                    allocated,
                    2
                )
            })

            remaining_hours[task_id] -= allocated
            hours_left -= allocated

    # 10. TINH TONG SO GIO DA XEP LICH
    scheduled_hours = round(
        sum(
            item["allocated_hours"]
            for item in recommendations
        ),
        2
    )

    # 11. TINH SO GIO CHUA XEP DUOC
    unscheduled_hours = round(
        max(
            0,
            total_required_hours - scheduled_hours
        ),
        2
    )

    # 12. TRA KET QUA
    return {
        "target_id": target_id,
        "target_name": target.get("target_name"),
        "current_progress": progress,
        "deadline": deadline_text,
        "overdue": overdue,
        "available_hours_per_day": available_hours,
        "days": days,
        "method": "Rule-Based Scheduling",
        "message": (
            "Muc tieu da qua han. Can xem xet gia han."
            if overdue
            else "Lich hoc duoc de xuat theo muc uu tien."
        ),
        "total_required_hours": total_required_hours,
        "scheduled_hours": scheduled_hours,
        "unscheduled_hours": unscheduled_hours,
        "recommendations": recommendations
    }
