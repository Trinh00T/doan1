import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ListTodo, Search, Plus, X, Save, Pencil, Trash2 } from "lucide-react";

const API = "https://studyprogress.onrender.com";
const emptyForm = { task_name: "", task_description: "", deadline: "", priority: "Trung binh", status: "Chua bat dau" };
const priorities = { Thap: "Thấp", "Trung binh": "Trung bình", Cao: "Cao" };
const statuses = { "Chua bat dau": "Chưa bắt đầu", "Dang thuc hien": "Đang thực hiện", "Hoan thanh": "Hoàn thành" };

function Tasks({ token, targetId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!token) throw new Error("Vui lòng đăng nhập lại.");
      const response = await fetch(`${API}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Không tải được danh sách nhiệm vụ.");
      if (!Array.isArray(result)) throw new Error("Dữ liệu nhiệm vụ không hợp lệ.");
      setTasks(result);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadTasks(); }, [loadTasks, targetId]);

  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box", fontSize: 14 };
  const buttonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 };
  const labelStyle = { display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 };

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function openEdit(task) {
    setEditingId(task.task_id);
    setForm({
      task_name: task.task_name || "",
      task_description: task.task_description || "",
      deadline: task.deadline || "",
      priority: task.priority || "Trung binh",
      status: task.status || "Chua bat dau",
    });
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function changeForm(event) {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
  }

  async function saveTask(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) return setError("Vui lòng đăng nhập lại.");
    if (!editingId && !targetId) return setError("Chưa chọn mục tiêu học tập.");
    if (form.task_name.trim().length < 3) return setError("Tên nhiệm vụ phải có ít nhất 3 ký tự.");
    if (!form.deadline) return setError("Vui lòng chọn hạn hoàn thành.");

    setSaving(true);
    try {
      const isEditing = Boolean(editingId);
      const payload = {
        task_name: form.task_name.trim(),
        task_description: form.task_description.trim(),
        deadline: form.deadline,
        priority: form.priority,
        ...(isEditing ? { status: form.status } : { target_id: String(targetId) }),
      };
      const response = await fetch(
        isEditing ? `${API}/api/tasks/${encodeURIComponent(editingId)}` : `${API}/api/tasks`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        const detail = result.detail;
        throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join("; ") : "Không thể lưu nhiệm vụ.");
      }
      setFormOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      setSearch("");
      await loadTasks();
      setMessage(isEditing ? "Cập nhật nhiệm vụ thành công!" : "Thêm nhiệm vụ học tập thành công!");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTask || deleting) return;
    setError("");
    setMessage("");
    setDeleting(true);
    try {
      if (!token) throw new Error("Vui lòng đăng nhập lại.");
      const response = await fetch(`${API}/api/tasks/${encodeURIComponent(deleteTask.task_id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Không thể xóa nhiệm vụ.");
      setDeleteTask(null);
      await loadTasks();
      setMessage("Xóa nhiệm vụ thành công!");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setDeleting(false);
    }
  }

  const filteredTasks = tasks.filter(task =>
    (!targetId || String(task.target_id) === String(targetId)) &&
    JSON.stringify(task).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="panel" style={{ marginTop: 20, padding: 16, border: "1px solid #e2e8f0", borderRadius: 14, background: "white", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}><ListTodo size={20} />Quản lý nhiệm vụ học tập</h3>
          <p style={{ margin: 0 }}>{targetId ? `Nhiệm vụ thuộc mục tiêu ${targetId}` : "Danh sách nhiệm vụ học tập"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={loadTasks} disabled={loading} style={{ ...buttonStyle, background: "white", border: "1px solid #cbd5e1" }}><RefreshCw size={16} />Làm mới</button>
          <button type="button" onClick={openCreate} disabled={!targetId} style={{ ...buttonStyle, background: "#6336ff", color: "white", border: "none" }}><Plus size={16} />Thêm nhiệm vụ</button>
        </div>
      </div>

      {message && <p role="status" style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 8 }}>{message}</p>}
      {error && <p role="alert" style={{ padding: 10, background: "#fee2e2", color: "#b91c1c", borderRadius: 8 }}>{error}</p>}

      {formOpen && (
        <form onSubmit={saveTask} style={{ marginTop: 18, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0 }}>{editingId ? "Chỉnh sửa nhiệm vụ" : "Thêm nhiệm vụ học tập"}</h4>
            <button type="button" aria-label="Đóng biểu mẫu" onClick={() => !saving && setFormOpen(false)} disabled={saving} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={20} /></button>
          </div>
          <div style={{ marginBottom: 14 }}><label style={labelStyle}>Mã mục tiêu</label><input value={targetId || ""} disabled style={{ ...inputStyle, background: "#e2e8f0" }} /></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="task-name" style={labelStyle}>Tên nhiệm vụ *</label><input id="task-name" name="task_name" value={form.task_name} onChange={changeForm} minLength={3} required placeholder="Ví dụ: Hoàn thành chương 1 báo cáo" style={inputStyle} /></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="task-description" style={labelStyle}>Mô tả nhiệm vụ</label><textarea id="task-description" name="task_description" value={form.task_description} onChange={changeForm} rows={3} placeholder="Nhập nội dung cần thực hiện..." style={{ ...inputStyle, resize: "vertical" }} /></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="task-deadline" style={labelStyle}>Hạn hoàn thành *</label><input id="task-deadline" type="date" name="deadline" value={form.deadline} onChange={changeForm} required style={inputStyle} /></div>
          <div style={{ marginBottom: 14 }}><label htmlFor="task-priority" style={labelStyle}>Mức ưu tiên</label><select id="task-priority" name="priority" value={form.priority} onChange={changeForm} style={inputStyle}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          {editingId && <div style={{ marginBottom: 14 }}><label htmlFor="task-status" style={labelStyle}>Trạng thái</label><select id="task-status" name="status" value={form.status} onChange={changeForm} style={inputStyle}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={saving} onClick={() => setFormOpen(false)} style={{ ...buttonStyle, border: "1px solid #cbd5e1", background: "white" }}>Hủy</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle, border: "none", background: "#6336ff", color: "white" }}><Save size={16} />{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Lưu nhiệm vụ"}</button>
          </div>
        </form>
      )}

      <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} style={{ flexShrink: 0 }} />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm kiếm nhiệm vụ..." style={{ ...inputStyle, maxWidth: 350 }} />
      </div>

      {loading && <p>Đang tải nhiệm vụ...</p>}
      {!loading && !error && (
        <div className="table-wrapper" style={{ overflowX: "auto", maxWidth: "100%" }}>
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
            <thead><tr><th>Mã nhiệm vụ</th><th>Mục tiêu</th><th>Tên nhiệm vụ</th><th>Hạn hoàn thành</th><th>Ưu tiên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{filteredTasks.map(task => (
              <tr key={task.task_id}>
                <td>{task.task_id}</td><td>{task.target_id}</td><td>{task.task_name || "—"}</td><td>{task.deadline || "—"}</td>
                <td>{priorities[task.priority] || task.priority || "—"}</td><td>{statuses[task.status] || task.status || "—"}</td>
                <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => openEdit(task)} style={{ ...buttonStyle, padding: "7px 9px", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #c4b5fd" }}><Pencil size={14} />Sửa</button>
                  <button type="button" onClick={() => setDeleteTask(task)} style={{ ...buttonStyle, padding: "7px 9px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}><Trash2 size={14} />Xóa</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          {filteredTasks.length === 0 && <p style={{ padding: 15, textAlign: "center" }}>Chưa có nhiệm vụ phù hợp.</p>}
        </div>
      )}

      {deleteTask && (
        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16, zIndex: 9999 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-task" style={{ background: "white", borderRadius: 14, padding: 24, width: "100%", maxWidth: 430, boxShadow: "0 16px 50px rgba(0,0,0,.2)" }}>
            <h3 id="confirm-delete-task" style={{ marginTop: 0 }}>Xác nhận xóa nhiệm vụ</h3>
            <p>Bạn có chắc muốn xóa nhiệm vụ <strong>{deleteTask.task_name}</strong> ({deleteTask.task_id}) không?</p>
            <p style={{ color: "#64748b", fontSize: 14 }}>Thao tác này sẽ xóa nhiệm vụ khỏi dữ liệu đã lưu.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" disabled={deleting} onClick={() => setDeleteTask(null)} style={{ ...buttonStyle, background: "white", border: "1px solid #cbd5e1" }}>Hủy</button>
              <button type="button" disabled={deleting} onClick={confirmDelete} style={{ ...buttonStyle, background: "#dc2626", color: "white", border: "none" }}><Trash2 size={16} />{deleting ? "Đang xóa..." : "Xác nhận xóa"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Tasks;
