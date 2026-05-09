# School Equipment Lending Platform

A full-stack web application for managing shared school equipment (labs, sports gear, media kits, project materials). Students and staff request items; staff and administrators approve requests, track issuance and returns, and maintain inventory. It is structured like a typical FSAD-style assignment: **React** frontend, **Node.js** microservices, **MongoDB** persistence, and an **API gateway** with bundled API documentation.

---

## Table of contents

1. [What this project does](#what-this-project-does)
2. [Technology stack](#technology-stack)
3. [Repository layout](#repository-layout)
4. [Architecture](#architecture)
5. [Data model (MongoDB)](#data-model-mongodb)
6. [Roles and permissions](#roles-and-permissions)
7. [Environment variables](#environment-variables)
8. [Prerequisites](#prerequisites)
9. [How to run the project](#how-to-run-the-project)
10. [URLs after startup](#urls-after-startup)
11. [Demo accounts](#demo-accounts)
12. [API overview](#api-overview)
13. [Booking lifecycle](#booking-lifecycle)
14. [Frontend routes](#frontend-routes)
15. [Production build (frontend)](#production-build-frontend)
16. [Troubleshooting](#troubleshooting)
17. [Further documentation](#further-documentation)
18. [References](#references)

---

## What this project does

| Actor | Capabilities |
|-------|----------------|
| **Student** | Register/login, browse catalog, filter/search equipment, submit borrow requests, view own bookings. |
| **Staff** | Same as student, plus moderate **all** bookings: approve/reject, mark **issued**, mark **returned**. |
| **Admin** | Everything staff can do, plus **equipment management**: add, edit, delete catalog items (name, category, condition, quantity, availability). |

Business rules include **capacity-aware scheduling**: overlapping date ranges cannot exceed the number of physical units (`quantity_total`), and **availability** (`quantity_available`) decreases when a booking is approved and increases when an item is returned.

---

## Technology stack

| Layer | Technology |
|-------|------------|
| UI | React 18, React Router, Vite |
| API gateway | Express, `http-proxy-middleware`, Swagger UI |
| Services | Node.js (ESM), Express |
| Auth | JWT (Bearer tokens), bcrypt password hashing |
| Database | MongoDB, Mongoose |
| Dev orchestration | `concurrently` (runs all services + UI from one command) |

---

## Repository layout

```
project/
├── docker-compose.yml          # MongoDB 7 (optional; for local DB via Docker)
├── .env.example                # Sample environment variables
├── package.json                # Root scripts: install:all, dev
├── README.md                   # This file
├── FE/                         # Frontend bundle (see FE/README.md)
│   └── frontend/               # React + Vite SPA
├── BE/                         # Backend bundle (see BE/README.md)
│   ├── gateway/                # API gateway + OpenAPI / Swagger
│   └── services/
│       ├── auth-service/
│       ├── equipment-service/
│       └── booking-service/
└── docs/
    ├── mongodb-collections.md   # Collections and admin seeding notes
    └── component-hierarchy.md   # React component tree
```

---

## Architecture

All browser traffic goes through the **Vite dev server**, which proxies `/api` to the **gateway**. The gateway forwards paths to three microservices. Each service connects to the **same MongoDB database** (logical separation only; production systems often use one database per service).

```mermaid
flowchart LR
  subgraph client [Browser]
    UI[React + Vite]
  end
  subgraph gateway [API Gateway :8080]
    GW[Express + proxy + Swagger UI]
  end
  subgraph services [Node microservices]
    A[auth-service :4001]
    E[equipment-service :4002]
    B[booking-service :4003]
  end
  DB[(MongoDB :27017)]
  UI -->|"/api/* proxy"| GW
  GW -->|"/api/auth/*"| A
  GW -->|"/api/equipment/*"| E
  GW -->|"/api/bookings/*"| B
  A --> DB
  E --> DB
  B --> DB
```

**Gateway path mapping (implementation detail):** The gateway strips `/api/auth`, `/api/equipment`, and `/api/bookings` and forwards to each service so they see routes such as `/login`, `/equipment`, and `/bookings` as defined in their respective Express apps.

---

## Data model (MongoDB)

Collections and fields are summarized in [`docs/mongodb-collections.md`](docs/mongodb-collections.md).

- **`users`** — identity and `role` (`student` \| `staff` \| `admin`).
- **`equipment`** — catalog lines with `quantity_total` and `quantity_available` (availability). API responses also expose **`quantity`** (alias for total stock) and **`availability`** (alias for free units).
- **`bookings`** — links a user to equipment with date range, status (`pending` → `approved` \| `rejected` → `issued` → `returned`), and optional notes.

---

## Roles and permissions

| Action | Student | Staff | Admin |
|--------|:-------:|:-----:|:-----:|
| View catalog | Yes | Yes | Yes |
| Create borrow request | Yes | Yes | Yes |
| View own bookings | Yes | Yes | Yes |
| View **all** bookings / moderate | No | Yes | Yes |
| Add / edit / delete **equipment** | No | No | **Yes** |

**Admin seeding:** On first startup, if the `users` collection is empty, the auth service inserts demo users including **`admin@school.edu`** (password **`demo123`**).

**Creating additional admins via API:** Set environment variable **`REGISTER_ADMIN_SECRET`**. Then `POST /api/auth/register` with `"role": "admin"` and `"admin_secret"` equal to that secret (see auth service source).

---

## Environment variables

Copy `.env.example` to `.env` at the **repository root** (optional). Child packages do not auto-load the root `.env`; for a quick local setup, services read **`process.env`** from the shell or use **defaults** in code.

| Variable | Purpose | Typical local value |
|----------|---------|---------------------|
| `MONGODB_URI` | MongoDB connection string for **all** services | `mongodb://127.0.0.1:27017/lending_db` (no auth) or Docker: `mongodb://lend:lend_secret@localhost:27017/lending_db?authSource=admin` |
| `JWT_SECRET` | Shared secret to sign/verify JWTs | Long random string in production |
| `AUTH_PORT` | Auth service | `4001` |
| `EQUIPMENT_PORT` | Equipment service | `4002` |
| `BOOKING_PORT` | Booking service | `4003` |
| `GATEWAY_PORT` | API gateway | `8080` |
| `REGISTER_ADMIN_SECRET` | Optional; unlocks admin self-registration | Omit for default demo-only admin |

You can export variables in your shell before `npm run dev`, or use a tool like `direnv` to load `.env`.

---

## Prerequisites

- **Node.js** (v18+ recommended; project uses native `fetch` in tooling where applicable).
- **npm** (comes with Node).
- **MongoDB** reachable at the URI you configure—either:
  - **Docker**: `docker compose up -d` (see below), or  
  - **Local install**: e.g. Homebrew `mongodb-community@7.0` and `brew services start mongodb/brew/mongodb-community@7.0`.

---

## How to run the project

### Step 1 — Start MongoDB

**Option A — Docker**

```bash
docker compose up -d
docker compose ps    # wait until mongo is healthy
```

Use URI:

`mongodb://lend:lend_secret@localhost:27017/lending_db?authSource=admin`

Export it before starting Node (same terminal session):

```bash
export MONGODB_URI='mongodb://lend:lend_secret@localhost:27017/lending_db?authSource=admin'
```

**Option B — Local MongoDB without authentication**

If MongoDB listens on `localhost:27017` with no user/password, you can **omit** `MONGODB_URI`; services default to:

`mongodb://127.0.0.1:27017/lending_db`

### Step 2 — Install dependencies

From the **repository root**:

```bash
npm install
npm run install:all
```

`install:all` installs dependencies for `BE/gateway`, each service under `BE/services/`, and `FE/frontend`.

### Step 3 — Start every service and the UI

Single command (recommended):

```bash
npm run dev
```

This uses `concurrently` to run:

- auth-service  
- equipment-service  
- booking-service  
- gateway  
- Vite (frontend)

**Alternative — separate terminals** (useful for debugging):

```bash
npm run dev --prefix BE/services/auth-service
npm run dev --prefix BE/services/equipment-service
npm run dev --prefix BE/services/booking-service
npm run dev --prefix BE/gateway
npm run dev --prefix FE/frontend
```

Start **MongoDB before** the Node services. Order among Node processes is flexible once the database is up.

### Step 4 — Verify

- Gateway health: open or curl `http://localhost:8080/health`
- UI: open `http://localhost:5173` (Vite default port; see [Troubleshooting](#troubleshooting) if busy)

---

## URLs after startup

| Resource | URL |
|----------|-----|
| **Web app** | http://localhost:5173 |
| **API gateway** | http://localhost:8080 |
| **Swagger / OpenAPI UI** | http://localhost:8080/api/docs |
| **Gateway health** | http://localhost:8080/health |

Direct service ports (for debugging only; clients should use the gateway):

| Service | Port |
|---------|------|
| auth-service | 4001 |
| equipment-service | 4002 |
| booking-service | 4003 |

---

## Demo accounts

Seeded when the `users` collection is **empty** on first auth-service startup (password **`demo123`** for all):

| Email | Password | Role |
|-------|----------|------|
| admin@school.edu | demo123 | admin |
| staff@school.edu | demo123 | staff |
| student@school.edu | demo123 | student |

If you already have users in MongoDB, seeding is skipped; delete the `users` collection or reset the database to re-seed.

---

## API overview

- **Specification source:** [`BE/gateway/openapi.yaml`](BE/gateway/openapi.yaml)
- **Interactive docs:** http://localhost:8080/api/docs (gateway must be running)

High-level surface:

- **`/api/auth`** — `POST /register`, `POST /login`, `GET /me` (Bearer JWT).
- **`/api/equipment`** — `GET` list/detail (public); `POST` / `PATCH` / `DELETE` (**admin only**).
- **`/api/bookings`** — create/list/detail/update status (JWT; moderation for staff/admin).

The frontend calls **`/api/...`** on the same origin in dev because Vite proxies `/api` to the gateway (see `FE/frontend/vite.config.js`).

---

## Booking lifecycle

1. User submits a **pending** booking with equipment id and date range.  
2. **Staff** or **admin** **approve** or **reject** (inventory decrements on approve if capacity allows).  
3. **Issue** marks physical hand-off (`issued`).  
4. **Return** completes the cycle (`returned`) and restores availability.

Overlapping **approved**/**issued** bookings for the same equipment cannot exceed **`quantity_total`** for that window.

---

## Frontend routes

| Path | Description |
|------|-------------|
| `/login`, `/register` | Authentication |
| `/catalog` | Browse/search equipment; request borrow |
| `/my-bookings` | Current user’s bookings |
| `/moderate` | Staff/admin queue (approve / reject / issue / return) |
| `/admin/equipment` | Admin-only inventory CRUD |

---

## Production build (frontend)

```bash
npm run build --prefix FE/frontend
npm run preview --prefix FE/frontend   # optional local preview of static build
```

Deploy the `FE/frontend/dist` assets behind any static host; configure that host to proxy `/api` to your gateway URL.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| **`EADDRINUSE` on 8080 / 5173** | Another process is using the port. Stop the old dev server or run `lsof -i :8080` (or `:5173`) and terminate the listener. |
| **Mongo connection errors** | Ensure MongoDB is running and `MONGODB_URI` matches your setup (auth vs no auth). |
| **Cannot log in as demo admin** | Database may already contain users without the seed user; reset `users` or drop `lending_db` for a clean seed. |
| **403 on equipment POST/PATCH** | Only **`admin`** can mutate inventory; log in as `admin@school.edu`. |
| **`Could not create booking`** (was failing before fix) | Usually caused by MongoDB **standalone** mode: multi-document **transactions** are not supported without a replica set. This project’s booking service avoids transactions so local `mongod` works. If you still see errors, sign out and sign in again (JWT must carry a MongoDB user id). |

---

## Further documentation

| File | Content |
|------|---------|
| [`docs/mongodb-collections.md`](docs/mongodb-collections.md) | Collections, roles, equipment rules |
| [`docs/component-hierarchy.md`](docs/component-hierarchy.md) | React component structure |
| [`BE/gateway/openapi.yaml`](BE/gateway/openapi.yaml) | REST paths and schemas |
| [`FE/README.md`](FE/README.md) | Frontend folder overview |
| [`BE/README.md`](BE/README.md) | Backend folder overview |

---

## References

- [Express](https://expressjs.com/)
- [Vite](https://vitejs.dev/), [React Router](https://reactrouter.com/)
- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)
- [Mongoose](https://mongoosejs.com/)
