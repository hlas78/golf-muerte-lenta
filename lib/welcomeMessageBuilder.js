import { WELCOME_MESSAGES } from "./welcomeMessages";

export function buildWelcomeMessage({
  campo,
  creatorName,
  description,
  recordLink,
}) {
  const template =
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
  const lines = [template.replace("{campo}", campo)];
  if (creatorName) {
    lines.push(`${creatorName} te invitó a la jugada ${description?description:''}`);
  }
  if (recordLink) {
    lines.push(`Entra aquí para editar tu tarjeta de esta jugada: ${recordLink}`);
  }
  return lines.join("\n");
}
