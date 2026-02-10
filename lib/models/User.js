import mongoose from "mongoose";

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
    grintEmail: { type: String, trim: true },
    grintPasswordEncrypted: { type: String, select: false },
    grintId: { type: String, trim: true },
    grintLastSync: { type: Date },
    grintVerifiedAt: { type: Date },
    defaultTeeName: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
