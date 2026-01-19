"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { getSocket } from "@/lib/socketClient";
import AppShell from "../../../components/AppShell";

const PENALTY_LABELS = {
  pinkies: "Pinkies",
  cuatriputt: "Cuatriputt",
  saltapatras: "Saltapatras",
  paloma: "Paloma",
  nerdina: "Nerdina",
};

const ITEM_LABELS = {
  holeWinner: "Ganador de hoyo",
  medal: "Ganador de medal",
  match: "Ganador de match",
  sandyPar: "Sandy par",
  birdie: "Birdie",
  eagle: "Aguila",
  albatross: "Albatross",
  holeOut: "Hole out",
  wetPar: "Wet par",
  ohYes: "Oh yes",
  sandyPar: "Sandy",
};

export default function ScorecardPage() {
  const params = useParams();
  const [round, setRound] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [viewMode, setViewMode] = useState("gross");
  const [me, setMe] = useState(null);
  const [summary, setSummary] = useState(null);
  const [settling, setSettling] = useState(false);
  const [allAccepted, setAllAccepted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [optimizedTransfers, setOptimizedTransfers] = useState([]);

  const holes = useMemo(
    () =>
      Array.from({ length: round?.holes || 9 }, (_, idx) => idx + 1),
    [round]
  );
  const frontHoles = useMemo(() => holes.slice(0, 9), [holes]);
  const backHoles = useMemo(() => holes.slice(9, 18), [holes]);

  const penaltyFeed = useMemo(() => {
    const items = [];
    scorecards.forEach((card) => {
      card.holes?.forEach((hole) => {
        if (Array.isArray(hole.penalties) && hole.penalties.length > 0) {
          hole.penalties.forEach((penalty) => {
            items.push({
              hole: hole.hole,
              player: card.player?.name || "Jugador",
              penalty: PENALTY_LABELS[penalty] || penalty,
            });
          });
        }
      });
    });
    return items;
  }, [scorecards]);

  const loadScorecards = () => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) => {
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : []);
        setAllAccepted(Boolean(data.allAccepted));
      })
      .catch(() => setScorecards([]));
  };

  useEffect(() => {
    const socket = getSocket();
    if (round?._id) {
      socket.emit("round:join", round._id);
    }
    socket.on("scorecard:update", () => {
      notifications.show({
        title: "Tarjeta actualizada",
        message: "Se recibio un nuevo registro de golpes.",
        color: "club",
      });
      loadScorecards();
    });

    return () => {
      socket.off("scorecard:update");
    };
  }, [round]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}`)
      .then((res) => res.json())
      .then((data) => setRound(data))
      .catch(() => setRound(null));
  }, [params]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setMe(data.user || null))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!round?._id) {
      return;
    }
    loadScorecards();
  }, [round]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}/summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch(() => setSummary(null));
  }, [params]);

  const canApprove =
    me?.role === "admin" ||
    (me?._id && round?.supervisor?._id === me._id);

  const isJoined = Boolean(
    me?._id &&
      round?.players?.some((player) => String(player._id) === String(me._id))
  );
  const isClosed = round?.status === "closed";

  const handleAccept = async (scorecardId) => {
    if (!params?.id) {
      return;
    }
    const res = await fetch(
      `/api/rounds/${params.id}/scorecards/${scorecardId}/accept`,
      { method: "POST" }
    );
    if (!res.ok) {
      notifications.show({
        title: "No se pudo aceptar",
        message: "Intenta de nuevo.",
        color: "clay",
      });
      return;
    }
    notifications.show({
      title: "Tarjeta aceptada",
      message: "Se bloqueo la edicion.",
      color: "club",
    });
    loadScorecards();
    const socket = getSocket();
    socket.emit("scorecard:update", {
      roundId: params.id,
      payload: { scorecardId },
    });
  };

  const handleSettle = async () => {
    if (!params?.id) {
      return;
    }
    setSettling(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/settle`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cerrar la jugada.");
      }
      setSummary(data);
      notifications.show({
        title: "Pagos calculados",
        message: "",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "Error al calcular",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setSettling(false);
    }
  };

  const handleClose = async () => {
    if (!params?.id) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cerrar la jugada.");
      }
      if (Array.isArray(data.optimizedTransfers)) {
        setOptimizedTransfers(data.optimizedTransfers);
      }
      notifications.show({
        title: "Jugada cerrada",
        message: "Tarjetas bloqueadas.",
        color: "club",
      });
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
    } catch (error) {
      notifications.show({
        title: "Error al cerrar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setClosing(false);
    }
  };

  return (
    <main>
      <AppShell title="Tarjeta en vivo" subtitle="Actualiza hoyos y premios.">
        <Card mb="lg">
          <Group justify="space-between">
            <div>
              <Text fw={700}>{round?.courseSnapshot?.clubName || "Grupo"}</Text>
              <Text size="sm" c="dusk.6">
                Supervisa: {round?.supervisor?.name || "Por asignar"}
              </Text>
            </div>
            <Group>
              {isJoined && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  component="a"
                  href={`/rounds/${params?.id}/record`}
                >
                  Registrar tarjeta
                </Button>
              ) : null}
              {canApprove && !isClosed ? (
                <Button
                  size="xs"
                  color="club"
                  onClick={handleSettle}
                  loading={settling}
                >
                  Calcular pagos
                </Button>
              ) : null}
              {canApprove && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleClose}
                  loading={closing}
                  disabled={!allAccepted}
                >
                  Cerrar jugada
                </Button>
              ) : null}
              <Badge color={isClosed ? "dusk" : "club"}>
                {isClosed ? "Cerrada" : "En juego"}
              </Badge>
            </Group>
          </Group>
        </Card>

        <Card>
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Tarjeta</Text>
            <Select
              size="xs"
              data={[
                { value: "gross", label: "Gross" },
                { value: "net", label: "Net" },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </Group>
          <div className="gml-table-scroll">
            <Table withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="gml-sticky-col">Jugador</Table.Th>
                {holes.map((hole) => (
                  <Table.Th key={hole}>{hole}</Table.Th>
                ))}
                <Table.Th>V1</Table.Th>
                <Table.Th>V2</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Putts</Table.Th>
                <Table.Th>Estado</Table.Th>
                {canApprove ? <Table.Th>Accion</Table.Th> : null}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {scorecards.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={holes.length + 6 + (canApprove ? 1 : 0)}>
                    <Text size="sm" c="dusk.6">
                      Aun no hay tarjetas registradas.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                scorecards.map((card) => (
                  <Table.Tr key={card._id}>
                    <Table.Td className="gml-sticky-col">
                      {card.player?.name || "Jugador"}
                    </Table.Td>
                    {holes.map((hole) => {
                      const entry = card.holes?.find(
                        (item) => item.hole === hole
                      );
                      const strokes = entry?.strokes ?? "-";
                      const putts = entry?.putts;
                      const ohYes = entry?.ohYes;
                      const sandy = entry?.sandy;
                      return (
                        <Table.Td key={hole}>
                          {strokes}
                          {putts != null && putts !== 0 ? ` (${putts})` : ""}
                          {ohYes ? " · OY" : ""}
                          {sandy ? " · S" : ""}
                        </Table.Td>
                      );
                    })}
                    <Table.Td>
                      {frontHoles.reduce((sum, hole) => {
                        const entry = card.holes?.find(
                          (item) => item.hole === hole
                        );
                        return sum + (entry?.strokes || 0);
                      }, 0) || "-"}
                    </Table.Td>
                    <Table.Td>
                      {backHoles.length === 0
                        ? "-"
                        : backHoles.reduce((sum, hole) => {
                            const entry = card.holes?.find(
                              (item) => item.hole === hole
                            );
                            return sum + (entry?.strokes || 0);
                          }, 0)}
                    </Table.Td>
                    <Table.Td>
                      {viewMode === "net"
                        ? card.netTotal ?? "-"
                        : card.grossTotal ?? "-"}
                    </Table.Td>
                    <Table.Td>{card.puttsTotal ?? "-"}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={card.accepted ? "club" : "dusk"}
                        variant="light"
                      >
                        {card.accepted ? "Aceptada" : "Pendiente"}
                      </Badge>
                    </Table.Td>
                    {canApprove ? (
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            component="a"
                            href={`/rounds/${params?.id}/record?playerId=${card.player?._id}`}
                          >
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => handleAccept(card._id)}
                            disabled={card.accepted}
                          >
                            {card.accepted ? "Listo" : "Aceptar"}
                          </Button>
                        </Group>
                      </Table.Td>
                    ) : null}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            </Table>
          </div>
        </Card>

        <Card mt="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Castigos registrados</Text>
            <Badge color="clay" variant="light">
              Solo registro
            </Badge>
          </Group>
          {penaltyFeed.length === 0 ? (
            <Text size="sm" c="dusk.6">
              Sin castigos registrados.
            </Text>
          ) : (
            penaltyFeed.map((item) => (
              <Group key={`${item.player}-${item.hole}`} mb="sm">
                <Badge color="dusk" variant="light">
                  Hoyo {item.hole}
                </Badge>
                <div>
                  <Text fw={600}>
                    {item.player} · {item.penalty}
                  </Text>
                  <Text size="sm" c="dusk.6">
                    Registro informado.
                  </Text>
                </div>
              </Group>
            ))
          )}
        </Card>

        <Card mt="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Resumen de pagos</Text>
            <Badge color="dusk" variant="light">
              MXN
            </Badge>
          </Group>
          {!summary || !summary.summary ? (
            <Text size="sm" c="dusk.6">
              Calcula pagos para ver el resumen final.
            </Text>
          ) : (
            <Accordion variant="separated">
              {scorecards.map((card) => {
                const playerId = card.player?._id?.toString();
                const value = summary.summary?.[playerId] || 0;
                const items = (summary.payments || []).filter(
                  (payment) =>
                    String(payment.from) === playerId ||
                    String(payment.to) === playerId
                );
                return (
                  <Accordion.Item key={card._id} value={card._id}>
                    <Accordion.Control>
                      <Group justify="space-between">
                        <Text fw={600}>{card.player?.name || "Jugador"}</Text>
                        <Text size="sm" c={value >= 0 ? "club.7" : "clay.7"}>
                          {value >= 0 ? "+" : "-"}${Math.abs(value)}
                        </Text>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {items.length === 0 ? (
                        <Text size="sm" c="dusk.6">
                          Sin movimientos registrados.
                        </Text>
                      ) : (
                        items.map((payment, idx) => {
                          const isWin = String(payment.to) === playerId;
                          const rivalId = isWin
                            ? String(payment.from)
                            : String(payment.to);
                          const rival = scorecards.find(
                            (card) => String(card.player?._id) === rivalId
                          );
                          const label = ITEM_LABELS[payment.item] || payment.item;
                          return (
                            <Group key={`${card._id}-${idx}`} mb="xs">
                              <Badge
                                color={isWin ? "club" : "clay"}
                                variant="light"
                              >
                                {isWin ? "Gana" : "Paga"}
                              </Badge>
                              <Text size="sm">
                                {label}
                                {payment.hole ? ` · Hoyo ${payment.hole}` : ""}
                                {rival ? ` · vs ${rival.player?.name}` : ""}
                              </Text>
                              <Text size="sm" c={isWin ? "club.7" : "clay.7"}>
                                {isWin ? "+" : "-"}${payment.amount}
                              </Text>
                            </Group>
                          );
                        })
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Card>

        <Card mt="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Transacciones optimizadas</Text>
            <Badge color="dusk" variant="light">
              MXN
            </Badge>
          </Group>
          {optimizedTransfers.length === 0 ? (
            <Text size="sm" c="dusk.6">
              Cierra la jugada para generar el minimo de transacciones.
            </Text>
          ) : (
            optimizedTransfers.map((transfer, idx) => {
              const fromPlayer = scorecards.find(
                (card) =>
                  String(card.player?._id) === String(transfer.from)
              )?.player?.name;
              const toPlayer = scorecards.find(
                (card) =>
                  String(card.player?._id) === String(transfer.to)
              )?.player?.name;
              return (
                <Group key={`${transfer.from}-${transfer.to}-${idx}`} mb="xs">
                  <Text size="sm" fw={600}>
                    {fromPlayer || "Jugador"} → {toPlayer || "Jugador"}
                  </Text>
                  <Badge color="clay" variant="light">
                    ${transfer.amount}
                  </Badge>
                </Group>
              );
            })
          )}
        </Card>
      </AppShell>
    </main>
  );
}
