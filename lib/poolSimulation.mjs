const id = (value) => String(value?._id ?? value);

export function duplicateOhYesHoles(cards) {
  const counts = new Map();
  for (const card of cards) {
    for (const hole of card.holes || []) {
      if (hole.ohYes) counts.set(Number(hole.hole), (counts.get(Number(hole.hole)) || 0) + 1);
    }
  }
  return [...counts].filter(([, count]) => count > 1).map(([hole]) => hole);
}

// Integer cent allocations: largest remainder, with player id as a stable tie-break.
function distribute(poolCents, shares) {
  const total = shares.reduce((sum, row) => sum + row.units, 0n);
  const amounts = shares.map(({ units, ...row }) => {
    const numerator = BigInt(poolCents) * units;
    return { ...row, prizeCents: Number(numerator / total), remainder: numerator % total };
  });
  const remaining = poolCents - amounts.reduce((sum, row) => sum + row.prizeCents, 0);
  const ordered = [...amounts].sort((a, b) => a.remainder === b.remainder ? a.playerId.localeCompare(b.playerId) : (a.remainder > b.remainder ? -1 : 1));
  for (let i = 0; i < remaining; i += 1) ordered[i].prizeCents += 1;
  return amounts;
}

export function simulatePoolRound({ round, scorecards, payments = [], feeCents = 25000 }) {
  if (!Number.isSafeInteger(feeCents) || feeCents <= 0 || feeCents > 100000000) {
    throw new Error("La cuota debe ser positiva, con máximo dos decimales y hasta $1,000,000.");
  }
  const base = {
    id: id(round), date: round.startedAt || round.createdAt,
    course: round.courseSnapshot?.courseName || round.courseSnapshot?.clubName || "Campo",
  };
  const reasons = [];
  const reject = (message) => reasons.push(message);
  if (round.status !== "closed" || round.holes !== 18) reject("Solo se simulan rondas cerradas de 18 hoyos.");
  const playerIds = (round.players || []).map(id);
  if (playerIds.length < 2) reject("Se requieren al menos dos jugadores.");
  if (new Set(playerIds).size !== playerIds.length || scorecards.length !== playerIds.length ||
      new Set(scorecards.map((card) => id(card.player))).size !== scorecards.length ||
      playerIds.some((playerId) => !scorecards.some((card) => id(card.player) === playerId))) {
    reject("Los participantes y las tarjetas no coinciden o están duplicados.");
  }
  const tees = [...(round.courseSnapshot?.tees?.male || []), ...(round.courseSnapshot?.tees?.female || [])];
  const prepared = [];
  for (const card of scorecards) {
    const name = card.player?.name || "Jugador";
    const playerId = id(card.player);
    if (!card.accepted) reject(`${name}: tarjeta sin aceptar.`);
    if (!Number.isInteger(card.courseHandicap)) reject(`${name}: falta HC de campo válido guardado.`);
    const teeName = card.teeName || round.playerTees?.find((entry) => id(entry.player) === playerId)?.teeName || round.teeName;
    const tee = tees.find((entry) => entry.tee_name === teeName);
    if (!tee) { reject(`${name}: no se encontró su salida en el campo guardado.`); continue; }
    const metadata = (tee.holes || []).map((hole, index) => ({ ...hole, hole: hole.hole ?? index + 1 }));
    if (metadata.length !== 18 || new Set(metadata.map((hole) => hole.hole)).size !== 18 ||
        new Set(metadata.map((hole) => hole.handicap)).size !== 18 ||
        metadata.some((hole) => !Number.isInteger(hole.hole) || hole.hole < 1 || hole.hole > 18 ||
          !Number.isInteger(hole.handicap) || hole.handicap < 1 || hole.handicap > 18 ||
          !Number.isInteger(hole.par) || hole.par < 3)) {
      reject(`${name}: pares o ventajas del campo incompletos.`); continue;
    }
    const recordedHoles = card.holes || [];
    const isBlank = (hole) => hole?.strokes == null || hole.strokes === "";
    const complete = (start) => Array.from({ length: 9 }, (_, i) => start + i).every((number) =>
      recordedHoles.some((hole) => hole.hole === number && Number.isInteger(hole.strokes) && hole.strokes > 0));
    const empty = (start) => Array.from({ length: 9 }, (_, i) => start + i).every((number) =>
      isBlank(recordedHoles.find((hole) => hole.hole === number)));
    const frontComplete = complete(1);
    const backComplete = complete(10);
    const holesPlayed = frontComplete && backComplete ? 18 :
      ((frontComplete && empty(10)) || (backComplete && empty(1))) ? 9 : 0;
    if (!holesPlayed || new Set(recordedHoles.map((hole) => hole.hole)).size !== recordedHoles.length ||
        recordedHoles.some((hole) => !Number.isInteger(hole.hole) || hole.hole < 1 || hole.hole > 18)) {
      reject(`${name}: tarjeta incompleta o con hoyos duplicados.`);
    }
    if (recordedHoles.some((hole) => isBlank(hole) && hole.ohYes)) reject(`${name}: Oh yes en un hoyo sin jugar.`);
    const holes = recordedHoles.filter((hole) => !isBlank(hole));
    if (holes.some((hole) => hole.par !== metadata.find((meta) => meta.hole === hole.hole)?.par)) reject(`${name}: el par no coincide con su salida.`);
    if (holes.some((hole) => typeof hole.ohYes !== "boolean")) reject(`${name}: hay hoyos sin registro de Oh yes.`);
    if (holes.some((hole) => hole.ohYes && metadata.find((meta) => meta.hole === hole.hole)?.par !== 3)) reject(`${name}: Oh yes fuera de un par 3.`);
    // Full saved course handicap, including negative handicaps and values above 28.
    const net = Object.fromEntries(metadata.filter((meta) => holes.some((hole) => hole.hole === meta.hole)).map((meta) => {
      const strokes = holes.find((hole) => hole.hole === meta.hole)?.strokes;
      const allowance = Math.floor(card.courseHandicap / 18) +
        (meta.handicap <= ((card.courseHandicap % 18) + 18) % 18 ? 1 : 0);
      return [meta.hole, strokes - allowance];
    }));
    prepared.push({ playerId, name, teeName, courseHandicap: card.courseHandicap, metadata, net, holes,
      holesPlayed, frontComplete, backComplete, feeCents: holesPlayed === 9 ? 15000 : feeCents });
  }
  for (const hole of duplicateOhYesHoles(scorecards)) reject(`Hoyo ${hole}: más de un ganador de Oh yes.`);
  const layouts = new Set(prepared.map((row) => JSON.stringify([...row.metadata].sort((a, b) => a.hole - b.hole).map((hole) => [hole.par, hole.handicap]))));
  if (layouts.size > 1) reject("Las salidas tienen distintos pares o ventajas; requiere definir el orden común de desempate.");
  const paidPlayers = new Set(playerIds);
  if (payments.some((payment) => !paidPlayers.has(id(payment.from)) || !paidPlayers.has(id(payment.to)) || !Number.isFinite(payment.amount))) reject("Los pagos históricos contienen jugadores o importes incompatibles.");
  if (reasons.length) return { ...base, eligible: false, reasons: [...new Set(reasons)] };

  const awards = [];
  for (const row of prepared) {
    for (const hole of row.holes.filter((hole) => hole.ohYes)) {
      awards.push({ key: `ohYes:${hole.hole}`, label: `Oh yes · hoyo ${hole.hole}`, winners: [row.playerId], steps: [] });
    }
  }
  for (const [key, label, start, end] of [["front", "Medal primera vuelta", 1, 9], ["back", "Medal segunda vuelta", 10, 18], ["match", "Match", 1, 18]]) {
    const contestants = prepared.filter((row) => key === "front" ? row.frontComplete : key === "back" ? row.backComplete : row.holesPlayed === 18);
    if (contestants.length === 0) continue;
    const totals = contestants.map((row) => ({ row, total: Array.from({ length: end - start + 1 }, (_, i) => row.net[start + i]).reduce((a, b) => a + b, 0) }));
    const best = Math.min(...totals.map((entry) => entry.total));
    let tied = totals.filter((entry) => entry.total === best).map((entry) => entry.row);
    const initialTied = tied.map((row) => row.playerId);
    const steps = [];
    const order = prepared[0].metadata.filter((hole) => hole.hole >= start && hole.hole <= end).sort((a, b) => a.handicap - b.handicap);
    for (const hole of order) {
      if (tied.length === 1) break;
      const scores = tied.map((row) => ({ playerId: row.playerId, net: row.net[hole.hole] }));
      const min = Math.min(...scores.map((score) => score.net));
      tied = tied.filter((row) => row.net[hole.hole] === min);
      steps.push({ hole: hole.hole, advantage: hole.handicap, scores });
    }
    awards.push({ key, label, total: best, initialTied, winners: tied.map((row) => row.playerId), steps });
  }
  const poolCents = prepared.reduce((sum, row) => sum + row.feeCents, 0);
  const gcd = (a, b) => b === 0n ? a : gcd(b, a % b);
  const unitScale = awards.reduce((scale, award) => {
    const count = BigInt(award.winners.length);
    return scale * count / gcd(scale, count);
  }, 1n);
  const unitsFor = (playerId) => awards.reduce((sum, award) => sum +
    (award.winners.includes(playerId) ? unitScale / BigInt(award.winners.length) : 0n), 0n);
  const rows = distribute(poolCents, prepared.map((row) => ({
    playerId: row.playerId, name: row.name, teeName: row.teeName, courseHandicap: row.courseHandicap,
    holesPlayed: row.holesPlayed, feeCents: row.feeCents,
    ohYes: row.holes.filter((hole) => hole.ohYes).length,
    frontNet: row.frontComplete ? Object.entries(row.net).filter(([hole]) => Number(hole) <= 9).reduce((sum, [, net]) => sum + net, 0) : null,
    backNet: row.backComplete ? Object.entries(row.net).filter(([hole]) => Number(hole) > 9).reduce((sum, [, net]) => sum + net, 0) : null,
    units: unitsFor(row.playerId),
    shares: Number(unitsFor(row.playerId)) / Number(unitScale),
  }))).map(({ remainder, ...row }) => {
    const oldNetCents = payments.reduce((sum, payment) => sum +
      (id(payment.to) === row.playerId ? Math.round(payment.amount * 100) : 0) -
      (id(payment.from) === row.playerId ? Math.round(payment.amount * 100) : 0), 0);
    const netCents = row.prizeCents - row.feeCents;
    return { ...row, netCents, oldNetCents, differenceCents: netCents - oldNetCents };
  });
  return { ...base, eligible: true, feeCents, poolCents, shares: awards.length, awards, rows };
}

export function buildPoolReport({ rounds, scorecards, payments, feeCents }) {
  const results = rounds.map((round) => simulatePoolRound({
    round, feeCents,
    scorecards: scorecards.filter((card) => id(card.round) === id(round)),
    payments: payments.filter((payment) => id(payment.round) === id(round)),
  }));
  const included = results.filter((round) => round.eligible);
  const accumulated = new Map();
  for (const round of included) for (const row of round.rows) {
    const current = accumulated.get(row.playerId) || { playerId: row.playerId, name: row.name, roundsCount: 0, feeCents: 0, prizeCents: 0, netCents: 0, oldNetCents: 0, differenceCents: 0 };
    current.roundsCount += 1;
    for (const key of ["feeCents", "prizeCents", "netCents", "oldNetCents", "differenceCents"]) current[key] += row[key];
    accumulated.set(row.playerId, current);
  }
  return { feeCents, rounds: included, excluded: results.filter((round) => !round.eligible), rows: [...accumulated.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
