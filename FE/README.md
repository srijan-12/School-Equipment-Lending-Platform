# Frontend (`FE`)

This folder holds the **browser client** for the School Equipment Lending Platform.

## Contents

| Path            | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| **`frontend/`** | React 18 + Vite SPA: routing, auth context, catalog, bookings, admin inventory UI |

## Requirements

- Node.js and npm (same versions as the repo root).

## Install dependencies

From the repository root:

```bash
npm install --prefix FE/frontend
```

Or install everything (gateway, all services, and this frontend):

```bash
npm install
npm run install:all
```

## Run in development

From the **repository root** (recommended — starts UI + API together):

```bash
npm run dev
```

Or run only the Vite dev server:

```bash
npm run dev --prefix FE/frontend
```

The app defaults to **http://localhost:5173** (or the next free port if 5173 is busy). It proxies **`/api`** to the API gateway (`http://localhost:8080`); see `frontend/vite.config.js`.

## Production build

```bash
npm run build --prefix FE/frontend
```

Static output is written to **`FE/frontend/dist/`**. Serve those files behind any HTTP server and configure it to forward `/api` to your gateway.

## Related docs

- Root **[README.md](../README.md)** — full project overview and run instructions
- **[docs/component-hierarchy.md](../docs/component-hierarchy.md)** — React component structure
