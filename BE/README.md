# Backend (`BE`)

This folder holds all **server-side** code: the API gateway and Node.js microservices that talk to **MongoDB**.

## Contents

| Path | Default port | Role |
|------|----------------|------|
| **`gateway/`** | 8080 | Reverse proxy for `/api/auth`, `/api/equipment`, `/api/bookings`; serves Swagger UI at `/api/docs` |
| **`services/auth-service/`** | 4001 | Registration, login, JWT, `/me`, demo user seeding |
| **`services/equipment-service/`** | 4002 | Equipment catalog; **admin-only** create/update/delete |
| **`services/booking-service/`** | 4003 | Borrowing requests; approve / reject / issue / return workflow |

All services read **`MONGODB_URI`** (see repository root `.env.example`). They share one database for this prototype.

## Requirements

- Node.js and npm  
- **MongoDB** running before starting services (Docker Compose at repo root, or a local `mongod`)

## Install dependencies

From the repository root:

```bash
npm run install:all
```

Or install each package:

```bash
npm install --prefix BE/gateway
npm install --prefix BE/services/auth-service
npm install --prefix BE/services/equipment-service
npm install --prefix BE/services/booking-service
```

## Run in development

From the **repository root** (starts gateway + all services + frontend):

```bash
npm run dev
```

Or start backend pieces only (in separate terminals):

```bash
npm run dev --prefix BE/services/auth-service
npm run dev --prefix BE/services/equipment-service
npm run dev --prefix BE/services/booking-service
npm run dev --prefix BE/gateway
```

## API documentation

- OpenAPI source: **`BE/gateway/openapi.yaml`**
- With the gateway running: **http://localhost:8080/api/docs**
- Health check: **http://localhost:8080/health**

## Related docs

- Root **[README.md](../README.md)** — environment variables, MongoDB URIs, demo accounts  
- **[docs/mongodb-collections.md](../docs/mongodb-collections.md)** — collections and roles  
