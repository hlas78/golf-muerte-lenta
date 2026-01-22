import mongoose from "mongoose";

const RoundSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    courseSnapshot: mongoose.Schema.Types.Mixed,
    teeName: { type: String, default: "por-jugador" },
    holes: { type: Number, enum: [9, 18], default: 18 },
    status: {
      type: String,
      enum: ["open", "active", "closed"],
      default: "open",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    description: { type: String, trim: true },
    playerTees: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        teeName: { type: String },
      },
    ],
    configSnapshot: mongoose.Schema.Types.Mixed,
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.Round || mongoose.model("Round", RoundSchema);
