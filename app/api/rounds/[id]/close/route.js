import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectDb from "@/lib/db";
import { createRequire } from "module";
import Round from "@/lib/models/Round";
import Scorecard from "@/lib/models/Scorecard";
import Payment from "@/lib/models/Payment";
import User from "@/lib/models/User";
import Config from "@/lib/models/Config";
import { calculatePayments } from "@/lib/scoring";
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
    const holeHandicaps =
      fallbackTee?.holes?.map((hole, idx) => ({
        hole: idx + 1,
        handicap: hole.handicap,
        par: hole.par,
      })) || [];

    const holeHandicapsByPlayer = {};
    const populatedScorecards = await Scorecard.find({ round: round._id })
      .populate("player", "-passwordHash")
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
      holeHandicapsByPlayer[card.player?._id?.toString()] =
        tee?.holes?.map((hole, idx) => ({
          hole: idx + 1,
          handicap: hole.handicap,
          par: hole.par,
        })) || holeHandicaps;
    });

    const calculated = calculatePayments({
      config: config || { bets: round.configSnapshot },
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

  const participants = await User.find({
    _id: { $in: Array.from(new Set(round.players || [])) },
  });
  const summaryLines = participants.map((player) => {
    const amount = summary[String(player._id)] || 0;
    const sign = amount >= 0 ? "+" : "-";
    return `- ${player.name}: ${sign}$${Math.abs(amount)}`;
  });
  const transfersLines = optimizedTransfers.map((transfer) => {
    const from = participants.find(
      (player) => String(player._id) === String(transfer.from)
    );
    const to = participants.find(
      (player) => String(player._id) === String(transfer.to)
    );
    return `- ${from?.name || "Jugador"} -> ${to?.name || "Jugador"}: $${transfer.amount}`;
  });
  const messageTitle = "⛳*La muerte lenta*⛳";
  const randomMessage = `☠️ ${SARCASTIC_MESSAGES[Math.floor(Math.random() * SARCASTIC_MESSAGES.length)]} ☠️`;
  const whatsappMessage = [
    messageTitle,
    "",
    randomMessage,
    "",
    "Resumen de ganancias: 🤑",
    ...summaryLines,
    "",
    "Pagos directos: 💰 ",
    ...(transfersLines.length ? transfersLines : ["- Sin movimientos"]),
  ].join("\n");

  console.log('Inicia mensajes de pagos')
  await Promise.allSettled(
    participants.map((player) => sendMessage(player.phone, whatsappMessage))
  );

  round.status = "closed";
  round.endedAt = new Date();
  await round.save();

  return NextResponse.json({ ok: true, summary, optimizedTransfers });
}
