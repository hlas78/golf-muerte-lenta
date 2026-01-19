"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Button,
  Card,
  Group,
  Modal,
  Select,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";
import { getSocket } from "@/lib/socketClient";

export default function RoundDetailPage() {
  const params = useParams();
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [me, setMe] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [joinTee, setJoinTee] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updatingTee, setUpdatingTee] = useState(null);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setRound(data);
      })
      .catch(() => {
        notifications.show({
          title: "No se pudo cargar la jugada",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      })
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setMe(data.user || null))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!params?.id || !me?._id) {
      return;
    }
    const socket = getSocket();
    socket.emit("presence:join", { roundId: params.id, user: me });
    socket.on("presence:update", (users) => {
      setConnectedPlayers(Array.isArray(users) ? users : []);
    });
    return () => {
      socket.off("presence:update");
    };
  }, [me, params]);

  const courseName = round?.courseSnapshot
    ? `${round.courseSnapshot.clubName} · ${round.courseSnapshot.courseName}`
    : "Jugada";

  const players = useMemo(() => round?.players || [], [round]);
  const playerTees = useMemo(() => round?.playerTees || [], [round]);
  const isJoined = useMemo(
    () =>
      Boolean(
        me?._id &&
          players.some((player) => String(player._id) === String(me._id))
      ),
    [me, players]
  );
  const canManage =
    me?.role === "admin" ||
    (me?._id && String(round?.supervisor) === String(me._id));
  const isClosed = round?.status === "closed";

  const teeOptions = useMemo(() => {
    const tees = round?.courseSnapshot?.tees;
    if (!tees) {
      return [];
    }
    const groups = [
      { key: "male", label: "Caballeros" },
      { key: "female", label: "Damas" },
    ];
    return groups.flatMap((group) =>
      (tees[group.key] || []).map((tee) => ({
        value: tee.tee_name,
        label: `${tee.tee_name} · ${group.label}`,
      }))
    );
  }, [round]);

  useEffect(() => {
    if (teeOptions.length && !joinTee) {
      setJoinTee(teeOptions[0].value);
    }
  }, [teeOptions, joinTee]);

  useEffect(() => {
    if (!round || !me?._id) {
      return;
    }
    const existing = round.playerTees?.find(
      (entry) => String(entry.player) === String(me._id)
    );
    if (existing?.teeName) {
      setJoinTee(existing.teeName);
    }
  }, [round, me]);

  const handleJoin = async () => {
    if (!me?._id || !params?.id) {
      return;
    }
    if (me.handicap == null || me.handicap === 0) {
      notifications.show({
        title: "Handicap requerido",
        message: "Actualiza tu handicap para unirte.",
        color: "clay",
      });
      return;
    }
    if (!joinTee) {
      notifications.show({
        title: "Selecciona tee",
        message: "Elige tu tee de salida.",
        color: "clay",
      });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmJoin = async () => {
    if (!me?._id || !params?.id || !joinTee) {
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me._id, teeName: joinTee }),
      });
      if (!res.ok) {
        throw new Error("No se pudo unir a la jugada.");
      }
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
      setConfirmOpen(false);
    } catch (error) {
      notifications.show({
        title: "No se pudo unir",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleUpdateTee = async (playerId, teeName) => {
    if (!params?.id || !teeName) {
      return;
    }
    setUpdatingTee(playerId);
    try {
      const res = await fetch(
        `/api/rounds/${params.id}/players/${playerId}/tee`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teeName }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo actualizar.");
      }
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
    } catch (error) {
      notifications.show({
        title: "No se pudo actualizar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setUpdatingTee(null);
    }
  };

  return (
    <main>
      <AppShell
        title="Jugada activa"
        subtitle={loading ? "Cargando..." : "Ronda en curso."}
      >
        <Card mb="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>{courseName}</Text>
            <Text size="sm" c="dusk.6">
              {round?.holes || "--"} hoyos · tee por jugador
            </Text>
          </Group>
          <Text size="sm" c="dusk.6">
            Supervisa: {round?.supervisor?.name || "Por asignar"}
          </Text>
          <Text size="sm" c="dusk.6">
            Valida tarjetas y comparte el marcador en tiempo real.
          </Text>
          <Group mt="md">
            <Button
              component={Link}
              href={`/rounds/${params?.id}/scorecard`}
              color="club"
            >
              Ver tarjeta
            </Button>
            {isJoined ? (
              <Button
                variant="light"
                component={Link}
                href={`/rounds/${params?.id}/record`}
              >
                Registrar mi tarjeta
              </Button>
            ) : null}
            {!isJoined ? (
              <Button variant="light" onClick={handleJoin} loading={joining}>
                Unirme
              </Button>
            ) : null}
          </Group>
        </Card>

        <Card mb="lg">
          <Text fw={700} mb="sm">
            Tu tee de salida
          </Text>
          <Select
            placeholder="Selecciona tee"
            data={teeOptions}
            value={joinTee}
            onChange={setJoinTee}
            disabled={isJoined}
          />
          {isJoined ? (
            <Text size="xs" c="dusk.6" mt="xs">
              Ya estas en la jugada.
            </Text>
          ) : null}
        </Card>

        <Card>
          <Text fw={700} mb="sm">
            Jugadores en la jugada
          </Text>
          {players.length === 0 ? (
            <Text size="sm" c="dusk.6">
              Aun no hay jugadores registrados.
            </Text>
          ) : (
            players.map((player) => (
              <Group key={player._id} justify="space-between" mb="sm">
                <div>
                  <Text fw={600}>{player.name}</Text>
                  <Text size="sm" c="dusk.6">
                    HC {player.handicap ?? 0}
                  </Text>
                </div>
                {canManage ? (
                  <Group>
                    <Select
                      data={teeOptions}
                      value={
                        playerTees.find(
                          (entry) =>
                            String(entry.player) === String(player._id)
                        )?.teeName || ""
                      }
                      onChange={(value) => handleUpdateTee(player._id, value)}
                      placeholder="Sin tee"
                      disabled={updatingTee === player._id || isClosed}
                    />
                    <Button
                      size="xs"
                      variant="light"
                      component={Link}
                      href={`/rounds/${params?.id}/record?playerId=${player._id}`}
                      disabled={isClosed}
                    >
                      Editar tarjeta
                    </Button>
                  </Group>
                ) : (
                  <Text size="sm" c="dusk.6">
                    {playerTees.find(
                      (entry) => String(entry.player) === String(player._id)
                    )?.teeName || "Sin tee"}
                  </Text>
                )}
              </Group>
            ))
          )}
        </Card>

        <Card mt="lg">
          <Text fw={700} mb="sm">
            Jugadores conectados
          </Text>
          {connectedPlayers.length === 0 ? (
            <Text size="sm" c="dusk.6">
              Nadie conectado por ahora.
            </Text>
          ) : (
            connectedPlayers.map((player) => (
              <Group key={player._id} justify="space-between" mb="sm">
                <Text fw={600}>{player.name}</Text>
                <Text size="sm" c="dusk.6">
                  En linea
                </Text>
              </Group>
            ))
          )}
        </Card>
      </AppShell>
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar union"
        centered
      >
        <Text size="sm" c="dusk.6" mb="md">
          Te vas a unir a la jugada en {courseName} con tee {joinTee}. ¿Confirmas?
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button color="club" onClick={confirmJoin} loading={joining}>
            Confirmar
          </Button>
        </Group>
      </Modal>
    </main>
  );
}
