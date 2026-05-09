import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const PORT = Number(process.env.BOOKING_PORT || 4003);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/lending_db";

const bookingSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    equipment_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Equipment" },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected", "issued", "returned"],
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    notes: { type: String },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "bookings",
  }
);

const Booking = mongoose.model("Booking", bookingSchema);
const Equipment = mongoose.model(
  "Equipment",
  new mongoose.Schema({}, { strict: false, collection: "equipment" })
);
const User = mongoose.model(
  "User",
  new mongoose.Schema({}, { strict: false, collection: "users" })
);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

function day(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function equipmentExists(equipmentId) {
  if (!mongoose.isValidObjectId(equipmentId)) return false;
  const r = await Equipment.findById(equipmentId).select("_id").lean();
  return !!r;
}

async function overlapApprovedCount(equipmentId, start, end, excludeBookingId) {
  const exId = excludeBookingId && mongoose.isValidObjectId(excludeBookingId)
    ? new mongoose.Types.ObjectId(excludeBookingId)
    : null;
  const filter = {
    equipment_id: new mongoose.Types.ObjectId(equipmentId),
    status: { $in: ["approved", "issued"] },
    start_date: { $lte: end },
    end_date: { $gte: start },
  };
  if (exId) filter._id = { $ne: exId };
  return Booking.countDocuments(filter);
}

async function scheduleFits(equipmentId, start, end, excludeBookingId) {
  const eq = await Equipment.findById(equipmentId).select("quantity_total").lean();
  if (!eq) return { ok: false, reason: "not_found" };
  const qt = eq.quantity_total;
  const overlap = await overlapApprovedCount(equipmentId, start, end, excludeBookingId);
  return { ok: overlap < qt, overlap, quantity_total: qt };
}

function serializeBooking(b, extras = {}) {
  const o = b.toObject ? b.toObject() : { ...b };
  return {
    id: o._id?.toString(),
    user_id: o.user_id?.toString?.() ?? o.user_id,
    equipment_id: o.equipment_id?.toString?.() ?? o.equipment_id,
    status: o.status,
    start_date: o.start_date?.toISOString?.().slice(0, 10) ?? o.start_date,
    end_date: o.end_date?.toISOString?.().slice(0, 10) ?? o.end_date,
    notes: o.notes,
    approved_by: o.approved_by?.toString?.() ?? o.approved_by,
    created_at: o.created_at,
    updated_at: o.updated_at,
    ...extras,
  };
}

app.post("/bookings", authRequired, async (req, res) => {
  try {
    const { equipment_id, start_date, end_date, notes } = req.body || {};
    if (!equipment_id || !start_date || !end_date) {
      return res.status(400).json({ error: "equipment_id, start_date, end_date required" });
    }
    if (!mongoose.isValidObjectId(req.user.sub)) {
      return res.status(401).json({ error: "Invalid session; please sign in again" });
    }
    if (!mongoose.isValidObjectId(equipment_id)) {
      return res.status(400).json({ error: "Invalid equipment_id" });
    }
    if (!(await equipmentExists(equipment_id))) {
      return res.status(404).json({ error: "Equipment not found" });
    }
    const start = day(new Date(String(start_date)));
    const end = day(new Date(String(end_date)));
    if (end < start) {
      return res.status(400).json({ error: "end_date must be on or after start_date" });
    }

    const fit = await scheduleFits(equipment_id, start, end, null);
    if (!fit.ok) {
      return res.status(409).json({
        error:
          fit.reason === "not_found"
            ? "Equipment not found"
            : "All units are already reserved for overlapping dates",
      });
    }

    /** No Mongo session/transaction: standalone mongod does not support transactions (replica set only). */
    const created = await Booking.create({
      user_id: new mongoose.Types.ObjectId(req.user.sub),
      equipment_id: new mongoose.Types.ObjectId(equipment_id),
      status: "pending",
      start_date: start,
      end_date: end,
      notes: notes || undefined,
    });
    res.status(201).json(serializeBooking(created));
  } catch (e) {
    console.error(e);
    const msg =
      process.env.NODE_ENV === "development" && e?.message
        ? e.message
        : "Could not create booking";
    res.status(500).json({ error: msg });
  }
});

app.get("/bookings", authRequired, async (req, res) => {
  try {
    const role = req.user.role;
    const mineOnly =
      role === "student" || ((role === "staff" || role === "admin") && req.query.mine === "1");
    const match = {};
    if (mineOnly) {
      match.user_id = new mongoose.Types.ObjectId(req.user.sub);
    }
    const rows = await Booking.find(match).sort({ created_at: -1 }).lean();
    const userIds = [
      ...new Set(rows.map((r) => String(r.user_id)).filter((id) => mongoose.isValidObjectId(id))),
    ].map((id) => new mongoose.Types.ObjectId(id));
    const equipIds = [
      ...new Set(
        rows.map((r) => String(r.equipment_id)).filter((id) => mongoose.isValidObjectId(id))
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));
    const [users, equips] = await Promise.all([
      userIds.length
        ? User.find({ _id: { $in: userIds } }).select("full_name email").lean()
        : Promise.resolve([]),
      equipIds.length
        ? Equipment.find({ _id: { $in: equipIds } }).select("name category").lean()
        : Promise.resolve([]),
    ]);
    const uMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
    const eMap = Object.fromEntries(equips.map((e) => [String(e._id), e]));
    const items = rows.map((r) =>
      serializeBooking(r, {
        borrower_name: uMap[String(r.user_id)]?.full_name,
        borrower_email: uMap[String(r.user_id)]?.email,
        equipment_name: eMap[String(r.equipment_id)]?.name,
        equipment_category: eMap[String(r.equipment_id)]?.category,
      })
    );
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list bookings" });
  }
});

app.get("/bookings/:id", authRequired, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const b = await Booking.findById(req.params.id).lean();
    if (!b) return res.status(404).json({ error: "Not found" });
    const isOwner = String(b.user_id) === req.user.sub;
    const isStaff = req.user.role === "staff" || req.user.role === "admin";
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [u, e] = await Promise.all([
      User.findById(b.user_id).select("full_name email").lean(),
      Equipment.findById(b.equipment_id).select("name").lean(),
    ]);
    res.json(
      serializeBooking(b, {
        borrower_name: u?.full_name,
        borrower_email: u?.email,
        equipment_name: e?.name,
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load booking" });
  }
});

function canModerate(role) {
  return role === "staff" || role === "admin";
}

app.patch("/bookings/:id", authRequired, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    const bookingId = req.params.id;
    const { action } = req.body || {};
    if (!["approve", "reject", "issue", "return"].includes(action)) {
      return res.status(400).json({ error: "action must be approve|reject|issue|return" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Not found" });
    }

    if (action === "approve" || action === "reject") {
      if (!canModerate(req.user.role)) {
        return res.status(403).json({ error: "Staff or admin only" });
      }
      if (booking.status !== "pending") {
        return res.status(400).json({ error: "Only pending bookings can be approved/rejected" });
      }
      if (action === "reject") {
        booking.status = "rejected";
        booking.approved_by = new mongoose.Types.ObjectId(req.user.sub);
        await booking.save();
        return res.json(serializeBooking(booking));
      }
      const fit = await scheduleFits(
        booking.equipment_id,
        booking.start_date,
        booking.end_date,
        booking._id
      );
      if (!fit.ok) {
        return res.status(409).json({
          error: "No free unit left for these dates (capacity exceeded)",
        });
      }
      const eq = await Equipment.findById(booking.equipment_id);
      if (!eq || eq.quantity_available < 1) {
        return res.status(409).json({ error: "No units available for this equipment" });
      }
      eq.quantity_available -= 1;
      await eq.save();
      booking.status = "approved";
      booking.approved_by = new mongoose.Types.ObjectId(req.user.sub);
      await booking.save();
      return res.json(serializeBooking(booking));
    }

    if (action === "issue") {
      if (!canModerate(req.user.role)) {
        return res.status(403).json({ error: "Staff or admin only" });
      }
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Only approved bookings can be issued" });
      }
      booking.status = "issued";
      await booking.save();
      return res.json(serializeBooking(booking));
    }

    if (action === "return") {
      if (!canModerate(req.user.role)) {
        return res.status(403).json({ error: "Staff or admin only" });
      }
      if (booking.status !== "issued") {
        return res.status(400).json({ error: "Only issued items can be marked returned" });
      }
      const eq = await Equipment.findById(booking.equipment_id);
      if (eq) {
        eq.quantity_available = Math.min(eq.quantity_total, eq.quantity_available + 1);
        await eq.save();
      }
      booking.status = "returned";
      await booking.save();
      return res.json(serializeBooking(booking));
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Update failed" });
  }
});

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "booking-service" })
);

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("[booking-service] Connected to MongoDB");
  app.listen(PORT, () =>
    console.log(`[booking-service] http://localhost:${PORT}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
