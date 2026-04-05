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
  const strokesPerHole = {};
  const base = Math.floor(handicap / holesCount);
  const extra = handicap % holesCount;

  const sorted = holeHandicaps
    .slice(0, holesCount)
    .map((hole) => ({ hole: hole.hole, rank: hole.handicap }))
    .sort((a, b) => a.rank - b.rank);

  sorted.forEach((hole, idx) => {
    strokesPerHole[hole.hole] = base + (idx < extra ? 1 : 0);
  });

  return strokesPerHole;
}

export function normalizeHoleHandicaps(holes, round) {
  if (!Array.isArray(holes)) {
    return [];
  }
  if (!round || round.holes !== 9) {
    return holes;
  }
  const sliceStart = round.nineType === "back" ? 9 : 0;
  return holes.slice(sliceStart, sliceStart + 9).map((hole, idx) => ({
    ...hole,
    hole: idx + 1,
  }));
}

export function getRoundHoleSlice(tee, round) {
  if (!tee?.holes) {
    return [];
  }
  const holesCount = round?.holes || 18;
  if (holesCount !== 9) {
    return tee.holes.slice(0, holesCount);
  }
  const sliceStart = round?.nineType === "back" ? 9 : 0;
  return tee.holes.slice(sliceStart, sliceStart + 9);
}

export function getCourseHandicapForRound(tee, round, handicap) {
  // console.log(`getCourseHandicapForRound(tee ${JSON.stringify(tee,null,1)}, handicap: ${handicap}, round:`, round );
  if (!tee) {
    return Number.isFinite(handicap) ? handicap : 0;
  }
  const holesCount = round?.holes || 18;
  let parTotal = 0;
  let courseRating;
  let slopeRating;
  if (holesCount === 9) {
    console.log(`holesCount: ${holesCount}`)
    const slice = getRoundHoleSlice(tee, round);
    parTotal = slice.reduce((sum, hole) => sum + (hole.par || 0), 0);
    if (round?.nineType === "back") {
      courseRating = tee.back_course_rating ?? tee.course_rating;
      slopeRating = tee.back_slope_rating ?? tee.slope_rating;
    } else {
      courseRating = tee.front_course_rating ?? tee.course_rating;
      slopeRating = tee.front_slope_rating ?? tee.slope_rating;
    }
  } else {
    parTotal =
      tee.par_total ??
      tee.holes?.slice(0, holesCount).reduce(
        (sum, hole) => sum + (hole.par || 0),
        0
      );
    courseRating = tee.course_rating;
    slopeRating = tee.slope_rating;
  }
  if (!courseRating || !slopeRating || !Number.isFinite(handicap)) {
    return Number.isFinite(handicap) ? handicap : 0;
  }
  let hc = Math.round(handicap * (slopeRating / 113) + (courseRating - parTotal));
  return (hc > 28 ? 28 : hc)
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
  const normalizeConfig = (raw) => {
    if (!raw) {
      return { bets: {}, individualBets: [], culebra: {} };
    }
    if (raw.bets) {
      return {
        bets: raw.bets || {},
        individualBets: Array.isArray(raw.individualBets)
          ? raw.individualBets
          : [],
        culebra: raw.culebra || {},
      };
    }
    return { bets: raw || {}, individualBets: [], culebra: {} };
  };

  const normalizedConfig = normalizeConfig(config);
  const bets = normalizedConfig.bets || {};
  const individualBets = normalizedConfig.individualBets || [];
  const culebraConfig = normalizedConfig.culebra || {};
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

  const getCardHandicap = (card) =>
    Number.isFinite(card.courseHandicap)
      ? card.courseHandicap
      : card.player?.handicap || 0;

  const minHandicap = scorecards.reduce((min, card) => {
    const value = getCardHandicap(card);
    return value < min ? value : min;
  }, Number.POSITIVE_INFINITY);

  const getNetTotalsForRange = (startHole, endHole) =>
    scorecards
      .filter((card) => isRangeComplete(card, startHole, endHole))
      .map((card) => {
      const handicaps = getHandicaps(card.player._id.toString());
      const relativeHandicap = Math.max(
        0,
        getCardHandicap(card) -
          (Number.isFinite(minHandicap) ? minHandicap : 0)
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

  function isRangeComplete(card, startHole, endHole) {
    for (let i = startHole; i <= endHole; i += 1) {
      const hole = card.holes?.find((entry) => entry.hole === i);
      if (hole?.strokes == null || hole.strokes === "") {
        return false;
      }
    }
    return true;
  }
  const isAllCompleteRange = (startHole, endHole) =>
    scorecards.length > 0 &&
    scorecards.every((card) => isRangeComplete(card, startHole, endHole));

  const awardMedal = (netTotals, item, startHole, endHole) => {
    if (!isAllCompleteRange(startHole, endHole)) {
      return;
    }
    if (!netTotals.length) {
      return;
    }
    const minValue = Math.min(...netTotals.map((entry) => entry.netTotal));
    const tied = netTotals.filter((entry) => entry.netTotal === minValue);
    if (tied.length !== 1) {
      return;
    }
    const medalWinner = tied[0];
    if (!medalWinner) {
      return;
    }
    const amount = bets.medal;
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
  awardMedal(getNetTotalsForRange(1, frontEnd), "medalFront", 1, frontEnd);
  if (round.holes > 9) {
    awardMedal(
      getNetTotalsForRange(10, round.holes),
      "medalBack",
      10,
      round.holes
    );
  }

  const holeWinners = {};
  const eligiblePlayersByHole = {};
  for (let i = 0; i < round.holes; i += 1) {
    const holeNumber = i + 1;
    eligiblePlayersByHole[holeNumber] = scorecards
      .filter((card) => {
        const entry = card.holes?.find((hole) => hole.hole === holeNumber);
        return !(entry?.strokes == null || entry.strokes === "");
      })
      .map((card) => card.player);
  }
  for (let i = 0; i < round.holes; i += 1) {
    // console.log(`Hoyo ${i+1}:`)
    const holeNumber = i + 1;
    const netScores = scorecards
      .filter((card) => {
        const entry = card.holes?.find((hole) => hole.hole === holeNumber);
        return !(entry?.strokes == null || entry.strokes === "");
      })
      .map((card) => {
      const handicaps = getHandicaps(card.player._id.toString());
      // console.log(`allocateStrokes ${card.player.name}`)
      const relativeHandicap = Math.max(
        0,
        getCardHandicap(card) -
          (Number.isFinite(minHandicap) ? minHandicap : 0)
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
      // console.log(`${card?.player.name?.padEnd(30,' ')} golpes: ${holeScore?.strokes} net: ${net}`)
      return { player: card.player, net };
    });

    const min = Math.min(...netScores.map((s) => s.net));
    const winners = netScores.filter((s) => s.net === min);
    if (winners.length === 1) {
      // console.log(`Gana hoyo: ${winners[0].player.name}\n`)
      holeWinners[holeNumber] = winners[0].player;
      const amount = bets.holeWinner;
      const eligiblePlayers = eligiblePlayersByHole[holeNumber] || [];
      eligiblePlayers.forEach((player) => {
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
      const eligiblePlayers = eligiblePlayersByHole[hole.hole] || players;
      const outcome = deriveHoleOutcome(hole);
      if (outcome.birdie) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.birdie,
            "birdie",
            hole.hole
          )
        );
      }
      if (outcome.eagle) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.eagle,
            "eagle",
            hole.hole
          )
        );
      }
      if (outcome.albatross) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.albatross,
            "albatross",
            hole.hole
          )
        );
      }

      if (hole.sandy && hole.strokes <= hole.par) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.sandyPar,
            "sandyPar",
            hole.hole
          )
        );
      }
      const isHoleOut =
        hole.putts === 0 &&
        (hole.holeOut ||
          (hole.par != null && hole.strokes <= hole.par));
      if (isHoleOut) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.holeOut,
            "holeOut",
            hole.hole
          )
        );
      }
      if (hole.water && hole.strokes <= hole.par) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.wetPar,
            "wetPar",
            hole.hole
          )
        );
      }
      if (hole.par === 3 && hole.ohYes) {
        payments.push(
          ...buildSidePot(
            card.player,
            eligiblePlayers,
            bets.ohYes,
            "ohYes",
            hole.hole
          )
        );
      }
    });
  });

  const culebraAmount =
    Number(culebraConfig?.amount) || Number(bets.culebra) || 0;
  if (culebraAmount > 0 && culebraConfig?.enabled) {
    const culebraEvents = [];
    const eligiblePlayers = new Map();
    const allowedPlayers = new Set(
      Array.isArray(culebraConfig.players)
        ? culebraConfig.players.map(String)
        : []
    );
    scorecards.forEach((card) => {
      if (allowedPlayers.size > 0 && !allowedPlayers.has(String(card.player?._id))) {
        return;
      }
      card.holes.slice(0, round.holes).forEach((hole) => {
        if (hole?.putts == null || hole.putts === "") {
          return;
        }
        eligiblePlayers.set(card.player._id.toString(), card.player);
        if (Number(hole.putts) === 3) {
          culebraEvents.push({
            player: card.player,
            hole: hole.hole,
          });
        }
      });
    });

    if (culebraEvents.length > 0 && eligiblePlayers.size > 1) {
      const lastHole = Math.max(...culebraEvents.map((event) => event.hole));
      const lastCandidates = culebraEvents.filter(
        (event) => event.hole === lastHole
      );
      if (lastCandidates.length === 1) {
        const loser = lastCandidates[0].player;
        const pot = culebraEvents.length * culebraAmount;
        const receivers = Array.from(eligiblePlayers.values()).filter(
          (player) => player._id.toString() !== loser._id.toString()
        );
        if (receivers.length > 0) {
          const amountPerPlayer = Math.round((pot / receivers.length) * 100) / 100;
          receivers.forEach((player) => {
            payments.push({
              from: loser._id,
              to: player._id,
              amount: amountPerPlayer,
              item: "culebra",
            });
          });
        }
      }
    }
  }

  if (round.holes > 9 && isAllCompleteRange(1, round.holes)) {
    const totalNetTotals = getNetTotalsForRange(1, round.holes);
    if (totalNetTotals.length < 2) {
      return payments;
    }
    const minValue = Math.min(
      ...totalNetTotals.map((entry) => entry.netTotal)
    );
    const tied = totalNetTotals.filter((entry) => entry.netTotal === minValue);
    if (tied.length === 1) {
      const matchWinner = tied[0];
      const winnerId = matchWinner.player._id.toString();
      const amount = bets.match;
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

  if (individualBets.length > 0) {
    const scorecardByPlayer = scorecards.reduce((acc, card) => {
      acc[card.player?._id?.toString()] = card;
      return acc;
    }, {});

    const getNetTotal = (card, strokesMap, startHole, endHole) => {
      let netTotal = 0;
      for (let i = startHole; i <= endHole; i += 1) {
        const hole = card.holes?.find((entry) => entry.hole === i);
        const strokes = hole?.strokes || 0;
        netTotal += strokes - (strokesMap[i] || 0);
      }
      return netTotal;
    };

    individualBets.forEach((bet) => {
      const playerAId = bet?.playerA ? String(bet.playerA) : "";
      const playerBId = bet?.playerB ? String(bet.playerB) : "";
      if (!playerAId || !playerBId || playerAId === playerBId) {
        return;
      }
      const cardA = scorecardByPlayer[playerAId];
      const cardB = scorecardByPlayer[playerBId];
      if (!cardA || !cardB) {
        return;
      }

      const handicapA = getCardHandicap(cardA);
      const handicapB = getCardHandicap(cardB);
      const minPairHandicap = Math.min(handicapA, handicapB);
      const relativeA = Math.max(0, handicapA - minPairHandicap);
      const relativeB = Math.max(0, handicapB - minPairHandicap);
      const strokesMapA = allocateStrokes(
        relativeA,
        getHandicaps(playerAId),
        round.holes
      );
      const strokesMapB = allocateStrokes(
        relativeB,
        getHandicaps(playerBId),
        round.holes
      );

      const frontEnd = Math.min(round.holes, 9);
      const backStart = 10;
      const amounts = bet.amounts || {};
      const accumulateOnTie = Boolean(bet.accumulateOnTie);
      let potHole = 0;
      let potBirdie = 0;
      let potSandy = 0;
      let potWet = 0;
      let potOhYes = 0;

      if (amounts.front > 0) {
        if (!isRangeComplete(cardA, 1, frontEnd) || !isRangeComplete(cardB, 1, frontEnd)) {
          // Skip until both tengan vuelta completa
        } else {
        const netA = getNetTotal(cardA, strokesMapA, 1, frontEnd);
        const netB = getNetTotal(cardB, strokesMapB, 1, frontEnd);
        if (netA < netB) {
          payments.push({
            from: cardB.player._id,
            to: cardA.player._id,
            amount: amounts.front,
            item: "indFront",
            note: bet.id,
          });
        } else if (netB < netA) {
          payments.push({
            from: cardA.player._id,
            to: cardB.player._id,
            amount: amounts.front,
            item: "indFront",
            note: bet.id,
          });
        }
        }
      }

      if (round.holes > 9 && amounts.back > 0) {
        if (!isRangeComplete(cardA, backStart, round.holes) || !isRangeComplete(cardB, backStart, round.holes)) {
          // Skip hasta tener vuelta completa
        } else {
        const netA = getNetTotal(cardA, strokesMapA, backStart, round.holes);
        const netB = getNetTotal(cardB, strokesMapB, backStart, round.holes);
        if (netA < netB) {
          payments.push({
            from: cardB.player._id,
            to: cardA.player._id,
            amount: amounts.back,
            item: "indBack",
            note: bet.id,
          });
        } else if (netB < netA) {
          payments.push({
            from: cardA.player._id,
            to: cardB.player._id,
            amount: amounts.back,
            item: "indBack",
            note: bet.id,
          });
        }
        }
      }

      if (round.holes > 9 && amounts.round > 0) {
        if (!isRangeComplete(cardA, 1, round.holes) || !isRangeComplete(cardB, 1, round.holes)) {
          // Skip hasta tener ronda completa
        } else {
        const netA = getNetTotal(cardA, strokesMapA, 1, round.holes);
        const netB = getNetTotal(cardB, strokesMapB, 1, round.holes);
        if (netA < netB) {
          payments.push({
            from: cardB.player._id,
            to: cardA.player._id,
            amount: amounts.round,
            item: "indRound",
            note: bet.id,
          });
        } else if (netB < netA) {
          payments.push({
            from: cardA.player._id,
            to: cardB.player._id,
            amount: amounts.round,
            item: "indRound",
            note: bet.id,
          });
        }
        }
      }

      if (amounts.hole > 0) {
        for (let i = 1; i <= round.holes; i += 1) {
          const holeA = cardA.holes?.find((entry) => entry.hole === i);
          const holeB = cardB.holes?.find((entry) => entry.hole === i);
          const strokesA = holeA?.strokes;
          const strokesB = holeB?.strokes;
          if (strokesA == null || strokesA === "" || strokesB == null || strokesB === "") {
            continue;
          }
          const netA = strokesA - (strokesMapA[i] || 0);
          const netB = strokesB - (strokesMapB[i] || 0);
          if (netA < netB) {
            payments.push({
              from: cardB.player._id,
              to: cardA.player._id,
              amount: amounts.hole + (accumulateOnTie ? potHole : 0),
              item: "indHole",
              hole: i,
              note: bet.id,
            });
            potHole = 0;
          } else if (netB < netA) {
            payments.push({
              from: cardA.player._id,
              to: cardB.player._id,
              amount: amounts.hole + (accumulateOnTie ? potHole : 0),
              item: "indHole",
              hole: i,
              note: bet.id,
            });
            potHole = 0;
          } else if (accumulateOnTie) {
            potHole += amounts.hole;
          }
        }
      }

      for (let i = 1; i <= round.holes; i += 1) {
        const holeA = cardA.holes?.find((entry) => entry.hole === i);
        const holeB = cardB.holes?.find((entry) => entry.hole === i);
        const bothCaptured =
          holeA?.strokes != null &&
          holeA?.strokes !== "" &&
          holeB?.strokes != null &&
          holeB?.strokes !== "";
        if (!bothCaptured) {
          continue;
        }
        const outcomeA = deriveHoleOutcome(holeA || {});
        const outcomeB = deriveHoleOutcome(holeB || {});

        const birdieA = outcomeA.birdie || outcomeA.eagle || outcomeA.albatross;
        const birdieB = outcomeB.birdie || outcomeB.eagle || outcomeB.albatross;
        if (amounts.birdie > 0 && birdieA !== birdieB) {
          payments.push({
            from: birdieA ? cardB.player._id : cardA.player._id,
            to: birdieA ? cardA.player._id : cardB.player._id,
            amount: amounts.birdie + (accumulateOnTie ? potBirdie : 0),
            item: "indBirdie",
            hole: i,
            note: bet.id,
          });
          potBirdie = 0;
        } else if (amounts.birdie > 0 && accumulateOnTie) {
          potBirdie += amounts.birdie;
        }

        const sandyA = holeA?.sandy && holeA?.strokes <= holeA?.par;
        const sandyB = holeB?.sandy && holeB?.strokes <= holeB?.par;
        if (amounts.sandy > 0 && sandyA !== sandyB) {
          payments.push({
            from: sandyA ? cardB.player._id : cardA.player._id,
            to: sandyA ? cardA.player._id : cardB.player._id,
            amount: amounts.sandy + (accumulateOnTie ? potSandy : 0),
            item: "indSandy",
            hole: i,
            note: bet.id,
          });
          potSandy = 0;
        } else if (amounts.sandy > 0 && accumulateOnTie) {
          potSandy += amounts.sandy;
        }

        const wetA = holeA?.water && holeA?.strokes <= holeA?.par;
        const wetB = holeB?.water && holeB?.strokes <= holeB?.par;
        if (amounts.wet > 0 && wetA !== wetB) {
          payments.push({
            from: wetA ? cardB.player._id : cardA.player._id,
            to: wetA ? cardA.player._id : cardB.player._id,
            amount: amounts.wet + (accumulateOnTie ? potWet : 0),
            item: "indWet",
            hole: i,
            note: bet.id,
          });
          potWet = 0;
        } else if (amounts.wet > 0 && accumulateOnTie) {
          potWet += amounts.wet;
        }

        const ohYesA = holeA?.par === 3 && holeA?.ohYes;
        const ohYesB = holeB?.par === 3 && holeB?.ohYes;
        if (amounts.ohYes > 0 && ohYesA !== ohYesB) {
          payments.push({
            from: ohYesA ? cardB.player._id : cardA.player._id,
            to: ohYesA ? cardA.player._id : cardB.player._id,
            amount: amounts.ohYes + (accumulateOnTie ? potOhYes : 0),
            item: "indOhYes",
            hole: i,
            note: bet.id,
          });
          potOhYes = 0;
        } else if (amounts.ohYes > 0 && accumulateOnTie) {
          potOhYes += amounts.ohYes;
        }
      }
    });
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
