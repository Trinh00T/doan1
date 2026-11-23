import { useState } from "react";
import {
  Mail, LockKeyhole, GraduationCap, Eye, EyeOff, LogIn,
  UsersRound, BookOpen, ChartNoAxesCombined, CalendarCheck2,
  Target, ArrowUpRight, Clock3, Sparkles
} from "lucide-react";
import "./Auth.css";

const API = "http://127.0.0.1:8000";

function Login({ onLogin, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Đăng nhập thất bại");
      }
      onLogin(data);
    } catch (err) {
      setError(err.message || "Không thể kết nối Backend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-login-page">
      <div className="login-background-orb login-orb-one" aria-hidden="true" />
      <div className="login-background-orb login-orb-two" aria-hidden="true" />
      <div className="login-dot-pattern login-dots-top" aria-hidden="true" />
      <div className="login-dot-pattern login-dots-bottom" aria-hidden="true" />
      <div className="login-top-wave" aria-hidden="true" />

      <div className="login-shell">
        <header className="login-header">
          <div className="login-brand-lockup">
            <div className="login-brand-mark" aria-hidden="true">
              <GraduationCap className="login-mark-cap" size={47} strokeWidth={1.8} />
              <BookOpen className="login-mark-book" size={48} strokeWidth={1.9} />
              <ChartNoAxesCombined className="login-mark-chart" size={27} strokeWidth={2.3} />
            </div>
            <div>
              <div className="login-brand-name">Study<span>Progress</span></div>
              <div className="login-brand-tagline">Học tập thông minh&nbsp; · &nbsp;Tiến bộ bền vững</div>
            </div>
          </div>
          <div className="login-header-quote">Cùng bạn chinh phục mục tiêu học tập <Sparkles size={20} /></div>
        </header>

        <main className="login-main">
          <section className="auth-card login-glass-card" aria-label="Đăng nhập StudyProgress">
            <div className="login-card-heading">
              <div className="login-heading-icon"><UsersRound size={39} fill="currentColor" strokeWidth={1.2} /></div>
              <div>
                <h1>Đăng nhập</h1>
                <p>Chào mừng bạn quay trở lại!</p>
              </div>
            </div>
            <div className="login-heading-divider" />

            <form onSubmit={handleSubmit}>
              <label htmlFor="study-login-email"><Mail size={21} /> Email</label>
              <div className="auth-input">
                <Mail size={21} aria-hidden="true" />
                <input id="study-login-email" type="email" autoComplete="email" placeholder="Nhập địa chỉ email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <label htmlFor="study-login-password"><LockKeyhole size={21} /> Mật khẩu</label>
              <div className="auth-input">
                <LockKeyhole size={21} aria-hidden="true" />
                <input id="study-login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>

              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" type="submit" disabled={loading}>
                <LogIn size={23} /> {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            <div className="login-or-divider"><span>Hoặc</span></div>
            <button type="button" className="login-google-button" disabled title="Chức năng Google chưa được kết nối với Backend">
              <span className="login-google-letter">G</span> Đăng nhập bằng Google
            </button>
            <div className="auth-footer">Chưa có tài khoản? <button type="button" onClick={onGoRegister}>Đăng ký ngay</button></div>
          </section>

          <section className="login-hero" aria-label="Giới thiệu StudyProgress">
            <div className="login-hero-copy">
              <h2>Xây dựng hệ thống hỗ trợ<br />quản lý, phân tích và điều chỉnh<br /><em>tiến độ thực hiện mục tiêu học tập</em></h2>
              <p>của sinh viên dựa trên phân tích chuỗi thời gian</p>
              <div className="login-hero-rule" />
              <div className="login-feature-row">
                <div className="login-feature"><div className="login-feature-icon"><ChartNoAxesCombined size={34} /></div><span>Phân tích<br />tiến độ</span></div>
                <div className="login-feature"><div className="login-feature-icon"><CalendarCheck2 size={34} /></div><span>Điều chỉnh<br />kế hoạch</span></div>
                <div className="login-feature"><div className="login-feature-icon"><Target size={36} /></div><span>Đạt mục tiêu<br />hiệu quả</span></div>
              </div>
            </div>
            <div className="login-study-art" aria-hidden="true">
              <div className="login-art-chart"><div className="login-art-bars"><i /><i /><i /><i /><i /></div><ArrowUpRight size={85} strokeWidth={2.2} /></div>
              <div className="login-art-book login-book-back" /><div className="login-art-book login-book-middle" /><div className="login-art-book login-book-front" />
              <div className="login-art-cap"><GraduationCap size={142} strokeWidth={1.3} /></div>
              <div className="login-art-clock"><Clock3 size={98} strokeWidth={1.4} /></div>
            </div>
          </section>
        </main>

        <footer className="login-footer"><div><GraduationCap size={23} /> <strong>StudyProgress</strong><span>·</span><span>Nền tảng hỗ trợ học tập thông minh</span></div><span className="login-bottom-slogan">Học tốt hơn – Tiến xa hơn</span></footer>
      </div>
      <div className="login-bottom-wave" aria-hidden="true" />
    </div>
  );
}

export default Login;
