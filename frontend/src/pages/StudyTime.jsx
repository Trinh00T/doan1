import { useCallback, useEffect, useState } from "react";
import { Clock3, Plus, RefreshCw, Pencil, Trash2, X, Save } from "lucide-react";

const API = "https://studyprogress.onrender.com";
const today = () => new Date().toLocaleDateString("en-CA");
const emptyForm = () => ({ study_date: today(), study_hours: "", description: "" });

export default function StudyTime({ token, targetId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadRecords = useCallback(async () => {
    if (!token || !targetId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/study-time?target_id=${encodeURIComponent(targetId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Không tải được lịch sử học tập.");
      if (!Array.isArray(data)) throw new Error("Dữ liệu thời gian học không hợp lệ.");
      setRecords(data);
    } catch (err) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setLoading(false);
    }
  }, [token, targetId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEdit(record) {
    setEditingId(record.time_id);
    setForm({
      study_date: record.study_date || today(),
      study_hours: String(record.study_hours ?? ""),
      description: record.description || "",
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!token || !targetId) return setError("Thiếu thông tin đăng nhập hoặc mục tiêu.");
    const hours = Number(form.study_hours);
    if (!form.study_date || !Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return setError("Vui lòng chọn ngày và nhập số giờ lớn hơn 0, không quá 24.");
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const isEditing = Boolean(editingId);
      const endpoint = isEditing
        ? `${API}/api/study-time/${encodeURIComponent(editingId)}`
        : `${API}/api/study-time`;
      const body = {
        study_date: form.study_date,
        study_hours: hours,
        description: form.description.trim(),
      };
      if (!isEditing) body.target_id = String(targetId);
      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        const detail = result.detail;
        throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item) => item.msg).join("; ") : "Không lưu được thời gian học.");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      await loadRecords();
      setNotice(isEditing ? "Cập nhật thời gian học thành công!" : "Ghi nhận thời gian học thành công!");
    } catch (err) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Bạn có chắc muốn xóa bản ghi ${record.study_date} (${record.study_hours} giờ)?`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/study-time/${encodeURIComponent(record.time_id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Không xóa được bản ghi.");
      await loadRecords();
      setNotice("Đã xóa bản ghi thời gian học.");
    } catch (err) {
      setError(err.message || "Đã xảy ra lỗi.");
    }
  }

  const totalHours = records.reduce((sum, record) => sum + (Number(record.study_hours) || 0), 0);
  const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box", fontSize: 14 };
  const buttonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600 };

  return (
    <section style={{ marginTop: 22, padding: 18, border: "1px solid #e2e8f0", borderRadius: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", color: "#20294c" }}><Clock3 size={21} /> Quản lý thời gian học tập</h3>
          <p style={{ margin: 0, color: "#64748b" }}>Mục tiêu {targetId} · Tổng thời gian đã ghi nhận: <strong>{totalHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} giờ</strong></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={loadRecords} disabled={loading} style={{ ...buttonStyle, background: "#fff", border: "1px solid #cbd5e1" }}><RefreshCw size={16} /> Làm mới</button>
          <button type="button" onClick={openCreate} disabled={!token || !targetId} style={{ ...buttonStyle, background: "#6336ff", color: "white", border: "none" }}><Plus size={16} /> Ghi nhận giờ học</button>
        </div>
      </div>

      {error && <p role="alert" style={{ padding: 10, borderRadius: 8, background: "#fee2e2", color: "#b91c1c" }}>{error}</p>}
      {notice && <p role="status" style={{ padding: 10, borderRadius: 8, background: "#dcfce7", color: "#166534" }}>{notice}</p>}

      {showForm && (
        <form onSubmit={handleSave} style={{ marginTop: 16, padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong>{editingId ? "Chỉnh sửa thời gian học" : "Ghi nhận thời gian học"}</strong>
            <button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Đóng biểu mẫu" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Ngày học *<input type="date" value={form.study_date} onChange={(e) => setForm({ ...form, study_date: e.target.value })} required style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>Số giờ học *<input type="number" min="0.1" max="24" step="0.1" value={form.study_hours} onChange={(e) => setForm({ ...form, study_hours: e.target.value })} placeholder="Ví dụ: 2" required style={inputStyle} /></label>
          </div>
          <label style={{ display: "grid", gap: 6, fontWeight: 600, marginTop: 12 }}>Nội dung học<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ví dụ: Học Python và làm bài tập" style={{ ...inputStyle, resize: "vertical" }} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setShowForm(false)} disabled={saving} style={{ ...buttonStyle, background: "white", border: "1px solid #cbd5e1" }}>Hủy</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle, background: "#6336ff", border: "none", color: "white" }}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      )}

      <div style={{ overflowX: "auto", marginTop: 18 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 14 }}>
          <thead style={{ background: "#f1f5f9", color: "#475569" }}>
            <tr>{["Ngày học", "Số giờ", "Nội dung", "Thao tác"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 12 }}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.time_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: 12 }}>{record.study_date}</td>
                <td style={{ padding: 12 }}>{record.study_hours} giờ</td>
                <td style={{ padding: 12, overflowWrap: "anywhere" }}>{record.description || "—"}</td>
                <td style={{ padding: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button type="button" onClick={() => openEdit(record)} style={{ ...buttonStyle, padding: "7px 9px", border: "1px solid #c4b5fd", color: "#6d28d9", background: "#faf5ff" }}><Pencil size={14} /> Sửa</button>
                    <button type="button" onClick={() => handleDelete(record)} style={{ ...buttonStyle, padding: "7px 9px", border: "1px solid #fecaca", color: "#b91c1c", background: "#fef2f2" }}><Trash2 size={14} /> Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && records.length === 0 && <p style={{ textAlign: "center", padding: 14, color: "#64748b" }}>Chưa có bản ghi thời gian học cho mục tiêu này.</p>}
        {loading && <p style={{ textAlign: "center", padding: 14 }}>Đang tải thời gian học...</p>}
      </div>
    </section>
  );
}
