import connectDb from "../lib/db.js";
import Round from "../lib/models/Round.js";
import User from "../lib/models/User.js";
import { buildWelcomeMessage } from "../lib/welcomeMessageBuilder.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { sendMessage } = require("./sendMessage");

function buildRecordLink(roundId, token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  return `${baseUrl}/rounds/${roundId}?${params.toString()}`;
}

async function run() {
  await connectDb();
  const now = new Date();
  const rounds = await Round.find({
    status: { $ne: "closed" },
    startedAt: { $lte: now },
  });

  for (const round of rounds) {
    const playerIds = Array.isArray(round.players)
      ? round.players.map(String)
      : [];
    if (playerIds.length === 0) {
      continue;
    }
    const sent = new Set(
      Array.isArray(round.welcomeSentPlayers)
        ? round.welcomeSentPlayers.map(String)
        : []
    );
    const pendingIds = playerIds.filter((id) => !sent.has(id));
    if (pendingIds.length === 0) {
      continue;
    }
    const participants = await User.find({ _id: { $in: pendingIds } });
    const campo =
      round.courseSnapshot?.clubName ||
      round.courseSnapshot?.courseName ||
      "el campo";
    const creator = round.createdBy
      ? await User.findById(round.createdBy)
      : null;

    for (const player of participants) {
      if (!player.magicToken) {
        player.magicToken = require("crypto").randomBytes(24).toString("hex");
        player.magicTokenCreatedAt = new Date();
        await player.save();
      }
      const recordLink = buildRecordLink(round._id, player.magicToken);
      const message = buildWelcomeMessage({
        campo,
        creatorName: creator?.name || "sin nombre",
        description: round.description || "",
        recordLink,
        startedAt: round.startedAt,
      });
      await sendMessage(player.phone, message);
      sent.add(String(player._id));
    }

    round.welcomeSentAt = new Date();
    round.welcomeSentPlayers = Array.from(sent);
    await round.save();
  }
}

run()
  .then(() => {
    console.log("Welcome dispatcher finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Welcome dispatcher failed:", error);
    process.exit(1);
  });
