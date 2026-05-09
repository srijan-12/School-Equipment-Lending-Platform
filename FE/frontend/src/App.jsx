import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Catalog from "./pages/Catalog.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Moderate from "./pages/Moderate.jsx";
import AdminEquipment from "./pages/AdminEquipment.jsx";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="shell center">
        <p className="muted">Loading session…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="shell">
        <p className="error-banner">You do not have access to this page.</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/catalog" replace />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="my-bookings" element={<MyBookings />} />
        <Route
          path="moderate"
          element={
            <Protected roles={["staff", "admin"]}>
              <Moderate />
            </Protected>
          }
        />
        <Route
          path="admin/equipment"
          element={
            <Protected roles={["admin"]}>
              <AdminEquipment />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  );
}
