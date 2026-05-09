import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const PORT = Number(process.env.EQUIPMENT_PORT || 4002);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/lending_db";

const equipmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    condition: { type: String, required: true },
    quantity_total: { type: Number, required: true, min: 0 },
    quantity_available: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "equipment",
  }
);

const Equipment = mongoose.model("Equipment", equipmentSchema);

function serializeEquipment(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const id = o._id?.toString?.() ?? String(o.id);
  return {
    id,
    name: o.name,
    category: o.category,
    condition: o.condition,
    quantity_total: o.quantity_total,
    quantity_available: o.quantity_available,
    /** Assignment wording: quantity + availability */
    quantity: o.quantity_total,
    availability: o.quantity_available,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

async function seedDemoEquipment() {
  const count = await Equipment.countDocuments();
  if (count > 0) return;
  await Equipment.insertMany([
    { name: "Volleyball net set", category: "Sports", condition: "Good", quantity_total: 2, quantity_available: 2 },
    { name: "Digital microscope", category: "Lab", condition: "Excellent", quantity_total: 3, quantity_available: 3 },
    { name: "DSLR camera kit", category: "Media", condition: "Fair", quantity_total: 2, quantity_available: 2 },
    { name: "Arduino starter packs", category: "Projects", condition: "Good", quantity_total: 15, quantity_available: 15 },
  ]);
  console.log("[equipment-service] Seeded demo catalog");
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function authOptional(req, _res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return next();
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/** Only admins may add, edit, or delete inventory (assignment requirement). */
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin role required for equipment management" });
  }
  next();
}

app.get("/equipment", authOptional, async (req, res) => {
  try {
    const { category, q, availableOnly } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { category: rx }];
    }
    if (availableOnly === "true" || availableOnly === "1") {
      filter.quantity_available = { $gt: 0 };
    }
    const rows = await Equipment.find(filter).sort({ name: 1 }).lean();
    res.json({ items: rows.map((r) => serializeEquipment(r)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list equipment" });
  }
});

app.get("/equipment/:id", authOptional, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = await Equipment.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(serializeEquipment(row));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load equipment" });
  }
});

app.post("/equipment", authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, category, condition, quantity_total } = req.body || {};
    const qt = Number(quantity_total);
    if (!name || !category || !condition || !Number.isFinite(qt) || qt < 0) {
      return res.status(400).json({
        error: "name, category, condition, quantity (quantity_total) >= 0 required",
      });
    }
    const doc = await Equipment.create({
      name: name.trim(),
      category: category.trim(),
      condition: condition.trim(),
      quantity_total: qt,
      quantity_available: qt,
    });
    res.status(201).json(serializeEquipment(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Create failed" });
  }
});

app.patch("/equipment/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const cur = await Equipment.findById(req.params.id);
    if (!cur) return res.status(404).json({ error: "Not found" });
    const { name, category, condition, quantity_total } = req.body || {};
    const nextName = name != null ? String(name).trim() : cur.name;
    const nextCat = category != null ? String(category).trim() : cur.category;
    const nextCond = condition != null ? String(condition).trim() : cur.condition;
    let nextTotal = cur.quantity_total;
    if (quantity_total != null) {
      nextTotal = Number(quantity_total);
      if (!Number.isFinite(nextTotal) || nextTotal < 0) {
        return res.status(400).json({ error: "Invalid quantity_total" });
      }
    }
    const borrowed = cur.quantity_total - cur.quantity_available;
    let nextAvail = nextTotal - borrowed;
    if (nextAvail < 0) {
      return res.status(400).json({
        error: "quantity cannot be less than units currently lent out",
      });
    }
    cur.name = nextName;
    cur.category = nextCat;
    cur.condition = nextCond;
    cur.quantity_total = nextTotal;
    cur.quantity_available = nextAvail;
    await cur.save();
    res.json(serializeEquipment(cur));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/equipment/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const Booking = mongoose.connection.collection("bookings");
    const hasBookings = await Booking.countDocuments({
      equipment_id: new mongoose.Types.ObjectId(req.params.id),
    });
    if (hasBookings > 0) {
      return res.status(409).json({ error: "Equipment has bookings; remove or complete bookings first" });
    }
    const r = await Equipment.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Delete failed" });
  }
});

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "equipment-service" })
);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("[equipment-service] Connected to MongoDB");
  await seedDemoEquipment();
  app.listen(PORT, () =>
    console.log(`[equipment-service] http://localhost:${PORT}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
