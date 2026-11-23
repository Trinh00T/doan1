from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# Tai mo hinh Linear Regression da huan luyen
model_data = joblib.load(BASE_DIR / "models" / "linear_regression.joblib")
model = model_data["model"]
features = model_data["features"]


def read_json(filename):
    file_path = DATA_DIR / filename
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def predict_target(target_id):
    # Chi du bao cho muc tieu hien dang ton tai
    targets = read_json("targets.json")
    if not isinstance(targets, list):
        raise ValueError("Du lieu targets.json khong hop le")

    target = next(
        (item for item in targets if str(item.get("target_id")) == str(target_id)),
        None,
    )
    if target is None:
        return None

    # Doc lich su thuc, khong tu tao ban ghi gia
    history = read_json("progress_history.json")
    if not isinstance(history, list) or not history:
        return None

    df = pd.DataFrame(history)
    required_columns = {"target_id", "date", "actual_progress_pct", "student_id"}
    if not required_columns.issubset(df.columns):
        return None

    df = df[df["target_id"].astype(str) == str(target_id)].copy()
    if df.empty:
        return None

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["actual_progress_pct"] = pd.to_numeric(
        df["actual_progress_pct"], errors="coerce"
    )
    df = df.dropna(subset=["date", "actual_progress_pct"])
    df = df.sort_values("date").reset_index(drop=True)

    # Can it nhat 8 ban ghi de tinh lag_7 va rolling_mean_7
    if len(df) < 8:
        return None

    # Giu nguyen cach tao dac trung cua mo hinh da huan luyen
    df["lag_1"] = df["actual_progress_pct"].shift(1)
    df["lag_3"] = df["actual_progress_pct"].shift(3)
    df["lag_7"] = df["actual_progress_pct"].shift(7)
    df["rolling_mean_7"] = (
        df["actual_progress_pct"].shift(1).rolling(7).mean()
    )
    df["day_number"] = np.arange(1, len(df) + 1)

    latest = df.tail(1).copy()
    if latest[features].isna().any().any():
        return None

    delta = model.predict(latest[features])[0]
    actual = float(latest["actual_progress_pct"].iloc[0])
    predicted = float(np.clip(actual + delta, 0, 100))
    forecast_date = latest["date"].iloc[0] + pd.Timedelta(days=1)

    return {
        "student_id": str(latest["student_id"].iloc[0]),
        "target_id": str(target_id),
        "date": latest["date"].iloc[0].strftime("%Y-%m-%d"),
        "forecast_date": forecast_date.strftime("%Y-%m-%d"),
        "actual_progress_pct": round(actual, 2),
        "predicted_progress": round(predicted, 2),
        "predicted_change": round(predicted - actual, 2),
        "model_name": "Linear Regression",
    }
