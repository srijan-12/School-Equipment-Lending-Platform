import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const PORT = Number(process.env.AUTH_PORT || 4001);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/lending_db";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["student", "staff", "admin"],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "users",
  }
);

const User = mongoose.model("User", userSchema);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function signToken(userDoc) {
  const id = userDoc._id.toString();
  return jwt.sign(
    { sub: id, role: userDoc.role, email: userDoc.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function stripUser(doc) {
  return {
    id: doc._id.toString(),
    email: doc.email,
    full_name: doc.full_name,
    role: doc.role,
    created_at: doc.created_at,
  };
}

async function seedDemoUsers() {
  const count = await User.countDocuments();
  if (count > 0) return;
  const hash = await bcrypt.hash("demo123", 10);
  await User.insertMany([
    { email: "admin@school.edu", password_hash: hash, full_name: "Lab Admin", role: "admin" },
    { email: "staff@school.edu", password_hash: hash, full_name: "Teacher Lee", role: "staff" },
    { email: "student@school.edu", password_hash: hash, full_name: "Alex Student", role: "student" },
  ]);
  console.log("[auth-service] Seeded demo users including admin (password: demo123)");
}

/**
 * Self-service registration is limited to student/staff.
 * Admin accounts are created via seeding or optional REGISTER_ADMIN_SECRET (see POST /register).
 */
app.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, role, admin_secret } = req.body || {};
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "email, password, full_name required" });
    }
    let r = "student";
    if (role === "staff") r = "staff";
    if (role === "admin") {
      const secret = process.env.REGISTER_ADMIN_SECRET;
      if (!secret || admin_secret !== secret) {
        return res.status(403).json({
          error:
            "Admin registration requires REGISTER_ADMIN_SECRET on the server and matching admin_secret in the request",
        });
      }
      r = "admin";
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.trim().toLowerCase(),
      password_hash: hash,
      full_name: full_name.trim(),
      role: r,
    });
    const token = signToken(user);
    res.status(201).json({ user: stripUser(user), token });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken(user);
    res.json({
      user: stripUser(user),
      token,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "auth-service" }));

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("[auth-service] Connected to MongoDB");
  await seedDemoUsers();
  app.listen(PORT, () =>
    console.log(`[auth-service] http://localhost:${PORT}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
