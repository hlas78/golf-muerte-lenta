import {
  allocateStrokes,
  getCourseHandicapForRound,
  normalizeHoleHandicaps,
} from "@/lib/scoring";

export const SARCASTIC_MESSAGES = [
  "Resumen listo. Ya puedes presumir o llorar.",
  "Pagos calculados: la gloria y el dolor vienen juntos.",
  "La ciencia dicta que alguien pagara. Adivina quien.",
  "Tus numeros estan listos. Sin excusas.",
  "Se termino la magia, empiezan las cuentas.",
  "Si no te gusta el resumen, mejora el swing.",
  "Pagos listos. Respira, es solo dinero.",
  "La verdad duele, pero el total duele mas.",
  "Resumen cerrado. El green no perdona.",
  "Los numeros ya hablaron. Tu decides si pagas o cobras.",
  "Hoy no fue tu dia. El resumen lo confirma.",
  "Cuentas claras, amistades en peligro.",
  "Si ganaste, sonriele al grupo. Si perdiste, tambien.",
  "Ya hay resumen. Empieza el show.",
  "Si te molesta, culpa al viento.",
  "Los pagos llegaron. Guarda el orgullo.",
  "Resumen listo. Ahora a pelear por transferencias.",
  "Se acabo la ronda, empieza el reality.",
  "Pagos hechos. La dignidad se fue al rough.",
];

export const ITEM_LABELS = {
  holeWinner: "Hoyo",
  medalFront: "Medal V1",
  medalBack: "Medal V2",
  match: "Match",
  sandyPar: "Sandy ",
  birdie: "Birdie ",
  eagle: "Aguila ",
  albatross: "Albatross ",
  holeOut: "Hole out ",
  wetPar: "Wet par ",
  ohYes: "Oh yes ",
  culebra: "Culebra ",
  indFront: "Medal V1",
  indBack: "Medal V2",
  indRound: "Match",
  indHole: "Hoyo ",
  indBirdie: "Birdie+ ",
  indSandy: "Sandy ",
  indWet: "Wet ",
  indOhYes: "Oh yes ",
};

export const GROUP_ITEMS = new Set([
  "holeWinner",
  "medalFront",
  "medalBack",
  "match",
  "birdie",
  "eagle",
  "albatross",
  "holeOut",
  "sandyPar",
  "wetPar",
  "ohYes",
]);

export function buildPlayerSettlementMessages({
  round,
  payments,
  participants,
  populatedScorecards,
  randomMessage,
}) {
  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const fallbackTee =
    allTees.find((option) => option.tee_name === round.teeName) || allTees[0];
  const normalizedFallbackHoles = normalizeHoleHandicaps(
    fallbackTee?.holes || [],
    round
  );
  const holeHandicaps =
    normalizedFallbackHoles.map((hole, idx) => ({
      hole: hole.hole ?? idx + 1,
      handicap: hole.handicap,
      par: hole.par,
    })) || [];

  const holeHandicapsByPlayer = {};
  const courseHandicapByPlayer = {};
  const strokesByPlayerHole = {};
  let minCourseHandicap = Number.POSITIVE_INFINITY;

  populatedScorecards.forEach((card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) return;
    const playerTee =
      card.teeName ||
      round.playerTees?.find(
        (entry) => String(entry.player) === String(card.player?._id)
      )?.teeName;
    const tee =
      allTees.find((option) => option.tee_name === playerTee) || fallbackTee;
    const normalizedPlayerHoles = normalizeHoleHandicaps(
      tee?.holes || [],
      round
    );
    holeHandicapsByPlayer[playerId] =
      normalizedPlayerHoles.map((hole, idx) => ({
        hole: hole.hole ?? idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || holeHandicaps;

    const courseHandicap = getCourseHandicapForRound(
      tee,
      round,
      card.player?.handicap
    );
    courseHandicapByPlayer[playerId] = courseHandicap;
    if (Number.isFinite(courseHandicap) && courseHandicap < minCourseHandicap) {
      minCourseHandicap = courseHandicap;
    }

    const holeStrokes = {};
    (card.holes || []).forEach((hole) => {
      holeStrokes[hole.hole] = hole.strokes;
    });
    strokesByPlayerHole[playerId] = holeStrokes;
  });

  const strokesMapByPlayer = {};
  const netTotalsByPlayer = {};
  const frontEnd = Math.min(round.holes, 9);
  const effectiveMinHandicap = Number.isFinite(minCourseHandicap)
    ? minCourseHandicap
    : 0;

  const getNetTotalForRange = (card, strokesMap, startHole, endHole) => {
    let netTotal = 0;
    for (let i = startHole; i <= endHole; i += 1) {
      const hole = card.holes?.find((entry) => entry.hole === i);
      const strokes = hole?.strokes || 0;
      netTotal += strokes - (strokesMap[i] || 0);
    }
    return netTotal;
  };

  populatedScorecards.forEach((card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) return;
    const courseHandicap = courseHandicapByPlayer[playerId] ?? 0;
    const relativeHandicap = Math.max(0, courseHandicap - effectiveMinHandicap);
    const strokesMap = allocateStrokes(
      relativeHandicap,
      holeHandicapsByPlayer[playerId] || holeHandicaps,
      round.holes
    );
    strokesMapByPlayer[playerId] = strokesMap;
    const frontNet = getNetTotalForRange(card, strokesMap, 1, frontEnd);
    const backNet =
      round.holes > 9
        ? getNetTotalForRange(card, strokesMap, 10, round.holes)
        : null;
    const matchNet = getNetTotalForRange(card, strokesMap, 1, round.holes);
    netTotalsByPlayer[playerId] = {
      front: frontNet,
      back: backNet,
      match: matchNet,
    };
  });

  const messageTitle = "⛳*La muerte rápida*⛳";
  const getNetForItem = (playerId, item) => {
    const netTotals = netTotalsByPlayer[playerId];
    if (!netTotals) return null;
    if (item === "medalFront") return netTotals.front;
    if (item === "medalBack") return netTotals.back;
    if (item === "match") return netTotals.match;
    return null;
  };

  const buildNetExtra = (playerId, item) => {
    const net = getNetForItem(playerId, item);
    return Number.isFinite(net) ? `· Net ${net}` : "";
  };

  const groupPayments = payments.filter((payment) => GROUP_ITEMS.has(payment.item));
  const culebraPayments = payments.filter((payment) => payment.item === "culebra");
  const individualPayments = payments.filter(
    (payment) => !GROUP_ITEMS.has(payment.item) && payment.item !== "culebra"
  );
  const groupedIndividual = individualPayments.reduce((acc, payment) => {
    const noteKey = payment.note ? `bet:${payment.note}` : null;
    const fallbackKey = [String(payment.from), String(payment.to)]
      .sort()
      .join("-");
    const key = noteKey || `pair:${fallbackKey}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(payment);
    return acc;
  }, {});

  const buildGroupedWinsByPlayer = (blockPayments) =>
    blockPayments.reduce((acc, payment) => {
      const toId = String(payment.to);
      const label = ITEM_LABELS[payment.item] || payment.item;
      let holeLabel = payment.hole ? ` Hoyo ${payment.hole}` : "";
      if (payment.item === "holeWinner") {
        holeLabel = payment.hole ? ` ${payment.hole}` : "";
      }
      const key = `${label}${holeLabel ? ` ${holeLabel}` : ""}`;
      if (!acc[toId]) acc[toId] = {};
      const entry = acc[toId][key] || { amount: 0, extra: "" };
      entry.amount += payment.amount;
      if (payment.item === "holeWinner" && payment.hole) {
        const strokes = strokesByPlayerHole?.[toId]?.[payment.hole];
        if (Number.isFinite(strokes)) {
          entry.extra = `· ${strokes} golpes`;
        }
      }
      if (["medalFront", "medalBack", "match"].includes(payment.item)) {
        const netExtra = buildNetExtra(toId, payment.item);
        if (netExtra) entry.extra = netExtra;
      }
      acc[toId][key] = entry;
      return acc;
    }, {});

  const betBlocks = [
    { title: "Rayas grupales", payments: groupPayments },
    ...(round?.configSnapshot?.culebra?.enabled
      ? [{ title: "Culebra", payments: culebraPayments }]
      : []),
    ...Object.entries(groupedIndividual).map(([key, blockPayments]) => {
      if (key.startsWith("bet:")) {
        const betId = key.replace("bet:", "");
        const bet = (round?.configSnapshot?.individualBets || []).find(
          (entry) => entry.id === betId
        );
        const nameA = bet
          ? participants.find((p) => String(p._id) === String(bet.playerA))?.name
          : null;
        const nameB = bet
          ? participants.find((p) => String(p._id) === String(bet.playerB))?.name
          : null;
        const title =
          nameA && nameB
            ? `Raya individual: ${nameA} vs ${nameB}`
            : "Raya individual";
        return { title, payments: blockPayments };
      }
      return { title: "Raya individual", payments: blockPayments };
    }),
  ];

  const messagesByPlayerId = {};

  participants.forEach((player) => {
    const playerId = String(player._id);
    const messages = [];
    betBlocks.forEach((block) => {
      const wins = block.payments.filter(
        (payment) => String(payment.to) === playerId
      );
      const losses = block.payments.filter(
        (payment) => String(payment.from) === playerId
      );
      if (wins.length === 0 && losses.length === 0) return;

      const groupedWinsByPlayer = buildGroupedWinsByPlayer(block.payments);
      const winsMap = groupedWinsByPlayer[playerId] || {};
      const winEntries = Object.entries(winsMap);
      const winTotal = winEntries.reduce(
        (sum, [, entry]) => sum + (entry?.amount || 0),
        0
      );
      const winLines = winEntries.length
        ? winEntries.map(([label, entry]) => {
            const extra = entry?.extra ? ` ${entry.extra}` : "";
            return `- ${label}: +$${entry.amount}${extra}`;
          })
        : ["- Sin ganancias 😭  💸"];

      const lossTotal = losses.reduce((sum, payment) => sum + payment.amount, 0);
      const lossLines = losses.length
        ? losses.map((payment) => {
            const label = ITEM_LABELS[payment.item];
            let holeLabel = payment.hole ? `Hoyo ${payment.hole}` : "";
            if (payment.item === "holeWinner") {
              holeLabel = payment.hole ? ` ${payment.hole}` : "";
            }
            const extras = [];
            if (payment.item === "holeWinner" && payment.hole) {
              const loserStrokes = strokesByPlayerHole?.[playerId]?.[payment.hole];
              const winnerStrokes =
                strokesByPlayerHole?.[String(payment.to)]?.[payment.hole];
              if (Number.isFinite(winnerStrokes)) extras.push(`. ${winnerStrokes}`);
              if (Number.isFinite(loserStrokes)) extras.push(`vs ${loserStrokes}`);
            }
            if (["medalFront", "medalBack", "match"].includes(payment.item)) {
              const winnerNet = getNetForItem(String(payment.to), payment.item);
              const loserNet = getNetForItem(playerId, payment.item);
              if (Number.isFinite(winnerNet)) extras.push(`. ${winnerNet} vs `);
              if (Number.isFinite(loserNet)) extras.push(`${loserNet}`);
            }
            const extraLabel = extras.length ? ` ${extras.join(" ")}` : "";
            const isIndividual = !GROUP_ITEMS.has(payment.item);
            if (isIndividual) {
              return `- ${label}${holeLabel ? `${holeLabel}` : ""}: -$${payment.amount}${extraLabel}`;
            }
            const rival = participants.find(
              (p) => String(p._id) === String(payment.to)
            );
            const rivalLabel = rival ? `vs ${rival.name}` : "vs Jugador";
            return `- ${label}${holeLabel ? `${holeLabel}` : ""} ${rivalLabel}: -$${payment.amount}${extraLabel}`;
          })
        : ["- Sin pérdidas"];

      const netTotal = winTotal - lossTotal;
      const whatsappMessage = [
        messageTitle,
        "",
        randomMessage,
        "",
        `${block.title}`,
        `Resumen de ${player.name}: 🧾`,
        `Neto: *${netTotal >= 0 ? "Gana " : "Pierde "}$${Math.abs(netTotal)}*`,
        "",
        `Total ganado: $${winTotal} 🤑`,
        ...winLines,
        "",
        `Detalle de pérdidas: -$${lossTotal}`,
        ...lossLines,
      ].join("\n");
      messages.push(whatsappMessage.replace("Hoyo Hoyo", "Hoyo"));
    });
    messagesByPlayerId[playerId] = messages;
  });

  return messagesByPlayerId;
}
