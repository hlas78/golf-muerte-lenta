import mongoose from "mongoose";

const HoleSchema = new mongoose.Schema(
  {
    hole: Number,
    par: Number,
    strokes: Number,
    putts: Number,
    ohYes: Boolean,
    sandy: Boolean,
    bunker: Boolean,
    water: Boolean,
    holeOut: Boolean,
    penalties: [String],
    notes: String,
  },
  { _id: false }
);

const ScorecardSchema = new mongoose.Schema(
  {
    round: { type: mongoose.Schema.Types.ObjectId, ref: "Round" },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teeName: { type: String },
    courseHandicap: Number,
    holes: [HoleSchema],
    grossTotal: Number,
    netTotal: Number,
    puttsTotal: Number,
    accepted: { type: Boolean, default: false },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    grintUploadedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Scorecard ||
  mongoose.model("Scorecard", ScorecardSchema);
