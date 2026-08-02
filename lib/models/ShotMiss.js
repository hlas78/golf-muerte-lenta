import mongoose from "mongoose";

const ShotMissSchema = new mongoose.Schema(
  {
    round: { type: mongoose.Schema.Types.ObjectId, ref: "Round", index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    hole: { type: Number, min: 1, max: 18, required: true },
    club: { type: String, trim: true, required: true },
    distance: { type: String, trim: true },
    direction: { type: String, trim: true },
    height: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    gps: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      altitude: Number,
      altitudeAccuracy: Number,
      heading: Number,
      speed: Number,
      capturedAt: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.models.ShotMiss ||
  mongoose.model("ShotMiss", ShotMissSchema);
