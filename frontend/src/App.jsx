
import { useState } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./Dashboard";

function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Khi dang nhap thanh cong
  function handleLogin(data) {
    setUser(data.user);
    setToken(data.access_token);
    setPage("dashboard");
  }

  // Khi dang xuat
  function handleLogout() {
    setUser(null);
    setToken(null);
    setPage("login");
  }

  // Trang dang ky
  if (page === "register") {
    return (
      <Register
        onGoLogin={() => setPage("login")}
      />
    );
  }

  // Trang dang nhap
  if (page === "login" || !token) {
    return (
      <Login
        onLogin={handleLogin}
        onGoRegister={() => setPage("register")}
      />
    );
  }

  // Trang Dashboard
  return (
    <Dashboard
      user={user}
      token={token}
      onLogout={handleLogout}
    />
  );
}

export default App;
