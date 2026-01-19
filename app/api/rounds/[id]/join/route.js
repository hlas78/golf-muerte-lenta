import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRequire } from "module";
import connectDb from "@/lib/db";
import Round from "@/lib/models/Round";
import User from "@/lib/models/User";
import { verifyToken } from "@/lib/auth";

const require = createRequire(import.meta.url);
const { sendMessage } = require("@/scripts/sendMessage");

const WELCOME_MESSAGES = [
  "¡Bienvenido al field! {campo} te espera. ⛳️😎",
  "Entraste a {campo}. No hay devoluciones. 🏌️‍♂️🔥",
  "Nuevo en {campo}. Que los putts te acompañen. 🙏⛳️",
  "Te sumaste en {campo}. Prometemos sarcasmo. 😏⛳️",
  "Confirmado en {campo}. Respira y cobra. 💸⛳️",
  "A {campo} se viene a sudar. ¡Dale! 💪⛳️",
  "Bienvenido a {campo}. Hoy hay cuentas. 🧾⛳️",
  "Ya estás en {campo}. Que ruede la bola. 🏌️‍♂️🎯",
  "Ingreso exitoso a {campo}. ¡A romperla! 🔥⛳️",
  "En {campo} ya te esperaban. O eso dicen. 😅⛳️",
  "Te agregaron a {campo}. Cero presión. 😬⛳️",
  "A {campo} con actitud. ¡Vamos! 😎⛳️",
  "Te tenemos en {campo}. Buen golpe o buen meme. 🏌️‍♂️😂",
  "Bienvenido a {campo}. La tarjeta observa. 👀⛳️",
  "Entraste a {campo}. Sin excusas. 💥⛳️",
  "En {campo} hay gloria y deudas. 💰⛳️",
  "Listo para {campo}. Que no te coma el green. 🏌️‍♂️🌿",
  "Se te apunta en {campo}. ¡Dale con todo! 🔥⛳️",
  "Nuevo jugador en {campo}. Suerte, campeón. 🏆⛳️",
  "Ya estás en {campo}. El resto es historia. 📜⛳️",
  "Llegaste a {campo}. A ver esos swings. 🏌️‍♂️✨",
  "Confirmado en {campo}. No llores por el rough. 🌾😅",
  "En {campo} las cuentas son reales. 💳⛳️",
  "Bienvenido a {campo}. El putter manda. 🧲⛳️",
  "A {campo} se viene a jugar. 🏌️‍♂️💥",
  "Entraste a {campo}. El sarcasmo ya viene. 😏⛳️",
  "Ya estás en {campo}. ¡A facturar! 💸⛳️",
  "Ingreso a {campo}. No hay marcha atrás. 🏁⛳️",
  "En {campo} te esperamos. Con ganas y memes. 😂⛳️",
  "Te sumaste en {campo}. ¡Qué empiece el show! 🎬⛳️",
  "Nuevo en {campo}. No te pierdas. 🧭⛳️",
  "Bienvenido a {campo}. El green es juez. ⚖️⛳️",
  "En {campo} ya estás listo. 😎⛳️",
  "Entraste a {campo}. Golpea con estilo. 🎩⛳️",
  "Te agregaron a {campo}. A darle. 💥⛳️",
  "Confirmado en {campo}. Que no falte el birdie. 🐦⛳️",
  "A {campo} con todo. 🏌️‍♂️🚀",
  "Bienvenido a {campo}. La suerte se gana. 🍀⛳️",
  "Ya estás en {campo}. ¡A jugar fino! 🎯⛳️",
  "En {campo} no hay excusas. 😅⛳️",
  "Entraste a {campo}. El resto es pagar o cobrar. 💸⛳️",
  "Listo para {campo}. Que el swing sea contigo. 🏌️‍♂️✨",
  "Nuevo jugador en {campo}. ¡A ponerlo! 🔥⛳️",
  "Te sumaste a {campo}. Cuidate del bunker. 🏖️⛳️",
  "Confirmado en {campo}. A sudar la gota. 💦⛳️",
  "En {campo} ya estás. Buenas vibras. ✨⛳️",
  "Bienvenido a {campo}. Aquí se viene a ganar. 🏆⛳️",
  "Entraste a {campo}. ¡Golpea y sonríe! 😁⛳️",
  "A {campo} sin miedo. 🦁⛳️",
  "Ya estás en {campo}. ¡Dale con todo! 💪⛳️",
  "En {campo} el putt no perdona. 🧲⛳️",
  "Confirmado en {campo}. El green te espera. 🌿⛳️",
  "Nuevo en {campo}. El ego se queda en casa. 😅⛳️",
  "Te sumaste a {campo}. ¡Que ruede la bola! 🏌️‍♂️🎯",
  "Bienvenido a {campo}. A ver esos golpes. 👊⛳️",
  "En {campo} ya estás. No faltes. ⏰⛳️",
  "Entraste a {campo}. Ya puedes presumir. 😎⛳️",
  "Confirmado en {campo}. Se vienen las cuentas. 🧾⛳️",
  "A {campo} con buena vibra. ✌️⛳️",
  "Te agregaron a {campo}. Hazlo épico. 🎖️⛳️",
  "Bienvenido a {campo}. A ver si hoy sí. 😅⛳️",
  "Nuevo en {campo}. El green es tuyo. 🌿⛳️",
  "Ya estás en {campo}. Sin drama. 😌⛳️",
  "En {campo} hay juego. ¡Dale! 🏌️‍♂️🔥",
  "Confirmado en {campo}. A por el birdie. 🐦⛳️",
  "Te sumaste en {campo}. ¡A romperla! 💥⛳️",
  "Bienvenido a {campo}. Donde mandan los putts. 🧲⛳️",
  "Entraste a {campo}. ¡Que empiece la fiesta! 🎉⛳️",
  "En {campo} no hay límites. 🏌️‍♂️🚀",
  "Ya estás en {campo}. A cobrar. 💸⛳️",
  "Confirmado en {campo}. El rough no perdona. 🌾⛳️",
  "A {campo} con puntería. 🎯⛳️",
  "Te agregaron a {campo}. ¡Listo! ✅⛳️",
  "Bienvenido a {campo}. Swing o muerte lenta. 😈⛳️",
  "Nuevo en {campo}. Que la suerte te encuentre. 🍀⛳️",
  "En {campo} ya estás. Buen golf. ⛳️🙌",
  "Confirmado en {campo}. Sin excusas. 🧾⛳️",
  "Ya estás en {campo}. El driver manda. 🏌️‍♂️💥",
  "Te sumaste a {campo}. ¡A jugar elegante! 🎩⛳️",
  "Bienvenido a {campo}. El putter es juez. ⚖️⛳️",
  "En {campo} te esperamos. 😎⛳️",
  "Entraste a {campo}. La presión es real. 😬⛳️",
  "Confirmado en {campo}. A ver esos golpes finos. ✨⛳️",
  "Nuevo en {campo}. Sin miedo al agua. 💦⛳️",
  "Te agregaron a {campo}. ¡A jugar! 🏌️‍♂️🔥",
  "Bienvenido a {campo}. Que el score te acompañe. 📈⛳️",
  "En {campo} ya estás. Todo listo. ✅⛳️",
  "Entraste a {campo}. La bola no miente. ⚪️⛳️",
  "Confirmado en {campo}. A romperla. 💥⛳️",
  "Te sumaste en {campo}. ¡Dale con flow! 🕺⛳️",
  "Nuevo en {campo}. Hoy se paga o se cobra. 💳⛳️",
  "Bienvenido a {campo}. El green te juzga. 👀⛳️",
  "En {campo} no hay descanso. 🏌️‍♂️⚡️",
  "Entraste a {campo}. ¡A darle swing! 🏌️‍♂️✨",
  "Confirmado en {campo}. Buenas vibras. ✨⛳️",
  "Te agregaron a {campo}. Todo listo para la batalla. ⚔️⛳️",
  "Nuevo en {campo}. A hacer historia. 📜⛳️",
  "Bienvenido a {campo}. La cuenta llega luego. 🧾⛳️",
  "En {campo} ya estás. A darle. 💪⛳️",
  "Entraste a {campo}. Que el birdie te encuentre. 🐦⛳️",
  "Confirmado en {campo}. A ver ese short game. 🎯⛳️",
  "Te sumaste a {campo}. El sarcasmo es gratis. 😏⛳️",
  "Nuevo en {campo}. El bunker te observa. 🏖️⛳️",
  "Bienvenido a {campo}. Hoy no se perdona. 😅⛳️",
  "En {campo} ya estás. Listo el guante. 🧤⛳️",
  "Entraste a {campo}. A jugar con clase. 👔⛳️",
  "Confirmado en {campo}. La ronda empieza. 🏁⛳️",
  "Te agregaron a {campo}. El resto es suerte. 🍀⛳️",
  "Nuevo en {campo}. A ver si hoy no hay triple. 😬⛳️",
  "Bienvenido a {campo}. El green manda. 🌿⛳️",
  "En {campo} ya estás. A ponerle. 🔥⛳️",
  "Entraste a {campo}. ¡Suerte y putts! 🏌️‍♂️🧲",
  "Confirmado en {campo}. A disfrutar el dolor. 😅⛳️",
  "Te sumaste a {campo}. La gloria te espera. 🏆⛳️",
  "Nuevo en {campo}. El driver decide. 🏌️‍♂️💥",
  "Bienvenido a {campo}. Las cuentas son reales. 🧾⛳️",
  "En {campo} ya estás. A darle duro. 💥⛳️",
  "Entraste a {campo}. El que falla paga. 💸⛳️",
  "Confirmado en {campo}. Sin llorar. 😅⛳️",
  "Te agregaron a {campo}. Hoy toca sufrir bonito. 😎⛳️",
  "Nuevo en {campo}. Que no te coma el rough. 🌾⛳️",
  "Bienvenido a {campo}. La bola manda. ⚪️⛳️",
  "En {campo} ya estás. A facturar. 💸⛳️",
  "Entraste a {campo}. Si cobras, invita. 🍻⛳️",
  "Confirmado en {campo}. El score no perdona. 📉⛳️",
  "Te sumaste a {campo}. A romper la racha. 🔥⛳️",
  "Nuevo en {campo}. El putter manda. 🧲⛳️",
  "Bienvenido a {campo}. La revancha empieza. 🔁⛳️",
  "En {campo} ya estás. A sudar. 💦⛳️",
  "Entraste a {campo}. Que el sarcasmo te abrace. 😏⛳️",
  "Confirmado en {campo}. Aquí se viene a jugar. 🏌️‍♂️🔥",
  "Te agregaron a {campo}. El green te mira. 👀⛳️",
  "Nuevo en {campo}. El score se escribe solo. 📝⛳️",
  "Bienvenido a {campo}. A ver esos tiros. 🎯⛳️",
  "En {campo} ya estás. A ponerla en fairway. 🌿⛳️",
  "Entraste a {campo}. El que falla, paga. 💸⛳️",
  "Confirmado en {campo}. A darle sin miedo. 💪⛳️",
  "Te sumaste a {campo}. La suerte te guiara. 🍀⛳️",
  "Nuevo en {campo}. Que no falte el birdie. 🐦⛳️",
  "Bienvenido a {campo}. Se vienen las cuentas. 🧾⛳️",
  "En {campo} ya estás. A ver si hoy no hay agua. 💦⛳️",
  "Entraste a {campo}. El green te espera. 🌿⛳️",
  "Confirmado en {campo}. El juego empieza ya. 🏁⛳️",
  "Te agregaron a {campo}. A jugar con clase. 🎩⛳️",
  "Nuevo en {campo}. Que los putts no te traicionen. 🧲⛳️",
  "Bienvenido a {campo}. El driver decide tu destino. 🏌️‍♂️💥",
  "En {campo} ya estás. A brillar. ✨⛳️",
  "Entraste a {campo}. La bolsa pesa menos si cobras. 💸⛳️",
  "Confirmado en {campo}. A jugar con orgullo herido. 😅⛳️",
  "Te sumaste a {campo}. ¡A por el match! 🏆⛳️",
  "Nuevo en {campo}. La tarjeta te observa. 👀⛳️",
  "Bienvenido a {campo}. El que pierde paga. 💳⛳️",
  "En {campo} ya estás. A por el green. 🌿⛳️",
  "Entraste a {campo}. Sin excusas, sin dramas. 😎⛳️",
  "Confirmado en {campo}. A disfrutar la ronda. 🎯⛳️",
  "Te agregaron a {campo}. El resto es sudar. 💦⛳️",
  "Nuevo en {campo}. Que no te agarre el sand trap. 🏖️⛳️",
  "Bienvenido a {campo}. A jugar fino. ✨⛳️",
  "En {campo} ya estás. A demostrar. 💪⛳️",
  "Entraste a {campo}. La suerte no se compra. 🍀⛳️",
  "Confirmado en {campo}. Ponlo en el fairway. 🌿⛳️",
  "Te sumaste a {campo}. La gloria o la deuda. 💸⛳️",
  "Nuevo en {campo}. A ver si hoy no hay triple. 😅⛳️",
  "Bienvenido a {campo}. El green dicta sentencia. ⚖️⛳️",
  "En {campo} ya estás. A romperla. 🔥⛳️",
  "Entraste a {campo}. El putt manda. 🧲⛳️",
  "Confirmado en {campo}. A jugar con estilo. 🎩⛳️",
  "Te agregaron a {campo}. Que no falte el swing. 🏌️‍♂️✨",
  "Nuevo en {campo}. El score te espera. 📈⛳️",
  "Bienvenido a {campo}. El dolor es temporal. 😅⛳️",
  "En {campo} ya estás. A cobrar o pagar. 💸⛳️",
  "Entraste a {campo}. El sarcasmo va incluido. 😏⛳️",
  "Confirmado en {campo}. A jugar como si supieras. 😎⛳️",
  "Te sumaste a {campo}. El green es tu juez. 👀⛳️",
  "Nuevo en {campo}. A darle sin miedo. 💪⛳️",
  "Bienvenido a {campo}. El fairway es tu amigo. 🌿⛳️",
  "En {campo} ya estás. A sacarla del bunker. 🏖️⛳️",
  "Entraste a {campo}. El que gana cobra. 💸⛳️",
  "Confirmado en {campo}. A ver esos putts. 🧲⛳️",
  "Te agregaron a {campo}. A sufrir elegante. 🎩⛳️",
  "Nuevo en {campo}. Hoy se juega en serio. 🔥⛳️",
  "Bienvenido a {campo}. El green no perdona. 🌿⛳️",
  "En {campo} ya estás. A romperla con clase. 😎⛳️",
  "Entraste a {campo}. La ronda te espera. 🏁⛳️",
  "Confirmado en {campo}. A cobrar sin culpa. 💸⛳️",
  "Te sumaste a {campo}. Que no falte el birdie. 🐦⛳️",
  "Nuevo en {campo}. La bola decide. ⚪️⛳️",
  "Bienvenido a {campo}. El driver te juzga. 🏌️‍♂️💥",
  "En {campo} ya estás. El score se escribe solo. 📝⛳️",
  "Entraste a {campo}. Sin miedo al green. 🌿⛳️",
  "Confirmado en {campo}. Que la suerte te encuentre. 🍀⛳️",
  "Te agregaron a {campo}. Hoy no hay excusas. 😬⛳️",
  "Nuevo en {campo}. A ver si hoy hay putts. 🧲⛳️",
  "Bienvenido a {campo}. A jugar con todo. 💥⛳️",
  "En {campo} ya estás. A darle al swing. 🏌️‍♂️✨",
  "Entraste a {campo}. El que falla paga. 💳⛳️",
  "Confirmado en {campo}. El juego ya empezó. 🏁⛳️",
  "Te sumaste a {campo}. El green espera tu magia. ✨⛳️",
  "Nuevo en {campo}. A romperla sin llorar. 😅⛳️",
  "Bienvenido a {campo}. El fairway no muerde. 🌿⛳️",
  "En {campo} ya estás. A jugar con alma. 🔥⛳️",
  "Entraste a {campo}. A cobrar o a llorar. 💸😅",
  "Confirmado en {campo}. El score te mira. 👀⛳️",
  "Te agregaron a {campo}. ¡A darle fuerte! 💪⛳️",
  "Nuevo en {campo}. El green dicta sentencia. ⚖️⛳️",
  "Bienvenido a {campo}. Que el birdie te encuentre. 🐦⛳️",
  "En {campo} ya estás. A por el match. 🏆⛳️",
  "Entraste a {campo}. La ronda es tuya. 😎⛳️",
  "Confirmado en {campo}. A disfrutar el juego. 🎯⛳️",
  "Te sumaste a {campo}. El sarcasmo te espera. 😏⛳️",
  "Nuevo en {campo}. El putter manda tu destino. 🧲⛳️",
  "Bienvenido a {campo}. A sudar la camiseta. 💦⛳️",
  "En {campo} ya estás. El rough no perdona. 🌾⛳️",
  "Entraste a {campo}. A jugar con estilo. 🎩⛳️",
  "Confirmado en {campo}. Que no falte el swing. 🏌️‍♂️✨",
  "Te agregaron a {campo}. La deuda espera. 💳⛳️",
  "Nuevo en {campo}. A ver esos golpes finos. ✨⛳️",
  "Bienvenido a {campo}. El green ya te vio. 👀⛳️",
  "En {campo} ya estás. A facturar. 💸⛳️",
  "Entraste a {campo}. A ver si hoy si. 😅⛳️",
  "Confirmado en {campo}. A jugar sin miedo. 💪⛳️",
  "Te sumaste a {campo}. La bola te juzga. ⚪️⛳️",
  "Nuevo en {campo}. A ver si hoy cobras. 💸⛳️",
  "Bienvenido a {campo}. Que el green te respete. 🌿⛳️",
  "En {campo} ya estás. A ponerla en green. 🎯⛳️",
  "Entraste a {campo}. La ronda comienza. 🏁⛳️",
  "Confirmado en {campo}. A romperla. 🔥⛳️",
  "Te agregaron a {campo}. A ver si hoy no hay agua. 💦⛳️",
  "Nuevo en {campo}. El fairway te llama. 🌿⛳️",
  "Bienvenido a {campo}. El putt manda. 🧲⛳️",
  "En {campo} ya estás. A cobrar con sonrisa. 😁💸",
  "Entraste a {campo}. La suerte ya está asignada. 🍀⛳️",
  "Confirmado en {campo}. A darlo todo. 💥⛳️",
  "Te sumaste a {campo}. El green es tu casa. 🏡⛳️",
  "Nuevo en {campo}. A jugar serio. 🏌️‍♂️🔥",
  "Bienvenido a {campo}. El driver decide. 💥⛳️",
  "En {campo} ya estás. A ver esos swings. 🏌️‍♂️✨",
  "Entraste a {campo}. El rough te mira. 🌾⛳️",
  "Confirmado en {campo}. A jugar con calma. 😌⛳️",
  "Te agregaron a {campo}. El score espera. 📈⛳️",
  "Nuevo en {campo}. La gloria o la deuda. 💸⛳️",
  "Bienvenido a {campo}. Hoy se juega bonito. 🎯⛳️",
  "En {campo} ya estás. A dejar el alma. 🔥⛳️",
  "Entraste a {campo}. A por el birdie. 🐦⛳️",
  "Confirmado en {campo}. Que ruede la bola. ⚪️⛳️",
  "Te sumaste a {campo}. A disfrutar la ronda. 😎⛳️",
  "Nuevo en {campo}. El green manda. 🌿⛳️",
  "Bienvenido a {campo}. El score no perdona. 📉⛳️",
  "En {campo} ya estás. A ponerlo en green. 🎯⛳️",
  "Entraste a {campo}. A romper la racha. 🔥⛳️",
  "Confirmado en {campo}. Buen golf. ⛳️🙌",
  "Te agregaron a {campo}. A ver si hoy hay magia. ✨⛳️",
  "Nuevo en {campo}. El putter no miente. 🧲⛳️",
  "Bienvenido a {campo}. El juego te espera. 🏁⛳️",
];

export async function POST(request, { params }) {
  await connectDb();
  const cookieStore = await cookies();
  const token = cookieStore.get("gml_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authPayload = verifyToken(token);
  const payload = await request.json();
  const { id } = await params;
  const round = await Round.findById(id);
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (String(payload.playerId) !== String(authPayload.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const user = await User.findById(payload.playerId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (round.status === "closed") {
    return NextResponse.json({ error: "Round closed" }, { status: 400 });
  }
  if (user.handicap == null || user.handicap === 0) {
    return NextResponse.json(
      { error: "Handicap requerido" },
      { status: 400 }
    );
  }
  const teeName = payload.teeName;
  if (!teeName) {
    return NextResponse.json({ error: "Tee requerido" }, { status: 400 });
  }

  const tees = round.courseSnapshot?.tees || {};
  const allTees = [...(tees.male || []), ...(tees.female || [])];
  const validTee = allTees.some((option) => option.tee_name === teeName);
  if (!validTee) {
    return NextResponse.json({ error: "Tee invalido" }, { status: 400 });
  }

  const alreadyJoined = round.players.includes(payload.playerId);
  if (!alreadyJoined) {
    round.players.push(payload.playerId);
  }
  const existing = round.playerTees?.find(
    (entry) => String(entry.player) === String(payload.playerId)
  );
  if (existing) {
    existing.teeName = teeName;
  } else {
    round.playerTees = round.playerTees || [];
    round.playerTees.push({ player: payload.playerId, teeName });
  }
  round.status = "active";
  await round.save();
  if (!alreadyJoined) {
    const campo =
      round.courseSnapshot?.clubName || round.courseSnapshot?.courseName || "el campo";
    const template =
      WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    const message = template.replace("{campo}", campo);
    await sendMessage(user.phone, message);
  }
  return NextResponse.json({ ok: true });
}
