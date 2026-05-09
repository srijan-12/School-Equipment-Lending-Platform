import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const staff = user?.role === "staff" || user?.role === "admin";
  const admin = user?.role === "admin";

  return (
    <div className="app-root">
      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>LendLab</strong>
            <span className="brand-sub">School equipment lending</span>
          </div>
        </div>
        <nav className="nav-links">
          <NavLink end to="/catalog" className={({ isActive }) => (isActive ? "active" : "")}>
            Catalog
          </NavLink>
          <NavLink to="/my-bookings" className={({ isActive }) => (isActive ? "active" : "")}>
            My bookings
          </NavLink>
          {staff && (
            <NavLink to="/moderate" className={({ isActive }) => (isActive ? "active" : "")}>
              Approve & issue
            </NavLink>
          )}
          {admin && (
            <NavLink
              to="/admin/equipment"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Manage inventory
            </NavLink>
          )}
        </nav>
        <div className="user-menu">
          <div className="user-meta">
            <span className="user-name">{user?.full_name}</span>
            <span className="pill">{user?.role}</span>
          </div>
          <button type="button" className="btn ghost" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="shell">
        <Outlet />
      </main>
      <footer className="footer">
        <span>Prototype — FSAD-style stack (React · Gateway · Node services · MongoDB)</span>
      </footer>
    </div>
  );
}
