import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_ORDER = ["pending", "approved", "issued", "returned", "rejected"];

function statusClass(s) {
  if (s === "pending") return "pill warn";
  if (s === "approved" || s === "issued") return "pill ok";
  if (s === "returned") return "pill subtle";
  return "pill";
}

export default function MyBookings() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.bookingsList(true);
      const list = data.items || [];
      list.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          new Date(b.created_at) - new Date(a.created_at)
      );
      setItems(list);
    } catch (e) {
      setError(e.body?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My bookings</h1>
          <p className="muted">
            Track requests you have submitted{user?.full_name ? ` (${user.full_name})` : ""}.
          </p>
        </div>
      </header>
      {error && <p className="error-banner">{error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.equipment_name}</strong>
                    <div className="muted small">{b.equipment_category}</div>
                  </td>
                  <td>
                    {b.start_date} → {b.end_date}
                  </td>
                  <td>
                    <span className={statusClass(b.status)}>{b.status}</span>
                  </td>
                  <td className="muted small">{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    No bookings yet — browse the catalog to request equipment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
