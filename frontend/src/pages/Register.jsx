
import { useState } from "react";
import {
  GraduationCap,
  UserRound,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";
import "./Auth.css";

const API = ((import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://studyprogress.onrender.com") + "");

function Register({ onGoLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("Email này đã được đăng ký.");
        }
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Đăng ký không thành công."
        );
      }

      setSuccess("Đăng ký thành công! Bạn có thể đăng nhập.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Không thể kết nối Backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <GraduationCap size={34} />
          </div>

          <h1>StudyProgress</h1>
          <p>Hệ thống quản lý và dự báo tiến độ học tập</p>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <h2>Đăng ký tài khoản</h2>
            <p>Tạo tài khoản để bắt đầu quản lý việc học.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="register-name">Họ và tên</label>
            <div className="auth-input">
              <UserRound size={19} />
              <input
                id="register-name"
                type="text"
                placeholder="Nhập họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                minLength={2}
                required
              />
            </div>

            <label htmlFor="register-email">Email</label>
            <div className="auth-input">
              <Mail size={19} />
              <input
                id="register-email"
                type="email"
                placeholder="Nhập địa chỉ email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label htmlFor="register-password">Mật khẩu</label>
            <div className="auth-input">
              <LockKeyhole size={19} />
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Ít nhất 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Hiện hoặc ẩn mật khẩu"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <label htmlFor="register-confirm">
              Xác nhận mật khẩu
            </label>
            <div className="auth-input">
              <LockKeyhole size={19} />
              <input
                id="register-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {success && (
              <div className="auth-success">{success}</div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Đang đăng ký..." : "Đăng ký"}
            </button>
          </form>

          <div className="auth-footer">
            Đã có tài khoản?{" "}
            <button type="button" onClick={onGoLogin}>
              Đăng nhập ngay
            </button>
          </div>
        </div>

        <p className="auth-copyright">
          © 2026 StudyProgress
        </p>
      </div>
    </div>
  );
}

export default Register;
