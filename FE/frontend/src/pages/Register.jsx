import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "student",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/catalog" replace />;

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
      });
      nav("/catalog", { replace: true });
    } catch (err) {
      setError(err.body?.error || err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create an account</h1>
        <p className="muted">
          New accounts can register as student or staff. A demo <strong>admin</strong> is seeded (
          <code className="kbd">admin@school.edu</code>
          ); promoting via API needs server env <code className="kbd">REGISTER_ADMIN_SECRET</code>.
        </p>
        <form onSubmit={onSubmit} className="form-grid">
          {error && <p className="error-banner">{error}</p>}
          <label>
            Full name
            <input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              minLength={6}
              required
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Creating…" : "Register"}
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
