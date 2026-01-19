const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!key) {
      return;
    }
    const value = rest.join("=").trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnv();

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["player", "supervisor", "admin"],
      default: "player",
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected"],
      default: "pending",
    },
    magicToken: { type: String },
    magicTokenCreatedAt: { type: Date },
    handicap: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

async function hashPassword(password) {
  const bcrypt = require("bcryptjs");
  return bcrypt.hash(password, 10);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  const name = process.argv[2];
  const phone = process.argv[3];
  const password = process.argv[4];

  if (!name || !phone || !password) {
    throw new Error(
      "Usage: node scripts/createAdmin.js \"Nombre\" 5512345678 clave"
    );
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new Error("Telefono invalido. Debe ser 10 digitos.");
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ phone });
  if (existing) {
    existing.name = name;
    existing.role = "admin";
    existing.status = "active";
    existing.passwordHash = await hashPassword(password);
    await existing.save();
    console.log("Admin actualizado.");
  } else {
    await User.create({
      name,
      phone,
      passwordHash: await hashPassword(password),
      role: "admin",
      status: "active",
    });
    console.log("Admin creado.");
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
