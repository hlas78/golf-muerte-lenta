import { WELCOME_MESSAGES } from "./welcomeMessages.js";

export function buildWelcomeMessage({
  campo,
  creatorName,
  description,
  recordLink,
  startedAt,
  groupLabel,
  teeName,
  courseHandicap,
}) {
  const template =
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  const lines = [template.replace("{campo}", campo)];
  if (startedAt) {
    const date = new Date(startedAt);
    if (!Number.isNaN(date.getTime())) {
      const formatted = date.toLocaleString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      });
      lines.push(`\nInicio: ${formatted}\n`);
      if (teeName || courseHandicap != null) {
        const details = [];
        if (groupLabel) {
          details.push("Sales en el")
          details.push(`${groupLabel},`);
        }
        if (teeName) {
          details.push(`de ${teeName},`);
        }
        if (courseHandicap != null && courseHandicap !== "") {
          details.push(`con handicap ${courseHandicap}.`);
        }
        lines.push(details.join(" "));
      }
      // lines.push(
      //   'Puedes verificar tu handicap con la función "Handicap Lookup" del Grint, seleccionando campo y salida".\n'
      // );
    }
  }
  // if (creatorName) {
  //   lines.push(
  //     `${creatorName} te invitó a la jugada ${description ? description : ""}\n`
  //   );
  // }
  if (recordLink) {
    lines.push(`Entra aquí para editar tu tarjeta de esta jugada: ${recordLink}`);
  }
  return lines.join("\n");
}
