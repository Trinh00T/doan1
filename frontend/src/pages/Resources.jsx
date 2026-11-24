
import { useEffect, useState } from "react";

const API_URL = ((import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://studyprogress.onrender.com") + "/api/resources");

const emptyForm = {
  resource_name: "",
  resource_type: "PDF",
  resource_url: "",
  description: "",
};

export default function Resources({ token, targetId }) {
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadResources() {
    if (!token || !targetId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}?target_id=${encodeURIComponent(targetId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Không thể tải danh sách tài liệu");
      }

      const data = await response.json();
      setResources(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResources();
  }, [token, targetId]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
  }

  function openEditForm(resource) {
    setEditingId(resource.resource_id);

    setForm({
      resource_name: resource.resource_name || "",
      resource_type: resource.resource_type || "PDF",
      resource_url: resource.resource_url || "",
      description: resource.description || "",
    });

    setShowForm(true);
    setError("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.resource_name.trim()) {
      setError("Vui lòng nhập tên tài liệu");
      return;
    }

    setSaving(true);
    setError("");

    const url = editingId
      ? `${API_URL}/${editingId}`
      : API_URL;

    const method = editingId ? "PUT" : "POST";

    const body = editingId
      ? form
      : { ...form, target_id: targetId };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Không thể lưu tài liệu"
        );
      }

      cancelForm();
      await loadResources();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resourceId) {
    if (!window.confirm("Bạn có chắc muốn xóa tài liệu này?")) {
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/${resourceId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Không thể xóa tài liệu");
      }

      await loadResources();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Quản lý nguồn lực học tập</h3>

      <p style={{ color: "#64748b" }}>
        Mục tiêu {targetId} · Tổng số tài liệu: {resources.length}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={loadResources}>
          Làm mới
        </button>

        <button type="button" onClick={openCreateForm}>
          + Thêm tài liệu
        </button>
      </div>

      {error && (
        <p style={{ color: "#dc2626" }}>{error}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            border: "1px solid #e2e8f0",
            padding: 16,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h4>
            {editingId ? "Chỉnh sửa tài liệu" : "Thêm tài liệu học tập"}
          </h4>

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Tên tài liệu
              <input
                required
                minLength={2}
                style={{ width: "100%", padding: 10 }}
                value={form.resource_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resource_name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Loại tài liệu
              <select
                style={{ width: "100%", padding: 10 }}
                value={form.resource_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resource_type: e.target.value,
                  })
                }
              >
                <option value="PDF">PDF</option>
                <option value="Video">Video</option>
                <option value="Website">Website</option>
                <option value="Sách">Sách</option>
                <option value="Khác">Khác</option>
              </select>
            </label>

            <label>
              Đường dẫn tài liệu
              <input
                type="url"
                placeholder="https://..."
                style={{ width: "100%", padding: 10 }}
                value={form.resource_url}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resource_url: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Mô tả
              <textarea
                rows={3}
                style={{ width: "100%", padding: 10 }}
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="button" onClick={cancelForm}>
              Hủy
            </button>

            <button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Đang tải tài liệu...</p>
      ) : resources.length === 0 ? (
        <p>Chưa có tài liệu học tập nào.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 10 }}>Tên tài liệu</th>
                <th style={{ padding: 10 }}>Loại</th>
                <th style={{ padding: 10 }}>Đường dẫn</th>
                <th style={{ padding: 10 }}>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {resources.map((resource) => (
                <tr key={resource.resource_id}>
                  <td style={{ padding: 10 }}>
                    <strong>{resource.resource_name}</strong>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {resource.description}
                    </div>
                  </td>

                  <td style={{ padding: 10 }}>
                    {resource.resource_type}
                  </td>

                  <td style={{ padding: 10 }}>
                    {resource.resource_url ? (
                      <a
                        href={resource.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Mở tài liệu
                      </a>
                    ) : (
                      "Không có"
                    )}
                  </td>

                  <td style={{ padding: 10 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditForm(resource)}
                      >
                        Sửa
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(resource.resource_id)
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
