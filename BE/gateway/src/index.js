import "dotenv/config";
import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.GATEWAY_PORT || 8080);
const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://127.0.0.1:4001";
const EQUIP_URL = process.env.EQUIPMENT_SERVICE_URL || "http://127.0.0.1:4002";
const BOOK_URL = process.env.BOOKING_SERVICE_URL || "http://127.0.0.1:4003";

const app = express();
app.use(cors({ origin: true, credentials: true }));

const proxyCommon = {
  changeOrigin: true,
  onProxyReq(proxyReq, req) {
    if (req.headers.authorization) {
      proxyReq.setHeader("Authorization", req.headers.authorization);
    }
  },
};

app.use(
  "/api/auth",
  createProxyMiddleware({
    ...proxyCommon,
    target: AUTH_URL,
    pathRewrite: { "^/api/auth": "" },
  })
);

/** Express strips mount prefix; path is e.g. "/" or "/3", not "/api/equipment/3". */
function rewriteAfterMount(basePath) {
  return (path) => {
    if (path === "/" || path === "") return basePath;
    return `${basePath}${path}`;
  };
}

app.use(
  "/api/equipment",
  createProxyMiddleware({
    ...proxyCommon,
    target: EQUIP_URL,
    pathRewrite: rewriteAfterMount("/equipment"),
  })
);

app.use(
  "/api/bookings",
  createProxyMiddleware({
    ...proxyCommon,
    target: BOOK_URL,
    pathRewrite: rewriteAfterMount("/bookings"),
  })
);

/* Aggregated OpenAPI spec */
const openapiPath = path.join(__dirname, "..", "openapi.yaml");
let openapiDoc = { openapi: "3.0.3", info: { title: "API", version: "1.0.0" }, paths: {} };
try {
  const raw = fs.readFileSync(openapiPath, "utf8");
  openapiDoc = YAML.parse(raw);
} catch {
  console.warn("[gateway] openapi.yaml not found; Swagger UI will show placeholder");
}

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDoc));
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "api-gateway",
    upstreams: { auth: AUTH_URL, equipment: EQUIP_URL, bookings: BOOK_URL },
  })
);

app.listen(PORT, () => {
  console.log(`[gateway] http://localhost:${PORT}`);
  console.log(`[gateway] docs http://localhost:${PORT}/api/docs`);
});
