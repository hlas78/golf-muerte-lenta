import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { createRequire } from "module";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import Config from "@/lib/models/Config";
import {
  allocateStrokes,
  calculatePayments,
  getCourseHandicapForRound,
  normalizeHoleHandicaps,
} from "@/lib/scoring";
import { verifyToken } from "@/lib/auth";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

const SARCASTIC_MESSAGES = [
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
  "Si cobras, no seas tacaño. Si pagas, no llores.",
  "Resumen completo. La tarjeta no miente.",
  "Tus numeritos llegaron. Suerte con el grupo.",
  "El golf es cruel. Las cuentas tambien.",
  "Pagos listos. Que el sarcasmo te acompañe.",
  "Resumen listo. El que perdio invita las chelas.",
  "Si esperabas milagro, llego el resumen.",
  "La ronda termino. El banco empieza.",
  "Pagos calculados. A darle a las transferencias.",
  "Resumen final. Si te quejas, repite.",
  "Ya esta. Tus golpes valen dinero.",
  "Los numeros estan listos. Sin drama.",
  "Pagos listos. El green cobro su factura.",
  "Resumen: o cobras o pagas. Sencillo.",
  "Si ganaste, no presumas tanto.",
  "Si perdiste, practica putting.",
  "La estadistica gano. Tu no.",
  "El resumen no falla. Tu tal vez.",
  "Cuentas claras, putts oscuros.",
  "Pagos listos. El sarcasmo va incluido.",
  "Resumen listo. Ahora si, a pagar.",
  "La bola no perdona, el resumen tampoco.",
  "Cerrado el resumen. Abre la cartera.",
  "La ronda se fue, las deudas quedan.",
  "Resumen listo. Sigue sonriendo.",
  "Ya hay numeros. A ver quien desaparece.",
  "Pagos listos. El que falte paga doble.",
  "La verdad esta en el resumen.",
  "Cuentas listas. A transferir sin llorar.",
  "Resumen listo. Menos charla, mas pago.",
  "Pagos listos. Se acabo el misterio.",
  "La calculadora no perdona.",
  "Si cobras, invita el siguiente tee time.",
  "Resumen listo. Te debes a ti mismo mejorar.",
  "Pagos listos. Que Dios te agarre confesado.",
  "El green cobro. No discutimos.",
  "Resumen listo. Te tocara pagar o cobrar.",
  "Los numeros hablan. Tu responde con transferencias.",
  "Hoy fue golf, ahora es contabilidad.",
  "Resumen listo. No hay VAR.",
  "Pagos listos. Sin excusas.",
  "Cuentas listas. El sarcasmo es gratis.",
  "Resumen final. El resto es historia.",
  "Ya hay resumen. Disfruta el karma.",
  "El golf te dio una leccion. El resumen otra.",
  "Pagos listos. Respira y transfiere.",
  "Resumen listo. El que abandona paga doble.",
  "Si ganaste, no te confies. Si perdiste, tampoco.",
  "Las cuentas estan listas. Nadie se salva.",
  "Resumen listo. Ya puedes culpar al caddie.",
  "El resumen es sagrado. Lo demas es llorar.",
  "Pagos listos. Hoy no hay descuentos.",
  "Resumen listo. La tarjeta fue tu juez.",
  "Cuentas listas. Que empiece la cobranza.",
  "Pagos listos. Cierra la boca y abre la app.",
  "Resumen listo. No hay devoluciones.",
  "La ronda acabo. Las deudas empiezan.",
  "Pagos listos. Si no pagas, no juegas.",
  "Resumen listo. A pagar con sonrisa falsa.",
  "El resumen no negocia.",
  "Pagos listos. Se cancela la modestia.",
  "Resumen final. El que falte paga el doble.",
  "Cuentas listas. El green ya cobro.",
  "Pagos listos. Dale a transferir.",
  "Resumen listo. O cobras o lloras.",
  "Se acabo la ronda. Empieza el cobro.",
  "Pagos listos. Pon tu mejor cara.",
  "Resumen listo. Hoy no hay empate.",
  "Las cuentas no mienten. Tu si.",
  "Resumen listo. A pagar sin drama.",
  "Pagos listos. No hay reembolso.",
  "Resumen listo. El que perdio, paga.",
  "Cuentas listas. A transferir con orgullo herido.",
  "Pagos listos. La revancha sera otro dia.",
  "Resumen listo. Sin llorar en el club.",
  "Pagos listos. Hoy la suerte no te salvo.",
  "Resumen listo. Te espero en la caja.",
  "Cuentas listas. El sarcasmo es opcional.",
  "Pagos listos. Tu handicap no ayuda ahora.",
  "Resumen final. El banco manda.",
  "Pagos listos. A pagar con dignidad.",
  "Resumen listo. La bola no miente.",
  "Cuentas listas. Alguien paga seguro.",
  "Pagos listos. La paciencia no.",
  "Resumen listo. No hay apelacion.",
  "Cuentas listas. A ver si sales limpio.",
  "Pagos listos. El que cobra, sonrie.",
  "Resumen listo. El que paga, aprende.",
  "Pagos listos. A cerrar el tema.",
  "Resumen listo. El golf es bello, las cuentas no.",
  "Pagos listos. Nos vemos en la proxima.",
  "Resumen listo. Hoy se paga en serio.",
];

const ITEM_LABELS = {
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

const GROUP_ITEMS = new Set([
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

function buildSummary(payments) {
  const summary = {};
  payments.forEach((payment) => {
    const from = String(payment.from);
    const to = String(payment.to);
    summary[from] = (summary[from] || 0) - payment.amount;
    summary[to] = (summary[to] || 0) + payment.amount;
  });
  return summary;
}

function minimizeTransfers(summary) {
  const debtors = [];
  const creditors = [];
  Object.entries(summary).forEach(([playerId, amount]) => {
    if (amount < 0) {
      debtors.push({ playerId, amount: Math.abs(amount) });
    } else if (amount > 0) {
      creditors.push({ playerId, amount });
    }
  });

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({
        from: debtors[i].playerId,
        to: creditors[j].playerId,
        amount: pay,
      });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
    }
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  const actor = await User.findById(payload.id);
  if (!actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  const isSupervisor = actor.role === "admin" || actor.role === "supervisor";
  if (!isSupervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scorecards = await Scorecard.find({ round: round._id });
  const allAccepted =
    scorecards.length > 0 && scorecards.every((card) => card.accepted);
  if (!allAccepted) {
    return NextResponse.json(
      { error: "Faltan tarjetas por aceptar" },
      { status: 400 }
    );
  }

  let payments = await Payment.find({ round: round._id });
  if (payments.length === 0) {
    const config = await Config.findOne({ key: "global" });
    const tees = round.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const fallbackTee =
      allTees.find((option) => option.tee_name === round.teeName) ||
      allTees[0];
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
    const populatedScorecards = await Scorecard.find({ round: round._id })
      .populate(
        "player",
        "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted"
      )
      .sort({ createdAt: 1 });
    populatedScorecards.forEach((card) => {
      const playerTee =
        card.teeName ||
        round.playerTees?.find(
          (entry) => String(entry.player) === String(card.player?._id)
        )?.teeName;
      const tee =
        allTees.find((option) => option.tee_name === playerTee) ||
        fallbackTee;
      const normalizedPlayerHoles = normalizeHoleHandicaps(
        tee?.holes || [],
        round
      );
      holeHandicapsByPlayer[card.player?._id?.toString()] =
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
      const strokesMap = allocateStrokes(
        courseHandicap,
        holeHandicapsByPlayer[card.player?._id?.toString()] || holeHandicaps,
        round.holes
      );
      const netTotal = (card.holes || []).slice(0, round.holes).reduce((sum, hole) => {
        const strokes = hole?.strokes || 0;
        return sum + (strokes - (strokesMap[hole.hole] || 0));
      }, 0);
      card.courseHandicap = courseHandicap;
      card.netTotal = netTotal;
    });

    await Promise.all(
      populatedScorecards.map((card) =>
        Scorecard.updateOne(
          { _id: card._id },
          { courseHandicap: card.courseHandicap, netTotal: card.netTotal }
        )
      )
    );

    const roundConfigSnapshot = round.configSnapshot;
    const roundConfig =
      roundConfigSnapshot && roundConfigSnapshot.bets
        ? roundConfigSnapshot
        : { bets: roundConfigSnapshot || config?.bets || {} };
    const calculated = calculatePayments({
      config: roundConfig,
      round,
      scorecards: populatedScorecards,
      holeHandicaps,
      holeHandicapsByPlayer,
    });
    await Payment.insertMany(
      calculated.map((payment) => ({
        ...payment,
        round: round._id,
      }))
    );
    payments = await Payment.find({ round: round._id });
  }

  const summary = buildSummary(payments);
  const optimizedTransfers = minimizeTransfers(summary);

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

  const populatedScorecards = await Scorecard.find({ round: round._id })
    .populate(
      "player",
      "-passwordHash -magicToken -magicTokenCreatedAt -grintPasswordEncrypted"
    )
    .sort({ createdAt: 1 });
  const holeHandicapsByPlayer = {};
  const courseHandicapByPlayer = {};
  const strokesByPlayerHole = {};
  let minCourseHandicap = Number.POSITIVE_INFINITY;

  populatedScorecards.forEach((card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) {
      return;
    }
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
    if (!playerId) {
      return;
    }
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

  const participants = await User.find({
    _id: { $in: Array.from(new Set(round.players || [])) },
  });
  const messageTitle = "⛳*La muerte rápida*⛳";
  const randomMessage = `☠️ ${SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)]} ☠️`;
  const getNetForItem = (playerId, item) => {
    const netTotals = netTotalsByPlayer[playerId];
    if (!netTotals) {
      return null;
    }
    if (item === "medalFront") return netTotals.front;
    if (item === "medalBack") return netTotals.back;
    if (item === "match") return netTotals.match;
    return null;
  };

  const buildNetExtra = (playerId, item) => {
    const net = getNetForItem(playerId, item);
    return Number.isFinite(net) ? `· Net ${net}` : "";
  };

  const groupPayments = payments.filter((payment) =>
    GROUP_ITEMS.has(payment.item)
  );
  const culebraPayments = payments.filter(
    (payment) => payment.item === "culebra"
  );
  const individualPayments = payments.filter(
    (payment) => !GROUP_ITEMS.has(payment.item) && payment.item !== "culebra"
  );
  const groupedIndividual = individualPayments.reduce((acc, payment) => {
    const noteKey = payment.note ? `bet:${payment.note}` : null;
    const fallbackKey = [String(payment.from), String(payment.to)]
      .sort()
      .join("-");
    const key = noteKey || `pair:${fallbackKey}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(payment);
    return acc;
  }, {});

  const buildGroupedWinsByPlayer = (blockPayments) =>
    blockPayments.reduce((acc, payment) => {
      const toId = String(payment.to);
      const label = ITEM_LABELS[payment.item] || payment.item;
      let holeLabel = payment.hole ? ` Hoyo ${payment.hole}` : "";
      if (payment.item == 'holeWinner')
        holeLabel = payment.hole ? ` ${payment.hole}` : "";
      const key = `${label}${holeLabel ? ` ${holeLabel}` : ""}`;
      if (!acc[toId]) {
        acc[toId] = {};
      }
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
        if (netExtra) {
          entry.extra = netExtra;
        }
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
        const nameA = bet ? participants.find((p) => String(p._id) === String(bet.playerA))?.name : null;
        const nameB = bet ? participants.find((p) => String(p._id) === String(bet.playerB))?.name : null;
        const title = nameA && nameB ? `Raya individual: ${nameA} vs ${nameB}` : "Raya individual";
        return { title, payments: blockPayments };
      }
      return { title: "Raya individual", payments: blockPayments };
    }),
  ];

  await Promise.allSettled(
    participants.map((player) => {
      const playerId = String(player._id);
      const messages = [];
      betBlocks.forEach((block) => {
        const wins = block.payments.filter(
          (payment) => String(payment.to) === playerId
        );
        const losses = block.payments.filter(
          (payment) => String(payment.from) === playerId
        );
        if (wins.length === 0 && losses.length === 0) {
          return;
        }
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

        const lossTotal = losses.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );
        const lossLines = losses.length
          ? losses.map((payment) => {
              const label = ITEM_LABELS[payment.item];
              let holeLabel = payment.hole ? `Hoyo ${payment.hole}` : "";
              if (payment.item == 'holeWinner')
                holeLabel = payment.hole ? ` ${payment.hole}` : "";
              const extras = [];
              if (payment.item === "holeWinner" && payment.hole) {
                const loserStrokes =
                  strokesByPlayerHole?.[playerId]?.[payment.hole];
                const winnerStrokes =
                  strokesByPlayerHole?.[String(payment.to)]?.[payment.hole];
                if (Number.isFinite(winnerStrokes)) {
                  extras.push(`. ${winnerStrokes}`);
                }
                if (Number.isFinite(loserStrokes)) {
                  extras.push(`vs ${loserStrokes}`);
                }
              }
              if (["medalFront", "medalBack", "match"].includes(payment.item)) {
                const winnerNet = getNetForItem(
                  String(payment.to),
                  payment.item
                );
                const loserNet = getNetForItem(playerId, payment.item);
                if (Number.isFinite(winnerNet)) {
                  extras.push(`. ${winnerNet} vs `);
                }
                if (Number.isFinite(loserNet)) {
                  extras.push(`${loserNet}`);
                }
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
        messages.push(whatsappMessage);
      });
      return Promise.allSettled(
        messages.map((message) => {
          sendMessage(player.phone, message.replace('Hoyo Hoyo', 'Hoyo'));
        })
      );
    })
  );

  round.status = "closed";
  round.endedAt = new Date();
  await round.save();

  return NextResponse.json({ ok: true, summary, optimizedTransfers });
}
