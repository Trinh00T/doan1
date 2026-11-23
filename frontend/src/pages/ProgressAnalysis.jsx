import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

const API = "http://127.0.0.1:8000";
const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

function formatDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function ProgressAnalysis() {
  const [history, setHistory] = useState([]);
  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const [historyResponse, targetsResponse] = await Promise.all([
        fetch(`${API}/api/progress-history`, { cache: "no-store" }),
        fetch(`${API}/api/targets`, { cache: "no-store" }),
      ]);
      if (!historyResponse.ok) throw new Error("Không thể tải dữ liệu lịch sử tiến độ");
      if (!targetsResponse.ok) throw new Error("Không thể tải danh sách mục tiêu");
      const [historyData, targetsData] = await Promise.all([
        historyResponse.json(), targetsResponse.json(),
      ]);
      if (!Array.isArray(historyData) || !Array.isArray(targetsData)) {
        throw new Error("Dữ liệu trả về không đúng định dạng");
      }
      setHistory(historyData);
      setTargets(targetsData);
    } catch (err) {
      setError(err.message || "Có lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  const targetIds = useMemo(() =>
    [...new Set(targets.map((item) => String(item.target_id || "")).filter(Boolean))].sort(),
    [targets]
  );

  useEffect(() => {
    if (!targetIds.includes(targetId)) setTargetId(targetIds[0] || "");
  }, [targetIds, targetId]);

  const selectedTarget = targets.find((item) => String(item.target_id) === targetId);

  const chartData = useMemo(() => history
    .filter((item) => String(item.target_id) === targetId)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map((item) => ({
      date: item.date,
      label: formatDate(item.date),
      planned: Number(item.planned_progress_pct || 0),
      actual: Number(item.actual_progress_pct || 0),
      gap: Number(item.progress_gap_pct || 0),
      hours: Number(item.study_hours || 0),
      completedTasks: Number(item.completed_tasks || 0),
      status: item.status || "",
    })), [history, targetId]);

  const latest = chartData[chartData.length - 1];
  const totalHours = chartData.reduce((sum, item) => sum + item.hours, 0);
  const averageHours = chartData.length ? totalHours / chartData.length : 0;

  return (
    <div style={{ padding: 24, width: "100%" }}>
      <h2 style={{ marginBottom: 8 }}>Phân tích tiến độ học tập theo thời gian</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Theo dõi sự thay đổi tiến độ và so sánh với kế hoạch học tập.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <label htmlFor="analysis-target"><strong>Chọn mục tiêu:</strong></label>
        <select
          id="analysis-target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 180 }}
        >
          {targetIds.map((id) => (
            <option key={id} value={id}>
              {id}{targets.find((target) => String(target.target_id) === id)?.target_name
                ? ` - ${targets.find((target) => String(target.target_id) === id).target_name}` : ""}
            </option>
          ))}
        </select>
        <button type="button" onClick={loadHistory} disabled={loading}>Làm mới dữ liệu</button>
      </div>

      {loading && <p>Đang tải dữ liệu...</p>}
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      {!loading && !error && targetIds.length === 0 && <p>Chưa có mục tiêu học tập.</p>}
      {!loading && !error && selectedTarget && (
        <p style={{ color: "#64748b", marginBottom: 18 }}>
          Tiến độ hiện tại của mục tiêu: <strong>{formatNumber(selectedTarget.target_completion_pct)}%</strong>.
          Biểu đồ bên dưới thể hiện các bản ghi lịch sử, không tự thay thế bằng tiến độ hiện tại.
        </p>
      )}
      {!loading && !error && targetId && chartData.length === 0 && (
        <p>Chưa có dữ liệu lịch sử cho mục tiêu này.</p>
      )}

      {!loading && !error && latest && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              ["Tiến độ thực tế", `${formatNumber(latest.actual)}%`],
              ["Tiến độ kế hoạch", `${formatNumber(latest.planned)}%`],
              ["Chênh lệch", `${formatNumber(latest.gap)} điểm %`],
              ["Tổng giờ học", `${formatNumber(totalHours)} giờ`],
              ["Trung bình mỗi ngày", `${formatNumber(averageHours)} giờ`],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
                <div style={{ color: "#64748b", fontSize: 14, marginBottom: 8 }}>{label}</div>
                <strong style={{ fontSize: 22, color: "#312e81" }}>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3>Biểu đồ tiến độ học tập</h3>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={30} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip /><Legend />
                  <Line type="monotone" dataKey="planned" name="Tiến độ kế hoạch (%)" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Tiến độ thực tế (%)" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3>Thời gian học tập theo ngày</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={30} tick={{ fontSize: 11 }} />
                  <YAxis /><Tooltip /><Legend />
                  <Bar dataKey="hours" name="Số giờ học" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
            <h3>Lịch sử tiến độ học tập</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead><tr>
                  {["Ngày", "Kế hoạch (%)", "Thực tế (%)", "Chênh lệch", "Giờ học", "Trạng thái"].map((heading) => (
                    <th key={heading} style={{ padding: 12, textAlign: "left", background: "#f1f5f9" }}>{heading}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...chartData].reverse().map((item, index) => (
                    <tr key={`${item.date}-${index}`}>
                      <td style={{ padding: 10 }}>{item.label}</td>
                      <td style={{ padding: 10 }}>{formatNumber(item.planned)}</td>
                      <td style={{ padding: 10 }}>{formatNumber(item.actual)}</td>
                      <td style={{ padding: 10 }}>{formatNumber(item.gap)}</td>
                      <td style={{ padding: 10 }}>{formatNumber(item.hours)}</td>
                      <td style={{ padding: 10 }}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
