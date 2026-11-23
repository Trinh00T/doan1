
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  RefreshCw,
  Search,
  Clock3
} from "lucide-react";

const API = "http://127.0.0.1:8000";

function AlertsScheduling() {
  const [alerts, setAlerts] = useState([]);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [availableHours, setAvailableHours] = useState(2);
  const [days, setDays] = useState(7);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [alertsRes, targetsRes] = await Promise.all([
        fetch(`${API}/api/alerts`),
        fetch(`${API}/api/targets`)
      ]);

      if (!alertsRes.ok || !targetsRes.ok) {
        throw new Error("Không thể tải dữ liệu cảnh báo.");
      }

      const alertsData = await alertsRes.json();
      const targetsData = await targetsRes.json();

      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setTargets(Array.isArray(targetsData) ? targetsData : []);

      setSelectedTarget((current) =>
        current || (targetsData[0]?.target_id ?? "")
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function generateSchedule() {
    if (!selectedTarget) return;

    setGenerating(true);
    setScheduleError("");
    setSchedule(null);

    try {
      const params = new URLSearchParams({
        available_hours: String(availableHours),
        days: String(days)
      });

      const response = await fetch(
        `${API}/api/schedule/recommend/${encodeURIComponent(selectedTarget)}?${params}`
      );

      if (!response.ok) {
        throw new Error("Không thể tạo lịch học đề xuất.");
      }

      const data = await response.json();
      setSchedule(data);
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  const high = alerts.filter(
    (a) => a.risk_level === "Cao"
  ).length;

  const medium = alerts.filter(
    (a) => a.risk_level === "Trung binh"
  ).length;

  const low = alerts.filter(
    (a) => a.risk_level === "Thap"
  ).length;

  const selectedAlert = alerts.find(
    (a) => a.target_id === selectedTarget
  );

  const fieldStyle = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box"
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20
  };

  const buttonStyle = {
    padding: "11px 17px",
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8
  };

  function riskColor(level) {
    if (level === "Cao") return "#dc2626";
    if (level === "Trung binh") return "#d97706";
    return "#16a34a";
  }

  return (
    <div style={{ paddingBottom: 30 }}>
      <div className="page-heading">
        <div>
          <h1>Cảnh báo và điều chỉnh kế hoạch</h1>
          <p>
            Phát hiện chậm tiến độ và đề xuất lịch học
            bằng phương pháp Rule-Based
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <AlertTriangle size={21} />
          Tổng quan mức độ nguy cơ
        </h3>

        {loading && <p>Đang tải cảnh báo...</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginTop: 16
        }}>
          {[
            ["Tổng mục tiêu có đánh giá", alerts.length, "#334155"],
            ["Nguy cơ cao", high, "#dc2626"],
            ["Nguy cơ trung bình", medium, "#d97706"],
            ["Nguy cơ thấp", low, "#16a34a"]
          ].map(([label, value, color]) => (
            <div key={label} style={{
              padding: 16,
              borderRadius: 11,
              background: "#f8fafc",
              border: "1px solid #e2e8f0"
            }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {label}
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color,
                marginTop: 7
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={loadData}
          style={{
            ...buttonStyle,
            background: "#eef2ff",
            color: "#4338ca",
            marginTop: 16
          }}
        >
          <RefreshCw size={16} />
          Làm mới cảnh báo
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <Search size={21} />
          Cảnh báo theo mục tiêu
        </h3>

        <div style={{ maxWidth: 440, margin: "15px 0" }}>
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            Chọn mục tiêu học tập
          </label>
          <select
            style={{ ...fieldStyle, marginTop: 7 }}
            value={selectedTarget}
            onChange={(e) => {
              setSelectedTarget(e.target.value);
              setSchedule(null);
              setScheduleError("");
            }}
          >
            {targets.map((target) => (
              <option
                key={target.target_id}
                value={target.target_id}
              >
                {target.target_id} - {target.target_name}
              </option>
            ))}
          </select>
        </div>

        {selectedAlert ? (
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 11,
            padding: 17
          }}>
            <p>
              <strong>Tiến độ kế hoạch:</strong>{" "}
              {selectedAlert.planned_progress_pct}%
            </p>
            <p>
              <strong>Tiến độ thực tế:</strong>{" "}
              {selectedAlert.actual_progress_pct}%
            </p>
            <p>
              <strong>Chênh lệch:</strong>{" "}
              {selectedAlert.progress_gap_pct} điểm %
            </p>
            <p>
              <strong>Mức nguy cơ:</strong>{" "}
              <span style={{
                fontWeight: 700,
                color: riskColor(selectedAlert.risk_level)
              }}>
                {selectedAlert.risk_level}
              </span>
            </p>
            <p>
              <strong>Nhận xét:</strong>{" "}
              {selectedAlert.message}
            </p>
            <small style={{ color: "#64748b" }}>
              Phương pháp: Rule-Based Detection
              {" | "}
              Ngày dữ liệu: {selectedAlert.date}
            </small>
          </div>
        ) : (
          <p style={{ color: "#64748b" }}>
            Chưa có dữ liệu cảnh báo cho mục tiêu này.
          </p>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ display: "flex", gap: 9, alignItems: "center" }}>
          <CalendarDays size={21} />
          Đề xuất điều chỉnh lịch học
        </h3>

        <p style={{ color: "#64748b" }}>
          Nhập thời gian có thể học để hệ thống phân bổ
          nhiệm vụ theo mức độ ưu tiên.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 15,
          marginTop: 17,
          marginBottom: 18
        }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 14 }}>
              Số giờ học mỗi ngày
            </label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={availableHours}
              onChange={(e) => setAvailableHours(e.target.value)}
              style={{ ...fieldStyle, marginTop: 7 }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: 14 }}>
              Số ngày lập lịch
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={{ ...fieldStyle, marginTop: 7 }}
            />
          </div>
        </div>

        <button
          style={buttonStyle}
          onClick={generateSchedule}
          disabled={
            generating ||
            !selectedTarget ||
            !(Number(availableHours) > 0) ||
            Number(availableHours) > 24 ||
            !Number.isInteger(Number(days)) ||
            Number(days) < 1 ||
            Number(days) > 30
          }
        >
          <Clock3 size={17} />
          {generating
            ? "Đang tạo lịch..."
            : "Tạo lịch học đề xuất"}
        </button>

        {scheduleError && (
          <p style={{ color: "#dc2626", marginTop: 15 }}>
            {scheduleError}
          </p>
        )}

        {schedule && (
          <div style={{ marginTop: 22 }}>
            <h4>Kết quả đề xuất</h4>

            <p>
              <strong>Thông báo:</strong>{" "}
              {schedule.message}
            </p>

            {schedule.overdue && (
              <p style={{ color: "#dc2626", fontWeight: 600 }}>
                Mục tiêu đã quá hạn. Cần xem xét gia hạn.
              </p>
            )}

            <p>
              <strong>Thời gian chưa phân bổ:</strong>{" "}
              {schedule.unscheduled_hours ?? 0} giờ
            </p>

            {schedule.recommendations?.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse"
                }}>
                  <thead>
                    <tr>
                      <th>Ngày học</th>
                      <th>Nhiệm vụ</th>
                      <th>Ưu tiên</th>
                      <th>Thời lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.recommendations.map((item, index) => (
                      <tr key={`${item.task_id}-${item.date}-${index}`}>
                        <td>{item.date}</td>
                        <td>{item.task_name}</td>
                        <td>{item.priority}</td>
                        <td>{item.allocated_hours} giờ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                Không có nhiệm vụ cần phân bổ lịch học.
              </p>
            )}

            <p style={{
              fontSize: 13,
              color: "#64748b",
              marginTop: 15
            }}>
              Lịch chỉ mang tính đề xuất, chưa tự động
              thay đổi dữ liệu lịch học hiện tại.
              Thời lượng nhiệm vụ có thể là giá trị ước lượng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertsScheduling;
