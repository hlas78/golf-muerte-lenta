import mongoose from "mongoose";

const RoundSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    courseSnapshot: mongoose.Schema.Types.Mixed,
    teeName: { type: String, default: "por-jugador" },
    holes: { type: Number, enum: [9, 18], default: 18 },
    nineType: { type: String, enum: ["front", "back"], default: "front" },
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
    playerGroups: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        group: { type: Number, enum: [1, 2, 3, 4] },
      },
    ],
    groupMarshals: [
      {
        group: { type: Number, enum: [1, 2, 3, 4] },
        player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    configSnapshot: mongoose.Schema.Types.Mixed,
    startedAt: Date,
    endedAt: Date,
    welcomeSentAt: Date,
    welcomeSentPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.models.Round || mongoose.model("Round", RoundSchema);
