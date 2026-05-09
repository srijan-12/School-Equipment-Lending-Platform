const base = "";

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload }),
  me: () => request("/api/auth/me"),
  equipmentList: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return request(`/api/equipment${q ? `?${q}` : ""}`);
  },
  equipmentOne: (id) => request(`/api/equipment/${id}`),
  equipmentCreate: (body) =>
    request("/api/equipment", { method: "POST", body }),
  equipmentUpdate: (id, body) =>
    request(`/api/equipment/${id}`, { method: "PATCH", body }),
  equipmentDelete: (id) =>
    request(`/api/equipment/${id}`, { method: "DELETE" }),
  bookingsList: (mine) =>
    request(`/api/bookings${mine ? "?mine=1" : ""}`),
  bookingCreate: (body) =>
    request("/api/bookings", { method: "POST", body }),
  bookingPatch: (id, action) =>
    request(`/api/bookings/${id}`, { method: "PATCH", body: { action } }),
};
