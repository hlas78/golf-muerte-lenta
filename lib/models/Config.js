import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true },
    bets: {
      holeWinner: { type: Number, default: 30 },
      medal: { type: Number, default: 120 },
      match: { type: Number, default: 120 },
      sandyPar: { type: Number, default: 20 },
      birdie: { type: Number, default: 30 },
      eagle: { type: Number, default: 50 },
      albatross: { type: Number, default: 80 },
      holeOut: { type: Number, default: 40 },
      wetPar: { type: Number, default: 20 },
      ohYes: { type: Number, default: 30 },
      pinkies: { type: Number, default: 15 },
      cuatriputt: { type: Number, default: 15 },
      saltapatras: { type: Number, default: 15 },
      paloma: { type: Number, default: 15 },
      nerdina: { type: Number, default: 25 },
    },
    sarcasm: {
      type: [String],
      default: [
        "Un pinky mas y te cobran el baston.",
        "Cuatriputt confirmado, la bola ya cobra renta.",
        "Saltapatras: la gravedad aplaude tu estilo.",
        "Paloma registrada, el green pide disculpas.",
        "Nerdina deluxe, esto ya es tour de terror.",
      ],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Config ||
  mongoose.model("Config", ConfigSchema);
