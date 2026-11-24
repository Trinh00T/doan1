
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  FileText,
  Download,
  RefreshCw,
  Search
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

const API = ((import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://studyprogress.onrender.com") + "");

function Reports() {
  const [reports, setReports] = useState([]);
  const [timeSummary, setTimeSummary] = useState(null);
  const [timeError, setTimeError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    setTimeError("");

    try {
      const response = await fetch(`${API}/api/dashboard`);

      if (!response.ok) {
        throw new Error("Không thể tải dữ liệu báo cáo.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Dữ liệu báo cáo không hợp lệ.");
      }

      setReports(data);

      // API thong ke thoi gian doc rieng; neu loi van giu bao cao muc tieu
      try {
        const timeResponse = await fetch(`${API}/api/study-time-summary`);
        if (!timeResponse.ok) throw new Error("Không tải được thống kê thời gian học.");
        const timeData = await timeResponse.json();
        if (!timeData || typeof timeData.total_planned_hours !== "number" ||
            typeof timeData.total_actual_hours !== "number") {
          throw new Error("Dữ liệu thống kê thời gian không hợp lệ.");
        }
        setTimeSummary(timeData);
      } catch (timeErr) {
        setTimeSummary(null);
        setTimeError(timeErr.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      const matchesSearch = String(
        item.student_id ?? ""
      ).toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        item.schedule_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [reports, search, statusFilter]);

  const summary = useMemo(() => {
    const totalStudents = filteredReports.length;

    const totalTargets = filteredReports.reduce(
      (sum, item) => sum + Number(item.total_targets || 0),
      0
    );

    const completed = filteredReports.reduce(
      (sum, item) => sum + Number(item.completed_targets || 0),
      0
    );

    const overdue = filteredReports.reduce(
      (sum, item) => sum + Number(item.overdue_targets || 0),
      0
    );

    // Trung bình có trọng số theo số mục tiêu, giống Dashboard tổng quan
    const avgProgress = totalTargets
      ? filteredReports.reduce(
          (sum, item) =>
            sum +
            Number(item.avg_progress_pct || 0) *
              Number(item.total_targets || 0),
          0
        ) / totalTargets
      : 0;

    return {
      totalStudents,
      totalTargets,
      completed,
      overdue,
      avgProgress
    };
  }, [filteredReports]);

  const chartData = filteredReports.slice(0, 15);

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
    marginBottom: 20
  };

  const inputStyle = {
    padding: "11px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    fontSize: 14,
    background: "#fff",
    width: "100%",
    boxSizing: "border-box"
  };

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "11px 17px",
    fontWeight: 600,
    cursor: "pointer"
  };

  const numberFormat = (value) =>
    Number(value || 0).toLocaleString("vi-VN", {
      maximumFractionDigits: 2
    });

  // Hiển thị đúng trạng thái, kể cả sinh viên chưa được đánh giá
  function formatScheduleStatus(status) {
    if (status === "De xuat gia han") return "Đề xuất gia hạn";
    if (status === "Du kien trong 7 ngay") return "Dự kiến trong 7 ngày";
    if (status === "Chua danh gia") return "Chưa đánh giá";
    return status || "Chưa đánh giá";
  }

  async function exportExcel() {
    if (filteredReports.length === 0) return;

    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Bao cao hoc tap");

      sheet.columns = [
        { header: "Mã sinh viên", key: "student_id", width: 18 },
        { header: "Tổng mục tiêu", key: "total_targets", width: 18 },
        { header: "Tiến độ trung bình (%)", key: "avg_progress_pct", width: 25 },
        { header: "Mục tiêu hoàn thành", key: "completed_targets", width: 24 },
        { header: "Mục tiêu quá hạn", key: "overdue_targets", width: 22 },
        { header: "Số ngày cần thêm", key: "days_needed", width: 20 },
        { header: "Giờ theo báo cáo cũ (tham khảo)", key: "remaining_hours", width: 35 },
        { header: "Đánh giá kế hoạch", key: "schedule_status", width: 27 }
      ];

      filteredReports.forEach((item) => {
        sheet.addRow({
          student_id: String(item.student_id ?? ""),
          total_targets: Number(item.total_targets ?? 0),
          avg_progress_pct: Number(item.avg_progress_pct ?? 0),
          completed_targets: Number(item.completed_targets ?? 0),
          overdue_targets: Number(item.overdue_targets ?? 0),
          days_needed: Number(item.days_needed ?? 0),
          remaining_hours: Number(item.remaining_hours ?? 0),
          schedule_status: formatScheduleStatus(item.schedule_status)
        });
      });

      // Thong ke thoi gian la so lieu TOAN HE THONG, khong theo bo loc SV
      const timeSheet = workbook.addWorksheet("Thong ke thoi gian");
      timeSheet.columns = [
        { header: "Chỉ số toàn hệ thống", key: "label", width: 37 },
        { header: "Giá trị", key: "value", width: 22 }
      ];
      timeSheet.addRow({ label: "Tổng giờ kế hoạch tham khảo", value: timeSummary?.total_planned_hours ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Tổng giờ học thực tế đã ghi nhận", value: timeSummary?.total_actual_hours ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Số bản ghi lịch học", value: timeSummary?.planned_records ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Số bản ghi học thực tế", value: timeSummary?.actual_records ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Mục tiêu có lịch học", value: timeSummary?.targets_with_plan ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Mục tiêu có ghi nhận thực tế", value: timeSummary?.targets_with_actual_time ?? "Chưa có dữ liệu" });
      timeSheet.addRow({ label: "Giờ còn lại", value: "Chưa đủ dữ liệu để tính chính xác" });
      timeSheet.addRow({ label: "Phạm vi", value: "Toàn hệ thống; không áp dụng bộ lọc sinh viên" });
      timeSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      timeSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF303F86" } };
      timeSheet.getColumn(2).numFmt = "0.00";

      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: "FF303F86" }
      };
      header.alignment = { vertical: "middle", wrapText: true };
      header.height = 30;
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = { from: "A1", to: "H1" };
      for (let i = 2; i <= sheet.rowCount; i++) {
        sheet.getCell(`C${i}`).numFmt = "0.00";
        sheet.getCell(`G${i}`).numFmt = "0.00";
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "StudyProgress_BaoCao.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      alert("Không thể xuất Excel. Hãy kiểm tra đã cài exceljs chưa.");
    }
  }

  return (
    <div style={{ paddingBottom: 30 }}>
      <div className="page-heading">
        <div>
          <h1>Báo cáo và đánh giá</h1>
          <p>
            Tổng hợp kết quả học tập, theo dõi tiến độ
            và đánh giá tình trạng thực hiện mục tiêu
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>
          <BarChart3 size={21} style={{
            verticalAlign: "middle",
            marginRight: 9
          }} />
          Tổng quan kết quả học tập
        </h3>

        {loading && <p>Đang tải dữ liệu...</p>}
        {error && (
          <p style={{ color: "#dc2626" }}>{error}</p>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(155px, 1fr))",
          gap: 14,
          marginTop: 18
        }}>
          {[
            ["Số sinh viên", summary.totalStudents, "#334155"],
            ["Tổng mục tiêu", summary.totalTargets, "#4f46e5"],
            ["Hoàn thành", summary.completed, "#16a34a"],
            ["Quá hạn", summary.overdue, "#dc2626"],
            [
              "Tiến độ trung bình",
              `${numberFormat(summary.avgProgress)}%`,
              "#d97706"
            ]
          ].map(([label, value, color]) => (
            <div key={label} style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 11,
              padding: 16
            }}>
              <div style={{
                color: "#64748b",
                fontSize: 13
              }}>
                {label}
              </div>
              <div style={{
                fontSize: 25,
                fontWeight: 700,
                color,
                marginTop: 7
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: "#64748b", fontSize: 13, marginTop: 12 }}>
          Các chỉ số sinh viên và mục tiêu thay đổi theo bộ lọc tìm kiếm và đánh giá.
        </p>
        {timeError && <p style={{ color: "#dc2626", fontSize: 13 }}>{timeError}</p>}

        <button
          onClick={loadReports}
          style={{
            ...buttonStyle,
            background: "#eef2ff",
            color: "#4338ca",
            marginTop: 17
          }}
        >
          <RefreshCw size={16} />
          Làm mới báo cáo
        </button>
      </div>

      <div style={cardStyle}>
        <h3>
          <Search size={21} style={{
            verticalAlign: "middle",
            marginRight: 9
          }} />
          Tìm kiếm và lọc báo cáo
        </h3>

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 15,
          marginTop: 17
        }}>
          <div>
            <label style={{ fontWeight: 600 }}>
              Mã sinh viên
            </label>
            <input
              type="text"
              placeholder="Ví dụ: SV001"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...inputStyle,
                marginTop: 7
              }}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>
              Đánh giá kế hoạch
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              style={{
                ...inputStyle,
                marginTop: 7
              }}
            >
              <option value="all">Tất cả</option>
              <option value="Du kien trong 7 ngay">
                Dự kiến trong 7 ngày
              </option>
              <option value="De xuat gia han">
                Đề xuất gia hạn
              </option>
              <option value="Chua danh gia">
                Chưa đánh giá
              </option>
            </select>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>Biểu đồ tiến độ trung bình theo sinh viên</h3>

        <p style={{ color: "#64748b", fontSize: 13 }}>
          Hiển thị tối đa 15 sinh viên đầu tiên
          trong kết quả lọc.
        </p>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="student_id" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar
                dataKey="avg_progress_pct"
                name="Tiến độ trung bình (%)"
                fill="#6366f1"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={cardStyle}>
        <h3>
          So sánh số mục tiêu hoàn thành và quá hạn
        </h3>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="student_id" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="completed_targets"
                name="Hoàn thành"
                fill="#16a34a"
              />
              <Bar
                dataKey="overdue_targets"
                name="Quá hạn"
                fill="#ef4444"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}>
          <h3 style={{
            display: "flex",
            alignItems: "center",
            gap: 9
          }}>
            <FileText size={21} />
            Bảng báo cáo chi tiết
          </h3>

          <button
            onClick={exportExcel}
            disabled={filteredReports.length === 0}
            style={buttonStyle}
          >
            <Download size={17} />
            Xuất báo cáo Excel (.xlsx)
          </button>
        </div>

        <div style={{
          overflowX: "auto",
          marginTop: 16
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 850
          }}>
            <thead>
              <tr>
                <th>Mã SV</th>
                <th>Tổng mục tiêu</th>
                <th>Tiến độ TB</th>
                <th>Hoàn thành</th>
                <th>Quá hạn</th>
                <th>Ngày cần thêm</th>
                <th>Giờ theo báo cáo cũ (tham khảo)</th>
                <th>Đánh giá</th>
              </tr>
            </thead>

            <tbody>
              {filteredReports.map((item) => (
                <tr key={item.student_id}>
                  <td>{item.student_id}</td>
                  <td>{item.total_targets}</td>
                  <td>
                    {numberFormat(item.avg_progress_pct)}%
                  </td>
                  <td>{item.completed_targets}</td>
                  <td>{item.overdue_targets}</td>
                  <td>{item.days_needed}</td>
                  <td>
                    {numberFormat(item.remaining_hours)}
                  </td>
                  <td>
                    {formatScheduleStatus(item.schedule_status)}
                  </td>
                </tr>
              ))}

              {filteredReports.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      textAlign: "center",
                      padding: 20
                    }}
                  >
                    Không có dữ liệu phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={{
          fontSize: 13,
          color: "#64748b",
          marginTop: 15
        }}>
          Nguồn: /api/dashboard và /api/study-time-summary. Số lượng và tiến độ
          mục tiêu được tổng hợp từ dữ liệu hiện tại. Các cột "Ngày cần thêm",
          "Giờ theo báo cáo cũ" và "Đánh giá" là số liệu lịch sử, chỉ để tham khảo;
          không được xem là dự báo mới hay số giờ thực sự còn lại.
        </p>
      </div>
    </div>
  );
}

export default Reports;
