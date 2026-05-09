import { useEffect, useState } from "react";
import { api } from "../api";

const emptyForm = {
  name: "",
  category: "",
  condition: "",
  quantity_total: 1,
};

export default function AdminEquipment() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.equipmentList({});
      setItems(data.items || []);
    } catch (e) {
      setError(e.body?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await api.equipmentCreate({
        ...form,
        quantity_total: Number(form.quantity_total),
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.body?.error || err.message);
    }
  }

  async function onUpdate(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      await api.equipmentUpdate(editing.id, {
        name: editing.name,
        category: editing.category,
        condition: editing.condition,
        quantity_total: Number(editing.quantity_total),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.body?.error || err.message);
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Delete this equipment row?")) return;
    setError("");
    try {
      await api.equipmentDelete(id);
      await load();
    } catch (err) {
      setError(err.body?.error || err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Manage inventory</h1>
          <p className="muted">Admins maintain catalog metadata and stock counts.</p>
        </div>
      </header>

      <section className="panel">
        <h2>Add equipment</h2>
        <form onSubmit={onCreate} className="form-row">
          {error && <p className="error-banner">{error}</p>}
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            required
          />
          <input
            placeholder="Condition"
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
            required
          />
          <input
            type="number"
            min={0}
            placeholder="Qty"
            value={form.quantity_total}
            onChange={(e) => set("quantity_total", e.target.value)}
            required
          />
          <button type="submit" className="btn primary">
            Add
          </button>
        </form>
      </section>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Condition</th>
                <th>Availability / Quantity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  {editing?.id === row.id ? (
                    <>
                      <td>
                        <input
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ ...editing, name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={editing.category}
                          onChange={(e) =>
                            setEditing({ ...editing, category: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={editing.condition}
                          onChange={(e) =>
                            setEditing({ ...editing, condition: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={editing.quantity_total}
                          onChange={(e) =>
                            setEditing({ ...editing, quantity_total: e.target.value })
                          }
                        />
                      </td>
                      <td className="actions-cell">
                        <form onSubmit={onUpdate} className="inline-form">
                          <button type="submit" className="btn small primary">
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{row.category}</td>
                      <td>{row.condition}</td>
                      <td>
                        {(row.availability ?? row.quantity_available)} / {(row.quantity ?? row.quantity_total)}
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => setEditing({ ...row })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => onDelete(row.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
