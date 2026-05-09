import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext.jsx";

export default function Catalog() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [submitErr, setSubmitErr] = useState("");

  const params = useMemo(() => {
    const p = {};
    if (category.trim()) p.category = category.trim();
    if (q.trim()) p.q = q.trim();
    if (availableOnly) p.availableOnly = "true";
    return p;
  }, [category, q, availableOnly]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.equipmentList(params);
      setItems(data.items || []);
    } catch (e) {
      setError(e.body?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [category, q, availableOnly]);

  async function submitBooking(e) {
    e.preventDefault();
    setSubmitErr("");
    try {
      await api.bookingCreate({
        equipment_id: modal.id,
        start_date: form.start_date,
        end_date: form.end_date,
        notes: form.notes || undefined,
      });
      setModal(null);
      setForm({ start_date: "", end_date: "", notes: "" });
      load();
    } catch (err) {
      setSubmitErr(err.body?.error || err.message);
    }
  }

  const categories = useMemo(() => {
    const s = new Set();
    items.forEach((i) => s.add(i.category));
    return [...s].sort();
  }, [items]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Equipment catalog</h1>
          <p className="muted">
            Browse shared resources and submit a borrowing request. Issuance is handled by lab staff.
          </p>
        </div>
      </header>

      <div className="toolbar">
        <input
          className="grow"
          placeholder="Search name or category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available only
        </label>
      </div>

      {error && <p className="error-banner">{error}</p>}
      {loading ? (
        <p className="muted">Loading inventory…</p>
      ) : (
        <div className="card-grid">
          {items.map((item) => (
            <article key={item.id} className="card">
              <div className="card-top">
                <span className="pill subtle">{item.category}</span>
                <span className={`pill ${item.quantity_available > 0 ? "ok" : "warn"}`}>
                  {item.quantity_available}/{item.quantity_total} free
                </span>
              </div>
              <h2>{item.name}</h2>
              <p className="muted small">
                Condition: <strong>{item.condition}</strong>
              </p>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={item.quantity_available < 1}
                  onClick={() => {
                    setModal(item);
                    setSubmitErr("");
                  }}
                >
                  Request borrow
                </button>
              </div>
            </article>
          ))}
          {!items.length && <p className="muted">No equipment matches your filters.</p>}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="booking-title">Borrow request — {modal.name}</h2>
            <p className="muted small">
              Signed in as <strong>{user?.full_name}</strong>. Requests start as <em>pending</em>.
            </p>
            <form onSubmit={submitBooking} className="form-grid">
              {submitErr && <p className="error-banner">{submitErr}</p>}
              <label>
                Start date
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </label>
              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <div className="row-actions">
                <button type="button" className="btn ghost" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Submit request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
