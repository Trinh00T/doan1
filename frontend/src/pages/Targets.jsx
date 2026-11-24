
import { useEffect, useState } from "react";
import Tasks from "./Tasks";
import StudyTime from "./StudyTime";
import Resources from "./Resources";
import {
  Target,
  Search,
  RefreshCw,
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X
} from "lucide-react";

const API = ((import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://studyprogress.onrender.com") + "");

// Lay gia tri theo ten truong trong du lieu
function getValue(item, keys, fallback = "") {
  for (const key of keys) {
    if (
      item[key] !== undefined &&
      item[key] !== null &&
      item[key] !== ""
    ) {
      return item[key];
    }
  }
  return fallback;
}

// Lay tien do muc tieu
function getProgress(item) {
  const value = Number(
    getValue(
      item,
      [
        "target_completion_pct",
        "actual_progress_pct",
        "progress_pct",
        "progress"
      ],
      0
    )
  );

  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(100, value));
}

// Chuan hoa trang thai tieng Viet
function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();
}

// Xac dinh trang thai muc tieu
function getStatus(item) {
  const rawStatus = normalizeText(
    getValue(item, ["status", "target_status"], "")
  );

  // Uu tien trang thai co san trong du lieu
  if (
    rawStatus.includes("hoan thanh") ||
    rawStatus.includes("completed")
  ) {
    return "completed";
  }

  if (
    rawStatus.includes("qua han") ||
    rawStatus.includes("overdue")
  ) {
    return "overdue";
  }

  if (
    rawStatus.includes("dang thuc hien") ||
    rawStatus.includes("in_progress") ||
    rawStatus.includes("in progress")
  ) {
    return "in_progress";
  }

  // Neu khong co trang thai, xac dinh theo tien do
  const progress = getProgress(item);

  if (progress >= 100) {
    return "completed";
  }

  // Kiem tra han neu trang thai chua duoc xac dinh
  const deadline = getValue(
    item,
    ["deadline", "end_date", "target_date"],
    ""
  );

  if (deadline) {
    const date = new Date(deadline);

    if (!Number.isNaN(date.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date < today) {
        return "overdue";
      }
    }
  }

  return "in_progress";
}

// Hien thi ngay thang
function formatDate(value) {
  if (!value) return "Chưa có";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("vi-VN");
}

const statusLabels = {
  completed: "Hoàn thành",
  overdue: "Quá hạn",
  in_progress: "Đang thực hiện"
};

const statusColors = {
  completed: {
    background: "#dcfce7",
    color: "#15803d"
  },
  overdue: {
    background: "#fee2e2",
    color: "#b91c1c"
  },
  in_progress: {
    background: "#dbeafe",
    color: "#1d4ed8"
  }
};

function Targets({ token }) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editForm, setEditForm] = useState({
    target_name: "", target_description: "", start_date: "", deadline: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    student_id: "",
    subject_id: "",
    target_name: "",
    target_description: "",
    start_date: "",
    deadline: ""
  });

  function changeField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function createTarget(event) {
    event.preventDefault();
    setSaveError("");
    setSuccessMessage("");

    if (!token) {
      setSaveError("Không có phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }
    if (form.deadline < form.start_date) {
      setSaveError("Hạn hoàn thành không được trước ngày bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API}/api/targets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: form.student_id.trim(),
          subject_id: form.subject_id.trim(),
          target_name: form.target_name.trim(),
          target_description: form.target_description.trim(),
          start_date: form.start_date,
          deadline: form.deadline
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result.detail;
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join("; ")
          : typeof detail === "string" ? detail : "Không thể thêm mục tiêu.";
        throw new Error(message);
      }

      // Chi cap nhat giao dien sau khi Backend xac nhan da luu.
      setShowCreate(false);
      setForm({
        student_id: "", subject_id: "", target_name: "",
        target_description: "", start_date: "", deadline: ""
      });
      setSearch("");
      setStatusFilter("all");
      setSuccessMessage(`Đã thêm mục tiêu ${result.target?.target_id || "mới"} thành công.`);
      await loadTargets();
    } catch (err) {
      setSaveError(err.message || "Không thể kết nối Backend.");
    } finally {
      setSaving(false);
    }
  }

  // Mo bieu mau chinh sua voi du lieu hien tai
  function openEdit(item) {
    setSelectedTarget(null);
    setShowCreate(false);
    setSaveError("");
    setEditingTarget(item);
    setEditForm({
      target_name: String(getValue(item, ["target_name", "title", "name"], "")),
      target_description: String(getValue(item, ["target_description", "description"], "")),
      start_date: String(getValue(item, ["start_date"], "")).slice(0, 10),
      deadline: String(getValue(item, ["deadline", "end_date", "target_date"], "")).slice(0, 10)
    });
  }

  function changeEditField(event) {
    const { name, value } = event.target;
    setEditForm((previous) => ({ ...previous, [name]: value }));
  }

  async function updateTarget(event) {
    event.preventDefault();
    setSaveError("");
    setSuccessMessage("");
    if (!editingTarget) return;
    if (!token) {
      setSaveError("Không có phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }
    if (editForm.target_name.trim().length < 3) {
      setSaveError("Tên mục tiêu phải có ít nhất 3 ký tự.");
      return;
    }
    if (!editForm.start_date || !editForm.deadline || editForm.deadline < editForm.start_date) {
      setSaveError("Hạn hoàn thành không được trước ngày bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      const targetId = getValue(editingTarget, ["target_id", "id"]);
      const response = await fetch(`${API}/api/targets/${encodeURIComponent(targetId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_name: editForm.target_name.trim(),
          target_description: editForm.target_description.trim(),
          start_date: editForm.start_date,
          deadline: editForm.deadline
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result.detail;
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join("; ")
          : typeof detail === "string" ? detail : "Không thể chỉnh sửa mục tiêu.";
        throw new Error(message);
      }
      // Cap nhat ngay bang, sau do dong bo lai tu Backend.
      setTargets((previous) => previous.map((item) =>
        String(getValue(item, ["target_id", "id"])) === String(targetId)
          ? { ...item, ...result.target }
          : item
      ));
      setEditingTarget(null);
      setSuccessMessage(`Đã cập nhật mục tiêu ${targetId} thành công.`);
      await loadTargets();
    } catch (err) {
      setSaveError(err.message || "Không thể kết nối Backend.");
    } finally {
      setSaving(false);
    }
  }

  // Mo hop thoai xac nhan xoa (chi muc tieu tao them)
  function openDelete(item) {
    const id = String(getValue(item, ["target_id", "id"], ""));
    const match = /^TG(\d+)$/.exec(id);
    if (!match || Number(match[1]) <= 300) return;
    setSelectedTarget(null);
    setEditingTarget(null);
    setShowCreate(false);
    setDeleteError("");
    setSuccessMessage("");
    setDeletingTarget(item);
  }

  // Chi gui yeu cau DELETE sau khi nguoi dung xac nhan
  async function deleteTarget() {
    if (!deletingTarget || deleting) return;
    setDeleteError("");
    if (!token) {
      setDeleteError("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    const targetId = String(getValue(deletingTarget, ["target_id", "id"], ""));
    const match = /^TG(\d+)$/.exec(targetId);
    if (!match || Number(match[1]) <= 300) {
      setDeleteError("Không được xóa mục tiêu dữ liệu mẫu.");
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`${API}/api/targets/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result.detail;
        const message = Array.isArray(detail)
          ? detail.map((item) => item.msg).join("; ")
          : typeof detail === "string" ? detail : "Không thể xóa mục tiêu.";
        throw new Error(message);
      }
      setTargets((previous) => previous.filter(
        (item) => String(getValue(item, ["target_id", "id"])) !== targetId
      ));
      setDeletingTarget(null);
      setSuccessMessage(`Đã xóa mục tiêu ${targetId} thành công.`);
      await loadTargets();
    } catch (err) {
      setDeleteError(err.message || "Không thể kết nối Backend.");
    } finally {
      setDeleting(false);
    }
  }

  // Lay danh sach muc tieu tu FastAPI
  async function loadTargets() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/targets`);

      if (!response.ok) {
        throw new Error("Không tải được danh sách mục tiêu");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Dữ liệu mục tiêu không hợp lệ");
      }

      setTargets(data);
    } catch (err) {
      setError(err.message || "Không thể kết nối Backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTargets();
  }, []);

  // Tim kiem va loc muc tieu
  const filteredTargets = targets.filter((item) => {
    const keyword = normalizeText(search);

    const searchableText = normalizeText(
      [
        getValue(item, ["target_id", "id"]),
        getValue(item, ["student_id"]),
        getValue(item, ["target_name", "title", "name"]),
        getValue(item, ["subject_name", "subject_id"])
      ].join(" ")
    );

    const matchSearch = searchableText.includes(keyword);

    const matchStatus =
      statusFilter === "all" ||
      getStatus(item) === statusFilter;

    return matchSearch && matchStatus;
  });

  // Thong ke trang thai
  const completed = targets.filter(
    (item) => getStatus(item) === "completed"
  ).length;

  const overdue = targets.filter(
    (item) => getStatus(item) === "overdue"
  ).length;

  const inProgress = targets.filter(
    (item) => getStatus(item) === "in_progress"
  ).length;

  // Cac the thong ke
  const cards = [
    {
      label: "Tổng mục tiêu",
      value: targets.length,
      icon: Target
    },
    {
      label: "Đang thực hiện",
      value: inProgress,
      icon: Clock3
    },
    {
      label: "Hoàn thành",
      value: completed,
      icon: CheckCircle2
    },
    {
      label: "Quá hạn",
      value: overdue,
      icon: AlertTriangle
    }
  ];

  return (
    <div>
      {/* TIEU DE */}
      <div className="page-heading">
        <div>
          <h1>Quản lý mục tiêu học tập</h1>
          <p>
            Theo dõi danh sách và tiến độ thực hiện
            các mục tiêu học tập
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSaveError(""); setShowCreate(true); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 16px", background: "#2563eb", color: "white",
            border: 0, borderRadius: 9, cursor: "pointer", fontWeight: 600 }}
        >
          <Plus size={18} /> Thêm mục tiêu
        </button>
      </div>

      {successMessage && (
        <p role="status" style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 8 }}>
          {successMessage}
        </p>
      )}

      {/* CAC THE THONG KE */}
      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.label}>
              <div className="stat-icon">
                <Icon size={23} />
              </div>

              <p>{card.label}</p>

              <h2>
                {loading ? "..." : card.value}
              </h2>
            </div>
          );
        })}
      </div>

      {/* DANH SACH MUC TIEU */}
      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "20px"
          }}
        >
          <div>
            <h3>Danh sách mục tiêu</h3>
            <p>
              Hiển thị {filteredTargets.length} mục tiêu
            </p>
          </div>

          <button
            type="button"
            onClick={loadTargets}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 15px",
              background: "#eff6ff",
              color: "#2563eb",
              border: "1px solid #bfdbfe",
              borderRadius: "9px",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            <RefreshCw size={17} />
            Làm mới
          </button>
        </div>

        {/* TIM KIEM VA LOC */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "20px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "10px 13px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              flex: "1 1 250px"
            }}
          >
            <Search size={18} color="#64748b" />

            <input
              type="text"
              placeholder="Tìm mã mục tiêu, sinh viên, tên mục tiêu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                width: "100%",
                background: "transparent"
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "10px 13px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              background: "#fff"
            }}
          >
            <option value="all">
              Tất cả trạng thái
            </option>

            <option value="in_progress">
              Đang thực hiện
            </option>

            <option value="completed">
              Hoàn thành
            </option>

            <option value="overdue">
              Quá hạn
            </option>
          </select>
        </div>

        {/* TRANG THAI TAI DU LIEU */}
        {loading && (
          <p>Đang tải danh sách mục tiêu...</p>
        )}

        {error && (
          <p className="error">
            Lỗi: {error}
          </p>
        )}

        {/* BANG MUC TIEU */}
        {!loading && !error && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mã mục tiêu</th>
                  <th>Sinh viên</th>
                  <th>Tên mục tiêu</th>
                  <th>Môn học</th>
                  <th>Hạn hoàn thành</th>
                  <th>Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredTargets.map((item, index) => {
                  const progress = getProgress(item);
                  const status = getStatus(item);
                  const targetId = String(getValue(item, ["target_id", "id"], ""));
                  const match = /^TG(\d+)$/.exec(targetId);
                  const canDelete = Boolean(match && Number(match[1]) > 300);

                  return (
                    <tr
                      key={
                        getValue(item, ["target_id", "id"]) ||
                        index
                      }
                    >
                      {/* MA MUC TIEU */}
                      <td>
                        <b>
                          {getValue(
                            item,
                            ["target_id", "id"],
                            "—"
                          )}
                        </b>
                      </td>

                      {/* SINH VIEN */}
                      <td>
                        {getValue(
                          item,
                          ["student_id"],
                          "—"
                        )}
                      </td>

                      {/* TEN MUC TIEU */}
                      <td>
                        {getValue(
                          item,
                          ["target_name", "title", "name"],
                          "—"
                        )}
                      </td>

                      {/* MON HOC */}
                      <td>
                        {getValue(
                          item,
                          ["subject_name", "subject_id"],
                          "—"
                        )}
                      </td>

                      {/* HAN HOAN THANH */}
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <CalendarDays size={15} />

                          {formatDate(
                            getValue(
                              item,
                              [
                                "deadline",
                                "end_date",
                                "target_date"
                              ]
                            )
                          )}
                        </span>
                      </td>

                      {/* TIEN DO */}
                      <td>
                        <div style={{ minWidth: "110px" }}>
                          <b>
                            {progress.toFixed(2)}%
                          </b>

                          <div
                            style={{
                              height: "7px",
                              marginTop: "7px",
                              background: "#e2e8f0",
                              borderRadius: "20px",
                              overflow: "hidden"
                            }}
                          >
                            <div
                              style={{
                                width: `${progress}%`,
                                height: "100%",
                                background:
                                  progress >= 100
                                    ? "#16a34a"
                                    : "#3979e8",
                                borderRadius: "20px"
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* TRANG THAI */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "6px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            ...statusColors[status]
                          }}
                        >
                          {statusLabels[status]}
                        </span>
                      </td>

                      {/* XEM CHI TIET, CHINH SUA VA XOA */}
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTarget(item)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 11px",
                            border: "1px solid #bfdbfe",
                            borderRadius: 8,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                        >
                          <Eye size={16} /> Xem chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "8px 11px", border: "1px solid #c4b5fd",
                            borderRadius: 8, background: "#f5f3ff", color: "#6d28d9",
                            fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          <Pencil size={16} /> Chỉnh sửa
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => openDelete(item)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "8px 11px", border: "1px solid #fecaca",
                              borderRadius: 8, background: "#fef2f2", color: "#b91c1c",
                              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
                            }}
                          >
                            <Trash2 size={16} /> Xóa
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredTargets.length === 0 && (
              <p
                style={{
                  padding: "20px",
                  textAlign: "center"
                }}
              >
                Không tìm thấy mục tiêu phù hợp.
              </p>
            )}
          </div>
        )}
      </section>

      {/* XAC NHAN XOA MUC TIEU */}
      {deletingTarget && (
        <div role="presentation" style={{
          position: "fixed", inset: 0, zIndex: 1300,
          background: "rgba(15, 23, 42, 0.55)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-target-title"
            aria-describedby="delete-target-description"
            style={{ width: "100%", maxWidth: 480, background: "white",
              borderRadius: 14, padding: 24, boxShadow: "0 20px 50px #0002" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h2 id="delete-target-title" style={{ margin: 0, fontSize: 21 }}>
                Xác nhận xóa mục tiêu
              </h2>
            </div>
            <p id="delete-target-description" style={{ lineHeight: 1.6 }}>
              Bạn có chắc chắn muốn xóa mục tiêu
              {" "}<strong>{getValue(deletingTarget, ["target_id", "id"])}</strong>
              {" – "}<strong>{getValue(deletingTarget, ["target_name", "title", "name"])}</strong>?
              Thao tác này sẽ xóa mục tiêu khỏi danh sách và không thể hoàn tác.
            </p>
            {deleteError && <p role="alert" style={{ color: "#b91c1c" }}>{deleteError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" disabled={deleting}
                onClick={() => setDeletingTarget(null)}
                style={{ padding: "10px 16px", border: "1px solid #cbd5e1",
                  borderRadius: 8, background: "white", cursor: "pointer" }}>
                Hủy
              </button>
              <button type="button" disabled={deleting} onClick={deleteTarget}
                style={{ padding: "10px 16px", border: 0, borderRadius: 8,
                  background: "#dc2626", color: "white", cursor: deleting ? "wait" : "pointer" }}>
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUA SO XEM CHI TIET MUC TIEU */}
      {selectedTarget && (
        <div
          role="presentation"
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="target-detail-title"
            style={{
              width: "100%", maxWidth: 600, maxHeight: "90vh",
              overflowY: "auto", background: "#fff", borderRadius: 14,
              padding: 24, boxShadow: "0 20px 50px #0002"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 id="target-detail-title" style={{ margin: 0, fontSize: 22 }}>
                Chi tiết mục tiêu học tập
              </h2>
              <button
                type="button"
                aria-label="Đóng chi tiết mục tiêu"
                onClick={() => setSelectedTarget(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer", padding: 6 }}
              >
                <X size={22} />
              </button>
            </div>

            <h3 style={{ color: "#1d4ed8", margin: "18px 0" }}>
              {getValue(selectedTarget, ["target_name", "title", "name"], "Chưa có tên")}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                ["Mã mục tiêu", getValue(selectedTarget, ["target_id", "id"], "—")],
                ["Mã sinh viên", getValue(selectedTarget, ["student_id"], "—")],
                ["Môn học", getValue(selectedTarget, ["subject_name", "subject_id"], "—")],
                ["Ngày bắt đầu", formatDate(getValue(selectedTarget, ["start_date"]))],
                ["Hạn hoàn thành", formatDate(getValue(selectedTarget, ["deadline", "end_date", "target_date"]))]
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 5 }}>{label}</div>
                  <strong style={{ overflowWrap: "anywhere" }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Mô tả mục tiêu</div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {getValue(selectedTarget, ["target_description", "description"], "Chưa có mô tả")}
              </p>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>Tiến độ thực hiện</strong>
                <strong>{getProgress(selectedTarget).toFixed(2)}%</strong>
              </div>
              <div style={{ height: 9, borderRadius: 20, background: "#e2e8f0", overflow: "hidden" }}>
                <div style={{
                  width: `${getProgress(selectedTarget)}%`, height: "100%",
                  borderRadius: 20,
                  background: getProgress(selectedTarget) >= 100 ? "#16a34a" : "#3979e8"
                }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <strong>Trạng thái</strong>
              <span style={{ padding: "6px 12px", borderRadius: 20, fontWeight: 600, ...statusColors[getStatus(selectedTarget)] }}>
                {statusLabels[getStatus(selectedTarget)]}
              </span>
            </div>

            {/* Nhiem vu thuoc muc tieu dang xem */}
            <div style={{ marginTop: 24 }}>
              <Tasks
                token={token}
                targetId={String(getValue(selectedTarget, ["target_id", "id"], ""))}
              />
              <StudyTime
                token={token}
                targetId={String(getValue(selectedTarget, ["target_id", "id"], ""))}
              />
              <Resources
                token={token}
                targetId={String(getValue(selectedTarget, ["target_id", "id"], ""))}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setSelectedTarget(null)}
                style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", cursor: "pointer" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUA SO CHINH SUA MUC TIEU */}
      {editingTarget && (
        <div role="presentation" style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(15, 23, 42, 0.55)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 16
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-target-title"
            style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
              background: "#fff", borderRadius: 14, padding: 24,
              boxShadow: "0 20px 50px #0002" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h2 id="edit-target-title" style={{ margin: 0, fontSize: 22 }}>Chỉnh sửa mục tiêu học tập</h2>
              <button type="button" aria-label="Đóng chỉnh sửa" disabled={saving}
                onClick={() => setEditingTarget(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer" }}>
                <X size={22} />
              </button>
            </div>
            <p style={{ marginTop: 0, color: "#64748b" }}>
              Mã mục tiêu: <strong>{getValue(editingTarget, ["target_id", "id"])}</strong>
            </p>
            <form onSubmit={updateTarget} style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Tên mục tiêu *
                <input name="target_name" value={editForm.target_name}
                  onChange={changeEditField} required minLength={3}
                  style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 400 }} />
              </label>
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Mô tả mục tiêu
                <textarea name="target_description" value={editForm.target_description}
                  onChange={changeEditField} rows={3}
                  style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 400 }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                  Ngày bắt đầu *
                  <input type="date" name="start_date" value={editForm.start_date}
                    onChange={changeEditField} required
                    style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8 }} />
                </label>
                <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                  Hạn hoàn thành *
                  <input type="date" name="deadline" value={editForm.deadline}
                    onChange={changeEditField} min={editForm.start_date || undefined} required
                    style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8 }} />
                </label>
              </div>
              {saveError && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{saveError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" disabled={saving} onClick={() => setEditingTarget(null)}
                  style={{ padding: "10px 16px", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }}>
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: "10px 16px", border: 0, borderRadius: 8,
                    background: "#6d28d9", color: "#fff", cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          role="presentation"
          style={{ position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)", display: "flex",
            justifyContent: "center", alignItems: "center", padding: 16 }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="create-target-title"
            style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
              background: "white", borderRadius: 14, padding: 24, boxShadow: "0 20px 50px #0002" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 id="create-target-title" style={{ margin: 0, fontSize: 22 }}>Thêm mục tiêu học tập</h2>
              <button type="button" aria-label="Đóng" disabled={saving}
                onClick={() => setShowCreate(false)}
                style={{ border: 0, background: "transparent", cursor: "pointer" }}>
                <X size={22} />
              </button>
            </div>
            <form onSubmit={createTarget} style={{ display: "grid", gap: 14 }}>
              {[
                { name: "student_id", label: "Mã sinh viên", placeholder: "VD: SV0001" },
                { name: "subject_id", label: "Mã môn học", placeholder: "VD: MH0001" },
                { name: "target_name", label: "Tên mục tiêu", placeholder: "VD: Đạt điểm 9.0 môn Máy học", minLength: 3 }
              ].map((field) => (
                <label key={field.name} style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                  {field.label} <span style={{ color: "#dc2626" }}>*</span>
                  <input name={field.name} value={form[field.name]} onChange={changeField}
                    placeholder={field.placeholder} required minLength={field.minLength || 1}
                    style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 400 }} />
                </label>
              ))}
              <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                Mô tả mục tiêu
                <textarea name="target_description" value={form.target_description} onChange={changeField}
                  rows={3} placeholder="Nhập mô tả mục tiêu..."
                  style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 400 }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                  Ngày bắt đầu *
                  <input type="date" name="start_date" value={form.start_date} onChange={changeField}
                    required style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8 }} />
                </label>
                <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
                  Hạn hoàn thành *
                  <input type="date" name="deadline" value={form.deadline} onChange={changeField}
                    min={form.start_date || undefined} required
                    style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8 }} />
                </label>
              </div>
              {saveError && <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>{saveError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" disabled={saving} onClick={() => setShowCreate(false)}
                  style={{ padding: "10px 16px", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }}>
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: "10px 16px", border: 0, borderRadius: 8,
                    background: "#2563eb", color: "white", cursor: saving ? "wait" : "pointer" }}>
                  {saving ? "Đang lưu..." : "Lưu mục tiêu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Targets;
