
# ALERT_ROUTES.PY - CANH BAO TIEN DO HOC TAP
# Phuong phap: Rule-Based Detection

from fastapi import APIRouter, HTTPException
from pathlib import Path
from datetime import date
import json

router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"]
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


def read_json(filename):
    file_path = DATA_DIR / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Khong tim thay file {filename}"
        )

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_risk(record):
    planned = float(record.get("planned_progress_pct", 0))
    actual = float(record.get("actual_progress_pct", 0))

    gap = actual - planned

    if gap <= -15:
        level = "Cao"
        message = "Tien do cham nghiem trong so voi ke hoach"
    elif gap <= -5:
        level = "Trung binh"
        message = "Tien do dang cham so voi ke hoach"
    else:
        level = "Thap"
        message = "Tien do gan voi ke hoach"

    return {
        "risk_level": level,
        "progress_gap_pct": round(gap, 2),
        "message": message
    }


@router.get("")
def get_alerts():
    history = read_json("progress_history.json")

    # Lay ban ghi moi nhat cua moi muc tieu
    latest = {}

    for record in history:
        target_id = record.get("target_id")
        record_date = record.get("date", "")

        if not target_id:
            continue

        if (
            target_id not in latest
            or record_date > latest[target_id].get("date", "")
        ):
            latest[target_id] = record

    alerts = []

    for target_id, record in latest.items():
        result = detect_risk(record)

        alerts.append({
            "target_id": target_id,
            "date": record.get("date"),
            "planned_progress_pct": record.get(
                "planned_progress_pct", 0
            ),
            "actual_progress_pct": record.get(
                "actual_progress_pct", 0
            ),
            "progress_gap_pct": result["progress_gap_pct"],
            "risk_level": result["risk_level"],
            "message": result["message"],
            "method": "Rule-Based Detection"
        })

    return alerts


@router.get("/{target_id}")
def get_target_alert(target_id: str):
    history = read_json("progress_history.json")

    records = [
        item for item in history
        if item.get("target_id") == target_id
    ]

    if not records:
        raise HTTPException(
            status_code=404,
            detail="Khong tim thay lich su tien do cua muc tieu"
        )

    latest = max(
        records,
        key=lambda item: item.get("date", "")
    )

    result = detect_risk(latest)

    return {
        "target_id": target_id,
        "date": latest.get("date"),
        "planned_progress_pct": latest.get(
            "planned_progress_pct", 0
        ),
        "actual_progress_pct": latest.get(
            "actual_progress_pct", 0
        ),
        "progress_gap_pct": result["progress_gap_pct"],
        "risk_level": result["risk_level"],
        "message": result["message"],
        "method": "Rule-Based Detection"
    }
