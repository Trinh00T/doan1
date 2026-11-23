
import joblib
import pandas as pd
import numpy as np
import json

# 1. Tai mo hinh Linear Regression
model_data = joblib.load(
    "models/linear_regression.joblib"
)

model = model_data["model"]
features = model_data["features"]

# 2. Doc du lieu lich su
with open(
    "data/progress_history.json",
    "r",
    encoding="utf-8"
) as f:
    df = pd.DataFrame(json.load(f))

# 3. Chuyen cot ngay sang datetime
df["date"] = pd.to_datetime(df["date"])

# 4. Sap xep theo muc tieu va ngay
df = df.sort_values(
    ["target_id", "date"]
).reset_index(drop=True)

# 5. Tao dac trung chuoi thoi gian
group = df.groupby("target_id")

df["lag_1"] = group["actual_progress_pct"].shift(1)
df["lag_3"] = group["actual_progress_pct"].shift(3)
df["lag_7"] = group["actual_progress_pct"].shift(7)

df["rolling_mean_7"] = group[
    "actual_progress_pct"
].transform(
    lambda x: x.shift(1).rolling(7).mean()
)

df["day_number"] = group.cumcount() + 1

# 6. Lay ban ghi moi nhat cua moi muc tieu
latest = (
    df.groupby("target_id")
    .tail(1)
    .copy()
)

# 7. Kiem tra du 13 dac trung
missing = [
    col for col in features
    if col not in latest.columns
]

if missing:
    raise ValueError(
        f"Thieu dac trung: {missing}"
    )

X = latest[features].copy()

if X.isna().any().any():
    raise ValueError(
        "Du lieu du bao con gia tri thieu"
    )

# 8. Du bao bang Linear Regression
predicted_delta = model.predict(X)

latest["predicted_progress"] = np.clip(
    latest["actual_progress_pct"].to_numpy()
    + predicted_delta,
    0,
    100
)

# 9. Tinh muc tang du bao
latest["predicted_change"] = (
    latest["predicted_progress"]
    - latest["actual_progress_pct"]
)

# 10. Hien thi ket qua
print("===== KIEM TRA LINEAR REGRESSION =====")
print("So dong lich su:", len(df))
print("So muc tieu du bao:", len(latest))
print("So dac trung:", len(features))

print("\n===== 10 KET QUA DU BAO =====")

print(
    latest[
        [
            "student_id",
            "target_id",
            "actual_progress_pct",
            "predicted_progress",
            "predicted_change"
        ]
    ].head(10).round(2).to_string(index=False)
)

print("\n===== THONG KE =====")

print(
    "Tien do du bao trung binh:",
    round(latest["predicted_progress"].mean(), 2),
    "%"
)

print(
    "So muc tieu du bao dat 100%:",
    int((latest["predicted_progress"] >= 100).sum())
)

print("\nDu bao hoan thanh!")
