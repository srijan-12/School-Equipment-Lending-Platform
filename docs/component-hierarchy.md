# React component hierarchy

```
main.jsx
└── BrowserRouter
    └── AuthProvider
        └── App (routes)
            ├── Login
            ├── Register
            └── Protected → Layout (shell: topnav + Outlet + footer)
                    ├── Catalog
                    ├── MyBookings
                    ├── Protected (staff|admin) → Moderate
                    └── Protected (admin) → AdminEquipment
```

Shared modules: `src/api.js` (fetch helper), `src/context/AuthContext.jsx` (session + JWT in `localStorage`).
