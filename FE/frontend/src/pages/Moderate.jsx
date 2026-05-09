import { useEffect, useState } from "react";
import { api } from "../api";

export default function Moderate() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.bookingsList(false);
      const list = data.items || [];
      list.sort((a, b) => {
        const pri = (s) =>
          ({ pending: 0, approved: 1, issued: 2, returned: 3, rejected: 4 }[s] ?? 9);
        const d = pri(a.status) - pri(b.status);
        return d !== 0 ? d : new Date(b.created_at) - new Date(a.created_at);
      });
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

  async function act(id, action) {
    setBusyId(id + action);
    setError("");
    try {
      await api.bookingPatch(id, action);
      await load();
    } catch (e) {
      setError(e.body?.error || e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Approve & issue</h1>
          <p className="muted">
            Pending requests appear first. Approve reserves stock; issue marks hand-off; return closes the
            loan.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={() => load()}>
          Refresh
        </button>
      </header>
      {error && <p className="error-banner">{error}</p>}
      {loading ? (
        <p className="muted">Loading queue…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Item</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.borrower_name}</strong>
                    <div className="muted small">{b.borrower_email}</div>
                  </td>
                  <td>
                    {b.equipment_name}
                    <div className="muted small">{b.equipment_category}</div>
                  </td>
                  <td>
                    {b.start_date} → {b.end_date}
                  </td>
                  <td>
                    <span className="pill subtle">{b.status}</span>
                  </td>
                  <td className="actions-cell">
                    {b.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className="btn small primary"
                          disabled={busyId}
                          onClick={() => act(b.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          disabled={busyId}
                          onClick={() => act(b.id, "reject")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {b.status === "approved" && (
                      <button
                        type="button"
                        className="btn small primary"
                        disabled={busyId}
                        onClick={() => act(b.id, "issue")}
                      >
                        Mark issued
                      </button>
                    )}
                    {b.status === "issued" && (
                      <button
                        type="button"
                        className="btn small primary"
                        disabled={busyId}
                        onClick={() => act(b.id, "return")}
                      >
                        Mark returned
                      </button>
                    )}
                    {(b.status === "returned" || b.status === "rejected") && (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No bookings in the system yet.
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
