import { WELCOME_MESSAGES } from "./welcomeMessages.js";

export function buildWelcomeAccess(round, player, token) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
  }
  const groupNumber =
    round?.playerGroups?.find(
      (entry) => String(entry.player) === String(player?._id)
    )?.group || null;
  const isSupervisor =
    player?.role === "admin" || player?.role === "supervisor";
  const isMarshalForGroup = Boolean(
    groupNumber &&
      round?.groupMarshals?.some(
        (entry) =>
          Number(entry.group) === Number(groupNumber) &&
          String(entry.player) === String(player?._id)
      )
  );
  const pathname =
    isSupervisor || isMarshalForGroup
      ? `/rounds/${round?._id}/record-multi`
      : `/rounds/${round?._id}`;

  return {
    recordLink: `${baseUrl}${pathname}?${params.toString()}`,
    linkText:
      isSupervisor || isMarshalForGroup
        ? "capturar tu grupo"
        : "ver tu tarjeta de la jugada",
  };
}

export function buildWelcomeMessage({
  campo,
  creatorName,
  description,
  recordLink,
  linkText,
  startedAt,
  groupLabel,
  teeName,
  courseHandicap,
  grintDaysOutOfDate,
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
          details.push(`Sales en el grupo ${groupLabel} de ${teeName}, con handicap ${courseHandicap}.`);
        } else {
          details.push(`Sales de ${teeName}, con handicap ${courseHandicap}.`);
        }
        lines.push(details.join(" "));
        lines.push("")
      }
      lines.push(
        'Puedes verificar tu handicap con la función "Handicap Lookup" de la aplicación "The Grint".'
      );
      if (Number(grintDaysOutOfDate) > 15) {
        lines.push(
          `Llevas ${Number(grintDaysOutOfDate)} días sin registrar jugadas en Grint, recuerda que se deben registrar para actualizar correctamente los handicaps.`
        );
      }
      lines.push("");
    }
  }
  // if (creatorName) {
  //   lines.push(
  //     `${creatorName} te invitó a la jugada ${description ? description : ""}\n`
  //   );
  // }
  if (recordLink) {
    lines.push(
      `Entra aquí para ${linkText || "ver la jugada"}: ${recordLink}`
    );
  }
  return lines.join("\n");
}
