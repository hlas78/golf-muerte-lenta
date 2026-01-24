const BONUS_ITEMS = [
  "sandyPar",
  "birdie",
  "eagle",
  "albatross",
  "holeOut",
  "wetPar",
  "ohYes",
];
const PENALTY_ITEMS = ["pinkies", "cuatriputt", "saltapatras", "paloma", "nerdina"];

export function allocateStrokes(handicap, holeHandicaps, holesCount) {
  console.log(handicap)
  const strokesPerHole = {};
  const base = Math.floor(handicap / holesCount);
  const extra = handicap % holesCount;
  console.log(`extra: ${extra}`)

  const sorted = holeHandicaps
    .slice(0, holesCount)
    .map((hole) => ({ hole: hole.hole, rank: hole.handicap }))
    .sort((a, b) => a.rank - b.rank);

  console.log(sorted)

  sorted.forEach((hole, idx) => {
    strokesPerHole[hole.hole] = base + (idx < extra ? 1 : 0);
  });
  console.log(strokesPerHole)

  return strokesPerHole;
}

export function deriveHoleOutcome({ par, strokes }) {
  if (strokes == null || par == null) {
    return { birdie: false, eagle: false, albatross: false };
  }

  const diff = strokes - par;
  return {
    birdie: diff === -1,
    eagle: diff === -2,
    albatross: diff <= -3,
  };
}

export function calculatePayments({
  config,
  round,
  scorecards,
  holeHandicaps,
  holeHandicapsByPlayer,
}) {
  const players = scorecards.map((card) => card.player);
  const payments = [];
  const fallbackHandicaps =
    holeHandicaps ||
    (holeHandicapsByPlayer
      ? Object.values(holeHandicapsByPlayer)[0]
      : []) ||
    [];

  const getHandicaps = (playerId) =>
    holeHandicapsByPlayer?.[playerId] || fallbackHandicaps;

  const minHandicap = scorecards.reduce((min, card) => {
    const value = card.player?.handicap ?? 0;
    return value < min ? value : min;
  }, Number.POSITIVE_INFINITY);

  const getNetTotalsForRange = (startHole, endHole) =>
    scorecards.map((card) => {
      const handicaps = getHandicaps(card.player._id.toString());
      const relativeHandicap = Math.max(
        0,
        (card.player.handicap || 0) - (Number.isFinite(minHandicap) ? minHandicap : 0)
      );
      const strokesMap = allocateStrokes(
        relativeHandicap,
        handicaps,
        round.holes
      );
      let netTotal = 0;
      for (let i = startHole; i <= endHole; i += 1) {
        const hole = card.holes?.find((entry) => entry.hole === i);
        const strokes = hole?.strokes || 0;
        const net = strokes - (strokesMap[i] || 0);
        netTotal += net;
      }
      return { player: card.player, netTotal };
    });

  const awardMedal = (netTotals, item) => {
    if (!netTotals.length) {
      return;
    }
    const medalWinner = netTotals.reduce((best, current) => {
      if (!best || current.netTotal < best.netTotal) return current;
      return best;
    }, null);
    if (!medalWinner) {
      return;
    }
    const amount = config.bets.medal;
    players.forEach((player) => {
      if (player._id.toString() !== medalWinner.player._id.toString()) {
        payments.push({
          from: player._id,
          to: medalWinner.player._id,
          amount,
          item,
        });
      }
    });
  };

  const frontEnd = Math.min(round.holes, 9);
  awardMedal(getNetTotalsForRange(1, frontEnd), "medalFront");
  if (round.holes > 9) {
    awardMedal(getNetTotalsForRange(10, round.holes), "medalBack");
  }

  const holeWinners = {};
  for (let i = 0; i < round.holes; i += 1) {
    console.log(`Hoyo ${i+1}:`)
    const holeNumber = i + 1;
    const netScores = scorecards.map((card) => {
      const handicaps = getHandicaps(card.player._id.toString());
      console.log(`allocateStrokes ${card.player.name}`)
      const relativeHandicap = Math.max(
        0,
        (card.player.handicap || 0) - (Number.isFinite(minHandicap) ? minHandicap : 0)
      );
      const strokesMap = allocateStrokes(
        relativeHandicap,
        handicaps,
        round.holes
      );
      const holeScore = card.holes?.find(
        (entry) => entry.hole === holeNumber
      );
      const net =
        (holeScore?.strokes || 0) - (strokesMap[holeNumber] || 0);
      console.log(`${card?.player.name?.padEnd(30,' ')} golpes: ${holeScore?.strokes} net: ${net}`)
      return { player: card.player, net };
    });

    const min = Math.min(...netScores.map((s) => s.net));
    const winners = netScores.filter((s) => s.net === min);
    if (winners.length === 1) {
      console.log(`Gana hoyo: ${winners[0].player.name}\n`)
      holeWinners[holeNumber] = winners[0].player;
      const amount = config.bets.holeWinner;
      players.forEach((player) => {
        if (player._id.toString() !== winners[0].player._id.toString()) {
          payments.push({
            from: player._id,
            to: winners[0].player._id,
            amount,
            item: "holeWinner",
            hole: holeNumber,
          });
        }
      });
    }
  }

  scorecards.forEach((card) => {
    card.holes.slice(0, round.holes).forEach((hole) => {
      const outcome = deriveHoleOutcome(hole);
      if (outcome.birdie) {
        payments.push(...buildSidePot(card.player, players, config.bets.birdie, "birdie", hole.hole));
      }
      if (outcome.eagle) {
        payments.push(...buildSidePot(card.player, players, config.bets.eagle, "eagle", hole.hole));
      }
      if (outcome.albatross) {
        payments.push(...buildSidePot(card.player, players, config.bets.albatross, "albatross", hole.hole));
      }

      if (hole.sandy) {
        payments.push(
          ...buildSidePot(card.player, players, config.bets.sandyPar, "sandyPar", hole.hole)
        );
      }
      const isHoleOut =
        hole.putts === 0 &&
        (hole.holeOut ||
          (hole.par != null && hole.strokes <= hole.par));
      if (isHoleOut) {
        payments.push(
          ...buildSidePot(card.player, players, config.bets.holeOut, "holeOut", hole.hole)
        );
      }
      if (hole.water && hole.strokes === hole.par) {
        payments.push(...buildSidePot(card.player, players, config.bets.wetPar, "wetPar", hole.hole));
      }
      if (hole.par === 3 && hole.ohYes) {
        payments.push(
          ...buildSidePot(card.player, players, config.bets.ohYes, "ohYes", hole.hole)
        );
      }
    });
  });

  if (round.holes > 9) {
    const totalNetTotals = getNetTotalsForRange(1, round.holes);
    const matchWinner = totalNetTotals.reduce((best, current) => {
      if (!best || current.netTotal < best.netTotal) return current;
      return best;
    }, null);

    if (matchWinner) {
      const winnerId = matchWinner.player._id.toString();
      const amount = config.bets.match;
      players.forEach((player) => {
        if (player._id.toString() !== winnerId) {
          payments.push({
            from: player._id,
            to: matchWinner.player._id,
            amount,
            item: "match",
          });
        }
      });
    }
  }

  return payments;
}

function buildSidePot(winner, players, amount, item, hole) {
  return players
    .filter((player) => player._id.toString() !== winner._id.toString())
    .map((player) => ({
      from: player._id,
      to: winner._id,
      amount,
      item,
      hole,
    }));
}

export const scoringConfig = {
  BONUS_ITEMS,
  PENALTY_ITEMS,
};
