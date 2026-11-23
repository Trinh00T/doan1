
# MAIN.PY - BACKEND FASTAPI STUDYPROGRESS

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import date
from collections import defaultdict
import json
import os

# Mo hinh du bao Linear Regression
from prediction import predict_target

# Cac router hien tai
from auth import router as auth_router
from target_routes import router as target_router
from task_routes import router as task_router
from time_routes import router as time_router
from resource_routes import router as resource_router
from alert_routes import router as alert_router
from schedule_routes import router as schedule_router


# 1. KHOI TAO FASTAPI
app = FastAPI(
    title="Student Progress Management API",
    description=(
        "He thong ho tro quan ly, "
        "phan tich va du bao tien do hoc tap"
    ),
    version="1.0.0"
)


# 2. KET NOI TAT CA ROUTER
app.include_router(auth_router)
app.include_router(target_router)
app.include_router(task_router)
app.include_router(time_router)
app.include_router(resource_router)
app.include_router(alert_router)
app.include_router(schedule_router)


# 3. CAU HINH CORS
# Cho phep Frontend tren may va Vercel goi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://doan1-pi.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# 4. DUONG DAN DU LIEU
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(
    os.getenv("DATA_DIR", str(BASE_DIR / "data"))
)


# 5. DOC FILE JSON
def read_json(filename):
    file_path = DATA_DIR / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Khong tim thay file {filename}"
        )

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


# 6. KIEM TRA MUC TIEU DA HOAN THANH
def is_completed(target):
    status = str(
        target.get("status", "")
    ).strip().lower()

    progress = float(
        target.get("target_completion_pct") or 0
    )

    return (
        status in ["hoan thanh", "hoàn thành"]
        or progress >= 100
    )


# 7. KIEM TRA MUC TIEU QUA HAN
def is_overdue(target, today):
    if is_completed(target):
        return False

    deadline = target.get("deadline")

    if not deadline:
        return False

    try:
        deadline_date = date.fromisoformat(
            str(deadline)
        )
        return deadline_date < today

    except (ValueError, TypeError):
        return False


# API 1: KIEM TRA BACKEND
@app.get("/")
def home():
    return {
        "message": "Student Progress API",
        "status": "running",
        "model": "Linear Regression"
    }


# API 2: DASHBOARD DONG BO DU LIEU
@app.get("/api/dashboard")
def get_dashboard():
    targets = read_json("targets.json")
    old_dashboard = read_json("dashboard.json")

    if not isinstance(targets, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu targets.json khong hop le"
        )

    if not isinstance(old_dashboard, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu dashboard.json khong hop le"
        )

    today = date.today()

    # Nhom muc tieu theo sinh vien
    targets_by_student = defaultdict(list)

    for target in targets:
        student_id = str(
            target.get("student_id", "")
        ).strip()

        if student_id:
            targets_by_student[student_id].append(
                target
            )

    # Giu lai du lieu thong ke cu
    old_by_student = {
        str(item.get("student_id")): item
        for item in old_dashboard
        if item.get("student_id")
    }

    # Bao gom sinh vien cu va sinh vien moi
    all_student_ids = sorted(
        set(old_by_student.keys())
        | set(targets_by_student.keys())
    )

    results = []

    for student_id in all_student_ids:
        student_targets = (
            targets_by_student.get(student_id, [])
        )

        old_data = old_by_student.get(
            student_id, {}
        )

        total_targets = len(student_targets)

        completed_targets = sum(
            1 for target in student_targets
            if is_completed(target)
        )

        overdue_targets = sum(
            1 for target in student_targets
            if is_overdue(target, today)
        )

        if total_targets > 0:
            total_progress = sum(
                max(
                    0,
                    min(
                        100,
                        float(
                            target.get(
                                "target_completion_pct"
                            ) or 0
                        )
                    )
                )
                for target in student_targets
            )

            avg_progress = round(
                total_progress / total_targets,
                2
            )
        else:
            avg_progress = 0.0

        results.append({
            "student_id": student_id,
            "total_targets": total_targets,
            "avg_progress_pct": avg_progress,
            "completed_targets": completed_targets,
            "overdue_targets": overdue_targets,

            # Tam giu du lieu tong hop cu
            "days_needed": old_data.get(
                "days_needed", 0
            ),
            "remaining_hours": old_data.get(
                "remaining_hours", 0
            ),
            "schedule_status": old_data.get(
                "schedule_status",
                "Chua danh gia"
            )
        })

    return results


# API 3: DANH SACH MUC TIEU HOC TAP
@app.get("/api/targets")
def get_targets():
    return read_json("targets.json")


# API 4: LICH SU TIEN DO HOC TAP
@app.get("/api/progress-history")
def get_progress_history():
    return read_json("progress_history.json")


# API 5: KET QUA DU BAO LINEAR REGRESSION
@app.get("/api/forecasts")
def get_forecasts():
    return read_json("forecasts.json")


# API 6: LICH HOC DE XUAT BAN DAU
@app.get("/api/study-schedule")
def get_study_schedule():
    return read_json("study_schedule.json")


# API 7: DU BAO TRUC TIEP
@app.get("/api/predict/{target_id}")
def get_prediction(target_id: str):
    result = predict_target(target_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Khong tim thay muc tieu "
                "hoac khong du du lieu"
            )
        )

    return result


# API 8: THONG KE THOI GIAN HOC
@app.get("/api/study-time-summary")
def get_study_time_summary():

    # Doc du lieu lich hoc va gio hoc thuc te
    schedules = read_json("study_schedule.json")
    study_times = read_json("study_time.json")

    if not isinstance(schedules, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu study_schedule.json khong hop le"
        )

    if not isinstance(study_times, list):
        raise HTTPException(
            status_code=500,
            detail="Du lieu study_time.json khong hop le"
        )

    # 1. Tinh tong gio ke hoach
    total_planned_hours = 0.0
    planned_target_ids = set()

    for item in schedules:
        target_id = item.get("target_id")

        if target_id:
            planned_target_ids.add(str(target_id))

        try:
            hours = float(
                item.get("allocated_hours") or 0
            )
        except (TypeError, ValueError):
            hours = 0

        if hours > 0:
            total_planned_hours += hours

    # 2. Tinh tong gio hoc thuc te
    total_actual_hours = 0.0
    actual_target_ids = set()

    for item in study_times:
        target_id = item.get("target_id")

        if target_id:
            actual_target_ids.add(str(target_id))

        try:
            hours = float(
                item.get("study_hours") or 0
            )
        except (TypeError, ValueError):
            hours = 0

        if hours > 0:
            total_actual_hours += hours

    # 3. Tra ve thong ke
    return {
        "total_planned_hours": round(
            total_planned_hours, 2
        ),
        "total_actual_hours": round(
            total_actual_hours, 2
        ),
        "planned_records": len(schedules),
        "actual_records": len(study_times),
        "targets_with_plan": len(
            planned_target_ids
        ),
        "targets_with_actual_time": len(
            actual_target_ids
        ),
        "remaining_hours": None,
        "remaining_hours_status": (
            "Chua du du lieu de tinh chinh xac"
        )
    }
