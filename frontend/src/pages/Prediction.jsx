import { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";

const API = "https://studyprogress.onrender.com/api";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

function formatDate(value) {
  if (!value) return "";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function Prediction() {
  const [targetIds, setTargetIds] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  async function loadTargets() {
    setLoadingTargets(true);
    setError("");
    try {
      const response = await fetch(`${API}/targets`, { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải danh sách mục tiêu");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Danh sách mục tiêu không đúng định dạng");
      const ids = [...new Set(data.map((item) => item.target_id).filter(Boolean))].sort();
      setTargetIds(ids);
      setTargetId((previous) => ids.includes(previous) ? previous : (ids[0] || ""));
      if (!ids.length) {
        requestId.current += 1;
        setPrediction(null);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "Không thể tải mục tiêu");
    } finally {
      setLoadingTargets(false);
    }
  }

  useEffect(() => {
    loadTargets();
    return () => { requestId.current += 1; };
  }, []);

  async function handlePredict(id = targetId) {
    if (!id) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    setPrediction(null);
    try {
      const response = await fetch(`${API}/predict/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error("Mục tiêu này chưa có đủ lịch sử hợp lệ để dự báo, hoặc không còn tồn tại.");
        }
        throw new Error(typeof result.detail === "string" ? result.detail : "Không thể dự báo mục tiêu này");
      }
      const result = await response.json();
      if (currentRequest === requestId.current) setPrediction(result);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.message || "Dự báo thất bại");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (targetId) handlePredict(targetId);
    else {
      requestId.current += 1;
      setPrediction(null);
    }
  }, [targetId]);

  const chartData = prediction ? [
    { name: "Hiện tại", progress: prediction.actual_progress_pct, color: "#2563eb" },
    { name: "Dự báo", progress: prediction.predicted_progress, color: "#7c3aed" },
  ] : [];

  return (
    <div style={{ padding: 24, width: "100%" }}>
      <h2>Dự báo tiến độ học tập bằng Machine Learning</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Sử dụng Linear Regression để dự báo tiến độ ngày tiếp theo từ lịch sử học tập.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <label htmlFor="prediction-target"><strong>Chọn mục tiêu:</strong></label>
        <select
          id="prediction-target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          disabled={loadingTargets || targetIds.length === 0}
          style={{ padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, minWidth: 180 }}
        >
          {targetIds.length === 0 && <option value="">Chưa có mục tiêu</option>}
          {targetIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <button
          type="button"
          onClick={() => handlePredict()}
          disabled={loading || loadingTargets || !targetId}
          style={{ background: "#7c3aed", color: "white", padding: "10px 18px", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {loading ? "Đang dự báo..." : "Dự báo tiến độ"}
        </button>
        <button
          type="button"
          onClick={loadTargets}
          disabled={loadingTargets}
          style={{ background: "#e2e8f0", color: "#334155", padding: "10px 18px", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {loadingTargets ? "Đang tải mục tiêu..." : "Làm mới danh sách"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {!loadingTargets && !error && targetIds.length === 0 && <p>Chưa có mục tiêu để dự báo.</p>}

      {prediction && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              ["Tiến độ tại ngày dữ liệu", `${formatNumber(prediction.actual_progress_pct)}%`],
              ["Tiến độ dự báo", `${formatNumber(prediction.predicted_progress)}%`],
              ["Mức tăng dự kiến", `${prediction.predicted_change >= 0 ? "+" : ""}${formatNumber(prediction.predicted_change)} điểm %`],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#fff", padding: 20, border: "1px solid #e2e8f0", borderRadius: 12 }}>
                <p style={{ color: "#64748b" }}>{label}</p>
                <h2 style={{ color: "#4c1d95" }}>{value}</h2>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", padding: 24, border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 24 }}>
            <h3>Biểu đồ so sánh tiến độ</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(value) => [`${formatNumber(value)}%`, "Tiến độ"]} />
                  <Bar dataKey="progress" name="Tiến độ">
                    {chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: "#fff", padding: 24, border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <h3>Thông tin dự báo</h3>
            <p><strong>Mục tiêu:</strong> {prediction.target_id}</p>
            <p><strong>Sinh viên:</strong> {prediction.student_id}</p>
            <p><strong>Ngày dữ liệu:</strong> {formatDate(prediction.date)}</p>
            <p><strong>Ngày dự báo:</strong> {formatDate(prediction.forecast_date)}</p>
            <p><strong>Mô hình:</strong> {prediction.model_name}</p>
            <p style={{ color: "#475569", marginTop: 16 }}>
              Dựa trên dữ liệu tiến độ đến ngày {formatDate(prediction.date)}, mô hình dự báo
              tiến độ ngày {formatDate(prediction.forecast_date)} đạt {formatNumber(prediction.predicted_progress)}%.
            </p>
            <p style={{ color: "#64748b", fontSize: 13 }}>
              Kết quả phản ánh bản ghi lịch sử mới nhất, không nhất thiết là tiến độ hiện tại trong danh sách mục tiêu.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
