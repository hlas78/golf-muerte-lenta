"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../../components/AppShell";
import { getSocket } from "@/lib/socketClient";

const buildEmptyHoles = (count) =>
  Array.from({ length: count }, (_, idx) => ({
    hole: idx + 1,
    strokes: null,
    putts: null,
    ohYes: false,
    sandy: false,
    penalties: [],
    bunker: false,
    water: false,
    holeOut: false,
  }));

export default function RecordFastPage() {
  const params = useParams();
  const router = useRouter();
  const [round, setRound] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedHole, setSelectedHole] = useState("1");
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const autoSaveTimeout = useRef(null);
  const storageKey = useMemo(
    () => (params?.id ? `gml:round:${params.id}:record-fast:players` : ""),
    [params]
  );

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role === "player") {
          router.replace(`/rounds/${params?.id || ""}`);
          return;
        }
        setMe(data.user || null);
      })
      .catch(() => router.replace(`/rounds/${params?.id || ""}`));
  }, [params, router]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}`)
      .then((res) => res.json())
      .then((data) => setRound(data))
      .catch(() => {
        notifications.show({
          title: "No se pudo cargar la jugada",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      });
  }, [params]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) =>
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : [])
      )
      .catch(() => setScorecards([]));
  }, [params]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedPlayers(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selectedPlayers));
    } catch {
      // ignore
    }
  }, [selectedPlayers, storageKey]);

  const isClosed = round?.status === "closed";
  const holeNumber = Number(selectedHole || 1);
  const players = useMemo(() => round?.players || [], [round]);
  const playerOptions = useMemo(
    () =>
      players.map((player) => ({
        value: player._id,
        name: player.name,
        handicap: player.handicap ?? 0,
      })),
    [players]
  );
  const holeOptions = useMemo(
    () =>
      Array.from({ length: round?.holes || 9 }, (_, idx) => ({
        value: String(idx + 1),
        label: `Hoyo ${idx + 1}`,
      })),
    [round]
  );

  const getCardForPlayer = (playerId) => {
    const existing = scorecards.find(
      (card) => String(card.player?._id) === String(playerId)
    );
    if (existing) {
      return existing;
    }
    const player = players.find(
      (item) => String(item._id) === String(playerId)
    );
    return {
      player,
      teeName:
        round?.playerTees?.find(
          (entry) => String(entry.player) === String(playerId)
        )?.teeName || round?.teeName,
      holes: buildEmptyHoles(round?.holes || 9),
      accepted: false,
    };
  };

  const updatePlayerHole = (playerId, patch) => {
    if (!round?.holes || !playerId) {
      return;
    }
    setDirty(true);
    setScorecards((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (card) => String(card.player?._id) === String(playerId)
      );
      const baseCard = idx >= 0 ? next[idx] : getCardForPlayer(playerId);
      const holes =
        baseCard.holes?.length === round.holes
          ? baseCard.holes
          : buildEmptyHoles(round.holes);
      const nextHoles = holes.map((hole) => {
        if (hole.hole !== holeNumber) {
          return hole;
        }
        const hasStrokes = Object.prototype.hasOwnProperty.call(
          patch,
          "strokes"
        );
        const nextStrokes =
          hasStrokes && patch.strokes !== "" && patch.strokes != null
            ? Number(patch.strokes)
            : hasStrokes
            ? null
            : hole.strokes;
        return {
          ...hole,
          ...patch,
          strokes: nextStrokes,
        };
      });
      const updated = { ...baseCard, holes: nextHoles };
      if (idx >= 0) {
        next[idx] = updated;
      } else {
        next.push(updated);
      }
      return next;
    });
  };

  const updateNumber = (playerId, delta) => {
    const card = getCardForPlayer(playerId);
    const entry = card.holes?.find((hole) => hole.hole === holeNumber);
    const current = Number(entry?.strokes ?? 0);
    const next = Math.max(0, current + delta);
    updatePlayerHole(playerId, { strokes: next });
  };

  const saveSelectedCards = async ({ notify, refresh }) => {
    if (!selectedPlayers.length || !round?._id) {
      if (notify) {
        notifications.show({
          title: "Selecciona jugadores",
          message: "Elige participantes para capturar.",
          color: "clay",
        });
      }
      return false;
    }
    try {
      const requests = selectedPlayers.map((playerId) => {
        const card = getCardForPlayer(playerId);
        if (card.accepted || isClosed) {
          return null;
        }
        const holes = (card.holes?.length
          ? card.holes
          : buildEmptyHoles(round.holes)
        ).map((hole) => ({
          ...hole,
          strokes:
            hole.strokes === "" || hole.strokes == null
              ? null
              : Number(hole.strokes),
        }));
        return fetch(`/api/rounds/${params.id}/scorecards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            holes,
          }),
        });
      });
      const responses = await Promise.all(requests.filter(Boolean));
      const failed = responses.find((res) => !res.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar.");
      }
      const socket = getSocket();
      socket.emit("scorecard:update", {
        roundId: params.id,
        payload: { hole: holeNumber },
      });
      if (refresh) {
        const data = await fetch(`/api/rounds/${params.id}/scorecards`).then(
          (res) => res.json()
        );
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : []);
      }
      if (notify) {
        notifications.show({
          title: "Hoyo guardado",
          message: "Se guardo la captura.",
          color: "club",
        });
      }
      setDirty(false);
      return true;
    } catch (error) {
      notifications.show({
        title: "Error al guardar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
      return false;
    }
  };

  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    if (!dirty) {
      return undefined;
    }
    autoSaveTimeout.current = setTimeout(async () => {
      await saveSelectedCards({ notify: false, refresh: false });
    }, 800);
    return () => clearTimeout(autoSaveTimeout.current);
  }, [dirty, selectedPlayers, scorecards]);

  const stepHole = async (direction) => {
    if (!round?.holes) {
      return;
    }
    if (dirty) {
      await saveSelectedCards({ notify: false, refresh: false });
    }
    setSelectedHole((current) => {
      const value = Number(current || 1);
      const next = value + direction;
      if (next < 1 || next > round.holes) {
        return String(value);
      }
      return String(next);
    });
  };

  const selectedCards = selectedPlayers.map((playerId) =>
    getCardForPlayer(playerId)
  );

  const togglePlayer = (playerId) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  return (
    <main className="gml-scorecard-compact">
      <AppShell title="Captura rápida">
        <Modal
          opened={playersModalOpen}
          onClose={() => setPlayersModalOpen(false)}
          title="Selecciona jugadores"
          centered
        >
          <div className="gml-players-compact">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Jugador</Table.Th>
                  <Table.Th>HC</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {playerOptions.map((player) => {
                  const selected = selectedPlayers.includes(player.value);
                  return (
                    <Table.Tr key={player.value}>
                      <Table.Td>{player.name}</Table.Td>
                      <Table.Td>{player.handicap}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant={selected ? "filled" : "light"}
                          color={selected ? "club" : "dusk"}
                          onClick={() => togglePlayer(player.value)}
                          disabled={isClosed}
                        >
                          {selected ? "Quitar" : "Agregar"}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
          <Group justify="space-between" mt="md">
            <Button
              variant="light"
              onClick={() =>
                setSelectedPlayers(players.map((player) => player._id))
              }
              disabled={isClosed || players.length === 0}
            >
              Seleccionar todos
            </Button>
            <Button
              variant="light"
              onClick={() => setSelectedPlayers([])}
              disabled={isClosed || selectedPlayers.length === 0}
            >
              Limpiar
            </Button>
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setPlayersModalOpen(false)}>
              Listo
            </Button>
          </Group>
        </Modal>

        <Card mb="sm" p="sm">
          <Group justify="space-between" align="flex-end" mb="xs">
            <div>
              <Text size="sm" fw={600}>
                Hoyo
              </Text>
              <Select
                data={holeOptions}
                value={selectedHole}
                onChange={setSelectedHole}
                size="xs"
              />
            </div>
            <Button
              variant="light"
              onClick={() => setPlayersModalOpen(true)}
              disabled={isClosed}
            >
              {selectedPlayers.length > 0
                ? `Editar jugadores (${selectedPlayers.length})`
                : "Seleccionar jugadores"}
            </Button>
          </Group>
          <Group justify="space-between">
            <Button
              variant="club"
              onClick={() => stepHole(-1)}
              disabled={Number(selectedHole) <= 1 || saving}
            >
              Anterior
            </Button>
            <Button
              color="club"
              onClick={() => stepHole(1)}
              disabled={Number(selectedHole) >= (round?.holes || 9) || saving}
              loading={saving}
            >
              Siguiente
            </Button>
          </Group>
        </Card>

        {selectedCards.length === 0 ? (
          <Card p="sm">
            <Text size="sm" c="dusk.6">
              Selecciona jugadores para comenzar la captura.
            </Text>
          </Card>
        ) : (
          selectedCards.map((card, idx) => {
            const playerId = card.player?._id;
            const entry = card.holes?.find((hole) => hole.hole === holeNumber);
            const locked = card.accepted || isClosed;
            const cardKey = playerId || card._id || `${idx}-${holeNumber}`;
            return (
              <Card key={cardKey} mb="sm" p="sm">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={700}>{card.player?.name || "Jugador"}</Text>
                    <Text size="sm" c="dusk.6">
                      Tee: {card.teeName || "Sin tee"}
                    </Text>
                  </div>
                  <Badge color={locked ? "dusk" : "club"} variant="light">
                    {locked ? "Bloqueada" : "Editable"}
                  </Badge>
                </Group>
                <Group align="center" gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => updateNumber(playerId, -1)}
                    disabled={locked}
                  >
                    -
                  </Button>
                  <TextInput
                    value={entry?.strokes ?? ""}
                    onChange={(event) =>
                      updatePlayerHole(playerId, {
                        strokes: event.currentTarget.value,
                      })
                    }
                    placeholder="-"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={locked}
                    w={80}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => updateNumber(playerId, 1)}
                    disabled={locked}
                  >
                    +
                  </Button>
                </Group>
              </Card>
            );
          })
        )}
      </AppShell>
    </main>
  );
}
