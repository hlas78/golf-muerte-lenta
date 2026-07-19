import connectDb from "../lib/db.js";
import Round from "../lib/models/Round.js";
import User from "../lib/models/User.js";
import {
  buildRoundWelcomeGroupMessage,
} from "../lib/welcomeMessageBuilder.js";
import { getCourseHandicapForRound } from "../lib/scoring.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { sendMessage } = require("./sendMessage");
const WELCOME_GROUP_ID = "120363405357623444@g.us";

async function run() {
  await connectDb();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 10 * 60 * 1000);
  const rounds = await Round.find({
    status: { $ne: "closed" },
    startedAt: { $lte: windowEnd },
  });

  for (const round of rounds) {
    if (round.welcomeSentAt) {
      continue;
    }
    const playerIds = Array.isArray(round.players)
      ? round.players.map(String)
      : [];
    if (playerIds.length === 0) {
      continue;
    }
    const participants = await User.find({ _id: { $in: playerIds } });
    const campo =
      round.courseSnapshot?.clubName ||
      round.courseSnapshot?.courseName ||
      "el campo";
    const tees = round.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const roster = participants
      .map((player) => {
        const teeName =
          round.playerTees?.find(
            (entry) => String(entry.player) === String(player._id)
          )?.teeName || "";
        const selectedTee =
          allTees.find((option) => option.tee_name === teeName) || allTees[0];
        const courseHandicap = selectedTee
          ? getCourseHandicapForRound(
              selectedTee,
              round,
              player.handicap || 0
            )
          : null;
        return {
          name: player.name,
          handicap: player.handicap ?? 0,
          teeName: selectedTee?.tee_name || teeName,
          courseHandicap,
          group:
            round.playerGroups?.find(
              (entry) => String(entry.player) === String(player._id)
            )?.group || 99,
        };
      })
      .sort((a, b) => (a.group - b.group) || a.name.localeCompare(b.name));
    const message = buildRoundWelcomeGroupMessage({
      campo,
      description: round.description || "",
      startedAt: round.startedAt,
      players: roster,
    });
    await sendMessage(WELCOME_GROUP_ID, message);

    round.welcomeSentAt = new Date();
    round.welcomeSentPlayers = playerIds;
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
