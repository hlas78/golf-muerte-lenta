import { WELCOME_MESSAGES } from "./welcomeMessages.js";

export function buildWelcomeMessage({
  campo,
  creatorName,
  description,
  recordLink,
  startedAt,
}) {
  console.log(`Building welcome message for ${campo}`)
  const template =
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  console.log('template:', template) 
  const lines = [template.replace("{campo}", campo)];
  console.log('lines 1: ', lines)
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
    }
  }
  if (creatorName) {
    lines.push(`${creatorName} te invitó a la jugada ${description?description:''}\n`);
  }
  if (recordLink) {
    lines.push(`Entra aquí para editar tu tarjeta de esta jugada: ${recordLink}`);
  }
  return lines.join("\n");
}
