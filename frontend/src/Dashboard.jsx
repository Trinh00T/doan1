
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Target,
  ChartNoAxesCombined,
  BrainCircuit,
  TriangleAlert,
  FileBarChart,
  GraduationCap,
  Users,
  CheckCircle2,
  Clock3,
  LogOut
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

import Targets from "./pages/Targets";
import ProgressAnalysis from "./pages/ProgressAnalysis";
import Prediction from "./pages/Prediction";
import AlertsScheduling from "./pages/AlertsScheduling";
import Reports from "./pages/Reports";
import "./App.css";

const API = "https://studyprogress.onrender.com";

// 6 NHOM CHUC NANG CHINH
const menu = [
  {
    name: "Dashboard tổng quan",
    icon: LayoutDashboard
  },
  {
    name: "Mục tiêu và kế hoạch",
    icon: Target
  },
  {
    name: "Phân tích tiến độ",
    icon: ChartNoAxesCombined
  },
  {
    name: "Dự báo Machine Learning",
    icon: BrainCircuit
  },
  {
    name: "Cảnh báo và điều chỉnh",
    icon: TriangleAlert
  },
  {
    name: "Báo cáo và đánh giá",
    icon: FileBarChart
  }
];

function Dashboard({ user, token, onLogout }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMenu, setSelectedMenu] = useState(0);

  // Tai lai du lieu moi khi quay ve Dashboard tong quan.
  useEffect(() => {
    if (selectedMenu !== 0) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch(`${API}/api/dashboard`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Không tải được Dashboard");
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Dữ liệu Dashboard không hợp lệ");
        }
        if (!controller.signal.aborted) setStudents(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedMenu]);

  // TINH TOAN THONG KE
  const totalStudents = students.length;

  const totalTargets = students.reduce(
    (sum, s) => sum + s.total_targets,
    0
  );

  const completed = students.reduce(
    (sum, s) => sum + s.completed_targets,
    0
  );

  const overdue = students.reduce(
    (sum, s) => sum + s.overdue_targets,
    0
  );

  const avgProgress = totalTargets
    ? students.reduce(
        (sum, s) =>
          sum + s.avg_progress_pct * s.total_targets,
        0
      ) / totalTargets
    : 0;

  const completionRate = totalTargets
    ? (completed / totalTargets) * 100
    : 0;

  // DU LIEU BIEU DO
  const chartData = students.slice(0, 10).map((s) => ({
    name: s.student_id,
    progress: s.avg_progress_pct
  }));

  // CAC THE THONG KE
  const cards = [
    {
      label: "Tổng sinh viên",
      value: totalStudents,
      icon: Users
    },
    {
      label: "Tổng mục tiêu",
      value: totalTargets,
      icon: Target
    },
    {
      label: "Mục tiêu hoàn thành",
      value: completed,
      icon: CheckCircle2
    },
    {
      label: "Tiến độ trung bình",
      value: avgProgress.toFixed(2) + "%",
      icon: Clock3
    }
  ];

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <GraduationCap size={30} />

          <div>
            <strong>StudyProgress</strong>
            <small>Learning Management</small>
          </div>
        </div>

        <p className="menu-label">MENU CHÍNH</p>

        <nav>
          {menu.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={
                  selectedMenu === index
                    ? "menu-item active"
                    : "menu-item"
                }
                onClick={() => setSelectedMenu(index)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

      </aside>

      {/* NOI DUNG CHINH */}
      <main className="main">

        {/* THANH TREN CUNG */}
        <header className="topbar">

          <div>
            <h2>Hệ thống quản lý tiến độ học tập</h2>
            <p>
              Phân tích và hỗ trợ điều chỉnh mục tiêu học tập
            </p>
          </div>

          {/* THONG TIN NGUOI DUNG VA DANG XUAT */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "#334155"
              }}
            >
              {user?.full_name || "Sinh viên"}
            </span>

            <div className="avatar">
              SV
            </div>

            <button
              type="button"
              onClick={onLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 13px",
                border: "none",
                borderRadius: "8px",
                background: "#fee2e2",
                color: "#b91c1c",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>

        </header>

        {/* CAC TRANG CHUC NANG */}

        {selectedMenu === 1 ? (

          // CHUC NANG 2: QUAN LY MUC TIEU
          <Targets token={token} />

        ) : selectedMenu === 2 ? (

          // CHUC NANG 3: PHAN TICH TIEN DO THEO THOI GIAN
          <ProgressAnalysis />

        ) : selectedMenu === 3 ? (

          // CHUC NANG 4: DU BAO LINEAR REGRESSION
          <Prediction />

        ) : selectedMenu === 4 ? (

          // CHUC NANG 5: CANH BAO VA DIEU CHINH LICH HOC
          <AlertsScheduling />

        ) : selectedMenu === 5 ? (

          // CHUC NANG 6: BAO CAO VA DANH GIA
          <Reports />

        ) : selectedMenu !== 0 ? (

          // CAC CHUC NANG CHUA XAY DUNG
          <section className="panel">
            <h2>{menu[selectedMenu].name}</h2>

            <p>
              Chức năng này sẽ được xây dựng
              ở bước tiếp theo.
            </p>
          </section>

        ) : (

          // CHUC NANG 1: DASHBOARD TONG QUAN
          <>
            {/* TIEU DE DASHBOARD */}
            <div className="page-heading">
              <div>
                <h1>Dashboard tổng quan</h1>
                <p>
                  Theo dõi kết quả và tiến độ học tập
                  của sinh viên
                </p>
              </div>
            </div>

            {/* TRANG THAI TAI DU LIEU */}
            {loading && (
              <p>Đang tải dữ liệu từ FastAPI...</p>
            )}

            {error && (
              <p className="error">
                Lỗi: {error}
              </p>
            )}

            {!loading && !error && (
              <>
                {/* CAC THE THONG KE */}
                <div className="stats-grid">

                  {cards.map((card) => {
                    const Icon = card.icon;

                    return (
                      <div
                        className="stat-card"
                        key={card.label}
                      >
                        <div className="stat-icon">
                          <Icon size={23} />
                        </div>

                        <p>{card.label}</p>
                        <h2>{card.value}</h2>
                      </div>
                    );
                  })}

                </div>

                {/* BIEU DO VA TINH TRANG MUC TIEU */}
                <div className="overview-grid">

                  {/* BIEU DO TIEN DO */}
                  <section className="panel">

                    <h3>
                      Tiến độ của 10 sinh viên đầu tiên
                    </h3>

                    <p>
                      Tiến độ hoàn thành trung bình (%)
                    </p>

                    <div className="chart-container">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >
                        <BarChart data={chartData}>

                          <CartesianGrid
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="name"
                            fontSize={12}
                          />

                          <YAxis domain={[0, 100]} />

                          <Tooltip />

                          <Bar
                            dataKey="progress"
                            name="Tiến độ"
                            fill="#3979e8"
                            radius={[5, 5, 0, 0]}
                          />

                        </BarChart>
                      </ResponsiveContainer>

                    </div>

                  </section>

                  {/* TINH TRANG MUC TIEU */}
                  <section className="panel">

                    <h3>Tình trạng mục tiêu</h3>

                    <p>
                      Tổng hợp dữ liệu toàn hệ thống
                    </p>

                    <div className="progress-summary">

                      <strong>
                        {completionRate.toFixed(2)}%
                      </strong>

                      <span>
                        Tỷ lệ mục tiêu hoàn thành
                      </span>

                    </div>

                    <div className="progress-track">
                      <div
                        style={{
                          width: `${completionRate}%`
                        }}
                      />
                    </div>

                    <div className="summary-row">
                      <span>Đã hoàn thành</span>
                      <b>{completed}</b>
                    </div>

                    <div className="summary-row">
                      <span>Chưa hoàn thành</span>
                      <b>{totalTargets - completed}</b>
                    </div>

                    <div className="summary-row">
                      <span>Mục tiêu quá hạn</span>
                      <b className="danger">{overdue}</b>
                    </div>

                  </section>

                </div>

                {/* BANG DANH SACH SINH VIEN */}
                <section className="panel">

                  <h3>Danh sách tiến độ sinh viên</h3>

                  <p>
                    Dữ liệu lấy từ API Dashboard
                  </p>

                  <div className="table-wrapper">

                    <table>

                      <thead>
                        <tr>
                          <th>Mã sinh viên</th>
                          <th>Số mục tiêu</th>
                          <th>Tiến độ TB</th>
                          <th>Hoàn thành</th>
                          <th>Quá hạn</th>
                          <th>Trạng thái lịch học</th>
                        </tr>
                      </thead>

                      <tbody>

                        {students.slice(0, 10).map((s) => (

                          <tr key={s.student_id}>

                            <td>
                              <b>{s.student_id}</b>
                            </td>

                            <td>{s.total_targets}</td>

                            <td>
                              {s.avg_progress_pct}%
                            </td>

                            <td>{s.completed_targets}</td>

                            <td>{s.overdue_targets}</td>

                            <td>{s.schedule_status}</td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                </section>

              </>
            )}
          </>

        )}

      </main>

    </div>
  );
}

export default Dashboard;
