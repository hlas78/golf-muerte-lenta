"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../../components/AppShell";
import { getSocket } from "@/lib/socketClient";
import {
  allocateStrokes,
  getCourseHandicapForRound,
  normalizeHoleHandicaps,
} from "@/lib/scoring";

const PENALTIES = [
  { value: "pinkies", label: "Pinkies" },
  { value: "saltapatras", label: "Saltapatras" },
  { value: "paloma", label: "Paloma" },
  { value: "whiskeys", label: "Whiskeys" },
  { value: "berrinche", label: "Berrinche" },
];

const togglePenaltyValue = (penalties, penalty) => {
  const base = Array.isArray(penalties) ? penalties : [];
  return base.includes(penalty)
    ? base.filter((item) => item !== penalty)
    : [...base, penalty];
};

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

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const formatToPar = (value) => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (value === 0) {
    return "E";
  }
  return value > 0 ? `+${value}` : String(value);
};

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

export default function RecordMultiPage() {
  const params = useParams();
  const router = useRouter();
  const [round, setRound] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedHole, setSelectedHole] = useState("1");
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refreshingView, setRefreshingView] = useState(false);
  const autoSaveTimeout = useRef(null);
  const storageKey = useMemo(
    () => (params?.id ? `gml:round:${params.id}:record-multi:players` : ""),
    [params]
  );
  const allTees = useMemo(() => {
    const tees = round?.courseSnapshot?.tees;
    return tees ? [...(tees.male || []), ...(tees.female || [])] : [];
  }, [round]);
  const canManageAllGroups =
    me?.role === "admin" || me?.role === "supervisor";
  const myGroupNumber =
    round?.playerGroups?.find(
      (entry) => String(entry.player) === String(me?._id)
    )?.group || null;
  const isMarshalForGroup = Boolean(
    myGroupNumber &&
      round?.groupMarshals?.some(
        (entry) =>
          Number(entry.group) === Number(myGroupNumber) &&
          String(entry.player) === String(me?._id)
      )
  );
  const canCaptureGroup = canManageAllGroups || isMarshalForGroup;

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
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
    if (me == null || round == null) {
      return;
    }
    if (!canCaptureGroup) {
      router.replace(`/rounds/${params?.id || ""}`);
    }
  }, [canCaptureGroup, me, params, round, router]);

  const loadScorecards = () => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) => {
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : []);
      })
      .catch(() => setScorecards([]));
  };

  const loadRound = async () => {
    if (!params?.id) {
      return null;
    }
    const res = await fetch(`/api/rounds/${params.id}`);
    const data = await res.json();
    setRound(data);
    return data;
  };

  const refreshRecordMultiView = async ({ notify = false } = {}) => {
    if (!params?.id) {
      return;
    }
    if (dirty || saving || autoSaving) {
      if (notify) {
        notifications.show({
          title: "Guarda antes de actualizar",
          message: "Hay cambios locales pendientes.",
          color: "dusk",
        });
      }
      return;
    }
    setRefreshingView(true);
    try {
      await Promise.all([loadRound(), Promise.resolve(loadScorecards())]);
      if (notify) {
        notifications.show({
          title: "Vista actualizada",
          message: "Se recargó la captura de grupo.",
          color: "club",
        });
      }
    } catch {
      if (notify) {
        notifications.show({
          title: "No se pudo actualizar",
          message: "Intenta de nuevo.",
          color: "clay",
        });
      }
    } finally {
      setRefreshingView(false);
    }
  };

  useEffect(() => {
    if (!round?._id) {
      return;
    }
    loadScorecards();
  }, [round]);

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

  const isClosed = round?.status === "closed";
  const holeNumber = Number(selectedHole || 1);
  const players = useMemo(() => round?.players || [], [round]);
  const capturablePlayers = useMemo(() => {
    if (canManageAllGroups) {
      return players;
    }
    if (!myGroupNumber) {
      return [];
    }
    return players.filter((player) => {
      const group = round?.playerGroups?.find(
        (entry) => String(entry.player) === String(player._id)
      )?.group;
      return Number(group) === Number(myGroupNumber);
    });
  }, [canManageAllGroups, myGroupNumber, players, round?.playerGroups]);
  const defaultSelectedPlayers = useMemo(() => {
    if (!capturablePlayers.length) {
      return [];
    }
    if (!myGroupNumber) {
      return capturablePlayers;
    }
    const myGroupPlayers = capturablePlayers.filter((player) => {
      const group = round?.playerGroups?.find(
        (entry) => String(entry.player) === String(player._id)
      )?.group;
      return Number(group) === Number(myGroupNumber);
    });
    return myGroupPlayers.length > 0 ? myGroupPlayers : capturablePlayers;
  }, [capturablePlayers, myGroupNumber, round?.playerGroups]);
  const playerOptions = useMemo(
    () =>
      capturablePlayers.map((player) => ({
        value: player._id,
        label: `${player.name} · HC ${player.handicap ?? 0}`,
        name: player.name,
        handicap: player.handicap ?? 0,
      })),
    [capturablePlayers]
  );
  const holeOptions = useMemo(
    () =>
      Array.from({ length: round?.holes || 9 }, (_, idx) => ({
        value: String(idx + 1),
        label: `Hoyo ${idx + 1}`,
      })),
    [round]
  );

  useEffect(() => {
    if (!capturablePlayers.length) {
      return;
    }
    const validPlayerIds = new Set(
      capturablePlayers.map((player) => String(player._id))
    );
    setSelectedPlayers((prev) => {
      const filtered = prev.filter((playerId) =>
        validPlayerIds.has(String(playerId))
      );
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [capturablePlayers]);

  useEffect(() => {
    if (!round || !me || selectedPlayers.length > 0) {
      return;
    }
    if (!defaultSelectedPlayers.length) {
      return;
    }
    const groupPlayerIds = defaultSelectedPlayers.map((player) => player._id);
    if (groupPlayerIds.length > 0) {
      setSelectedPlayers(groupPlayerIds);
    }
  }, [defaultSelectedPlayers, me, round, selectedPlayers.length]);

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

  const getHoleMetaForPlayer = (playerId) => {
    const teeName =
      round?.playerTees?.find(
        (entry) => String(entry.player) === String(playerId)
      )?.teeName || round?.teeName;
    const selected =
      allTees.find((tee) => tee.tee_name === teeName) || allTees[0];
    const meta = selected?.holes || [];
    return meta.reduce((acc, hole, idx) => {
      acc[idx + 1] = hole;
      return acc;
    }, {});
  };

  const getPlayerProgress = (card) => {
    const playerId = String(card.player?._id || "");
    const capturedHoles = (card.holes || []).filter(
      (hole) => hole.strokes != null && hole.strokes !== ""
    );
    const grossTotal = capturedHoles.reduce(
      (sum, hole) => sum + Number(hole.strokes || 0),
      0
    );
    if (!capturedHoles.length) {
      return { grossTotal: 0, netToPar: null };
    }
    const holeMeta = getHoleMetaForPlayer(playerId);
    const parTotal = capturedHoles.reduce(
      (sum, hole) => sum + Number(holeMeta[hole.hole]?.par || 0),
      0
    );
    const teeName =
      card.teeName ||
      round?.playerTees?.find((entry) => String(entry.player) === playerId)?.teeName ||
      round?.teeName;
    const tee = allTees.find((option) => option.tee_name === teeName) || allTees[0];
    const normalized = normalizeHoleHandicaps(tee?.holes || [], round);
    const holeHandicaps = normalized.map((hole, idx) => ({
      hole: hole.hole ?? idx + 1,
      handicap: hole.handicap,
    }));
    const courseHandicap = getCourseHandicapForRound(
      tee,
      round,
      card.player?.handicap ?? 0
    );
    const strokesMap = allocateStrokes(
      Math.max(0, courseHandicap || 0),
      holeHandicaps,
      round?.holes || 18
    );
    const netTotal = capturedHoles.reduce(
      (sum, hole) =>
        sum + Number(hole.strokes || 0) - Number(strokesMap[hole.hole - 1] || 0),
      0
    );
    return { grossTotal, netToPar: netTotal - parTotal };
  };

  const updatePlayerHole = (playerId, patch) => {
    if (!round?.holes || !playerId) {
      return;
    }
    const holeMeta = getHoleMetaForPlayer(playerId);
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
        const hasPutts = Object.prototype.hasOwnProperty.call(patch, "putts");
        const nextStrokes =
          hasStrokes && patch.strokes !== "" && patch.strokes != null
            ? Number(patch.strokes)
            : hasStrokes
            ? null
            : hole.strokes;
        const nextPutts =
          hasPutts && patch.putts !== "" && patch.putts != null
            ? Number(patch.putts)
            : hasPutts
            ? null
            : hole.putts;
        const par = holeMeta[hole.hole]?.par;
        const holeOut =
          par != null &&
          nextPutts === 0 &&
          nextStrokes != null &&
          nextStrokes <= par;
        const basePenalties = Object.prototype.hasOwnProperty.call(
          patch,
          "penalties"
        )
          ? patch.penalties
          : hole.penalties;
        const penalties = Array.isArray(basePenalties)
          ? basePenalties.filter(
              (penalty) => !["cuatriputt", "nerdina"].includes(penalty)
            )
          : [];
        if (nextPutts != null && nextPutts >= 4) {
          penalties.push("cuatriputt");
        }
        if (nextStrokes != null && nextStrokes >= 10) {
          penalties.push("nerdina");
        }
        return {
          ...hole,
          ...patch,
          strokes: nextStrokes,
          putts: nextPutts,
          holeOut,
          penalties,
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

  const applyStrokePreset = (playerId, preset) => {
    const holeMeta = getHoleMetaForPlayer(playerId);
    const par = holeMeta[holeNumber]?.par;
    if (!par) {
      return;
    }
    const value =
      preset === "birdie"
        ? par - 1
        : preset === "par"
        ? par
        : preset === "bogey"
        ? par + 1
        : par + 2;
    updatePlayerHole(playerId, { strokes: value });
  };

  const applyPuttPreset = (playerId, value) => {
    updatePlayerHole(playerId, { putts: value });
  };

  const clearPlayerHoleCapture = (playerId) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Se borrarán golpes, putts y premios/castigos de este hoyo. ¿Continuar?"
      )
    ) {
      return;
    }
    updatePlayerHole(playerId, {
      strokes: "",
      putts: "",
      water: false,
      ohYes: false,
      sandy: false,
      penalties: [],
      bunker: false,
      holeOut: false,
    });
  };

  const updateNumber = (playerId, key, delta) => {
    const card = getCardForPlayer(playerId);
    const entry = card.holes?.find((hole) => hole.hole === holeNumber);
    const current = Number(entry?.[key] ?? 0);
    const next = Math.max(0, current + delta);
    updatePlayerHole(playerId, { [key]: next });
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
        const holeMeta = getHoleMetaForPlayer(playerId);
        const activeHole =
          (card.holes?.length
            ? card.holes
            : buildEmptyHoles(round.holes)
          ).find((hole) => hole.hole === holeNumber) || {
            hole: holeNumber,
          };
        const holes = [
          {
            ...activeHole,
            par: holeMeta[activeHole.hole]?.par,
            strokes:
              activeHole.strokes === "" || activeHole.strokes == null
                ? null
                : Number(activeHole.strokes),
            putts:
              activeHole.putts === "" || activeHole.putts == null
                ? null
                : Number(activeHole.putts),
          },
        ];
        return fetch(`/api/rounds/${params.id}/scorecards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            holes,
            mergeByHole: true,
          }),
        });
      });
      const responses = await Promise.all(
        requests.filter(Boolean)
      );
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
      if (notify) {
        notifications.show({
          title: "Hoyo guardado",
          message: "Se guardo la captura.",
          color: "club",
        });
      }
      if (refresh) {
        loadScorecards();
      }
      setDirty(false);
      return true;
    } catch (error) {
      if (notify) {
        notifications.show({
          title: "Error al guardar",
          message: error.message || "Intenta de nuevo.",
          color: "clay",
        });
      }
      return false;
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await saveSelectedCards({ notify: true, refresh: true });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!dirty || !selectedPlayers.length || !round?._id || isClosed) {
      return;
    }
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    autoSaveTimeout.current = setTimeout(async () => {
      if (saving || autoSaving) {
        return;
      }
      setAutoSaving(true);
      try {
        await saveSelectedCards({ notify: false, refresh: false });
      } catch (error) {
        notifications.show({
          title: "Error al guardar",
          message: error.message || "Intenta de nuevo.",
          color: "clay",
        });
      } finally {
        setAutoSaving(false);
      }
    }, 800);
    return () => clearTimeout(autoSaveTimeout.current);
  }, [autoSaving, isClosed, round, saving, scorecards, selectedHole, selectedPlayers]);

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

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    let lastRefreshAt = 0;
    const refreshIfNeeded = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 1500) {
        return;
      }
      lastRefreshAt = now;
      refreshRecordMultiView();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshIfNeeded();
      }
    };
    window.addEventListener("focus", refreshIfNeeded);
    window.addEventListener("pageshow", refreshIfNeeded);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      window.removeEventListener("pageshow", refreshIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [params?.id, dirty, saving, autoSaving, round]);

  const stepHole = async (direction) => {
    if (!round?.holes) {
      return;
    }
    await handleSave();
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
      <AppShell
        title="Captura grupo"
        // subtitle="Selecciona jugadores y registra un hoyo a la vez."
      >
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
                  <Table.Th>HC Tee</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {playerOptions.map((player) => {
                  const selected = selectedPlayers.includes(player.value);
                  const tees = round?.courseSnapshot?.tees || {};
                  const allTees = [...(tees.male || []), ...(tees.female || [])];
                  const teeName =
                    round?.playerTees?.find(
                      (entry) => String(entry.player) === String(player.value)
                    )?.teeName || round?.teeName;
                  const tee =
                    allTees.find((option) => option.tee_name === teeName) ||
                    allTees[0];
                  const courseHandicap = getCourseHandicapForRound(
                    tee,
                    round,
                    player.handicap
                  );
                  return (
                    <Table.Tr key={player.value}>
                      <Table.Td>{player.name}</Table.Td>
                      <Table.Td>
                        {Number.isFinite(courseHandicap) ? courseHandicap : "-"}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant={selected ? "filled" : "light"}
                          color={selected ? "club" : "dusk"}
                          onClick={() => togglePlayer(player.value)}
                          disabled={isClosed || !canManageAllGroups}
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
                setSelectedPlayers(capturablePlayers.map((player) => player._id))
              }
              disabled={
                isClosed || capturablePlayers.length === 0 || !canManageAllGroups
              }
            >
              Seleccionar todos
            </Button>
            <Button
              variant="light"
              onClick={() => setSelectedPlayers([])}
              disabled={isClosed || selectedPlayers.length === 0 || !canManageAllGroups}
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
          <div>
            <Group gap="xs" mb={6}>
              <Text size="sm" fw={600}>
                Jugadores
              </Text>
              <ActionIcon
                size="sm"
                variant="light"
                onClick={() => refreshRecordMultiView({ notify: true })}
                loading={refreshingView}
                aria-label="Actualizar captura"
                title="Actualizar captura"
              >
                <RefreshIcon />
              </ActionIcon>
            </Group>
            <Button
              variant="light"
              onClick={() => setPlayersModalOpen(true)}
              disabled={isClosed}
            >
              {selectedPlayers.length > 0
                ? `Editar jugadores (${selectedPlayers.length})`
                : "Seleccionar jugadores"}
            </Button>
          </div>
          <Group align="flex-end" mt="xs">
            <Select
              label="Hoyo"
              placeholder="Selecciona hoyo"
              data={holeOptions}
              value={selectedHole}
              onChange={setSelectedHole}
            />
          </Group>
          <Group justify="space-between" mt="xs">
            <Button
              variant="light"
              component="a"
              href={`/rounds/${params?.id}/record`}
            >
              Mi tarjeta
            </Button>
            <Button
              variant="light"
              component="a"
              href={`/rounds/${params?.id}`}
            >
              Ver tarjeta
            </Button>
          </Group>
          <Group justify="space-between" mt="xs">
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
            const holeMeta = getHoleMetaForPlayer(playerId);
            const meta = holeMeta[holeNumber] || {};
            const locked = card.accepted || isClosed;
            const cardKey = playerId || card._id || `${idx}-${holeNumber}`;
            const progress = getPlayerProgress(card);
            return (
              <Card key={cardKey} mb="sm" p="sm">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Group gap="xs">
                      <Text fw={700}>{card.player?.name || "Jugador"}</Text>
                      <Badge color="dusk" variant="light">
                        {progress.grossTotal}
                      </Badge>
                      <Badge color="club" variant="light">
                        {formatToPar(progress.netToPar)}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dusk.6">
                      Tee: {card.teeName || "Sin tee"}
                    </Text>
                  </div>
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <Badge color={locked ? "dusk" : "club"} variant="light">
                      {locked ? "Bloqueada" : "Editable"}
                    </Badge>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="clay"
                      onClick={() => clearPlayerHoleCapture(playerId)}
                      disabled={locked}
                      title="Borrar captura"
                      aria-label="Borrar captura"
                    >
                      <TrashIcon />
                    </ActionIcon>
                  </Group>
                </Group>
                <Text size="sm" c="dusk.6" mb="xs">
                  Hoyo {holeNumber} · Par {meta.par ?? "-"} · {meta.yardage ?? "--"} yds · HC{" "}
                  {meta.handicap ?? "--"}
                </Text>
                <Group gap="xs" mb="xs">
                  {(() => {
                    const parValue = meta.par;
                    const strokesValue =
                      entry?.strokes === "" || entry?.strokes == null
                        ? null
                        : Number(entry?.strokes);
                    const isBirdie =
                      parValue != null && strokesValue === parValue - 1;
                    const isPar = parValue != null && strokesValue === parValue;
                    const isBogey =
                      parValue != null && strokesValue === parValue + 1;
                    const isZopi =
                      parValue != null && strokesValue === parValue + 2;
                    return (
                      <>
                        <Button
                          size="xs"
                          variant={isBirdie ? "filled" : "light"}
                          onClick={() => applyStrokePreset(playerId, "birdie")}
                          disabled={locked}
                        >
                          Birdie
                        </Button>
                        <Button
                          size="xs"
                          variant={isPar ? "filled" : "light"}
                          onClick={() => applyStrokePreset(playerId, "par")}
                          disabled={locked}
                        >
                          Par
                        </Button>
                        <Button
                          size="xs"
                          variant={isBogey ? "filled" : "light"}
                          onClick={() => applyStrokePreset(playerId, "bogey")}
                          disabled={locked}
                        >
                          Bogey
                        </Button>
                        <Button
                          size="xs"
                          variant={isZopi ? "filled" : "light"}
                          onClick={() => applyStrokePreset(playerId, "zopi")}
                          disabled={locked}
                        >
                          Zopi
                        </Button>
                      </>
                    );
                  })()}
                </Group>
                <Group gap="xs" mb="xs">
                  {(() => {
                    const puttsValue =
                      entry?.putts === "" || entry?.putts == null
                        ? null
                        : Number(entry?.putts);
                    return (
                      <>
                        <Button
                          size="xs"
                          variant={puttsValue === 0 ? "filled" : "light"}
                          onClick={() => applyPuttPreset(playerId, 0)}
                          disabled={locked}
                        >
                          Hole out
                        </Button>
                        <Button
                          size="xs"
                          variant={puttsValue === 1 ? "filled" : "light"}
                          onClick={() => applyPuttPreset(playerId, 1)}
                          disabled={locked}
                        >
                          1 putt
                        </Button>
                        <Button
                          size="xs"
                          variant={puttsValue === 2 ? "filled" : "light"}
                          onClick={() => applyPuttPreset(playerId, 2)}
                          disabled={locked}
                        >
                          2 putt
                        </Button>
                        <Button
                          size="xs"
                          variant={puttsValue === 3 ? "filled" : "light"}
                          onClick={() => applyPuttPreset(playerId, 3)}
                          disabled={locked}
                        >
                          3 putt
                        </Button>
                      </>
                    );
                  })()}
                </Group>
                <Group grow align="flex-start" mb="xs" gap="xs">
                  <div className="gml-stepper">
                    <Text size="sm" fw={600}>
                      Golpes
                    </Text>
                    <div className="gml-stepper-controls">
                      <Button
                        variant="light"
                        onClick={() => updateNumber(playerId, "strokes", -1)}
                        disabled={locked}
                      >
                        -
                      </Button>
                      <Text fw={700} className="gml-stepper-value">
                        {entry?.strokes == null ? "-" : entry.strokes}
                      </Text>
                      <Button
                        variant="light"
                        onClick={() => updateNumber(playerId, "strokes", 1)}
                        disabled={locked}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="gml-stepper">
                    <Text size="sm" fw={600}>
                      Putts
                    </Text>
                    <div className="gml-stepper-controls">
                      <Button
                        variant="light"
                        onClick={() => updateNumber(playerId, "putts", -1)}
                        disabled={locked}
                      >
                        -
                      </Button>
                      <Text fw={700} className="gml-stepper-value">
                        {entry?.putts == null ? "-" : entry.putts}
                      </Text>
                      <Button
                        variant="light"
                        onClick={() => updateNumber(playerId, "putts", 1)}
                        disabled={locked}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </Group>
                <Group gap="xs" mb="xs">
                  <Button
                    size="xs"
                    variant={entry?.water ? "filled" : "light"}
                    color="blue"
                    onClick={() =>
                      updatePlayerHole(playerId, { water: !entry?.water })
                    }
                    disabled={locked}
                    className="gml-score-btn"
                  >
                    Wet
                  </Button>
                  {meta.par === 3 ? (
                    <Button
                      size="xs"
                      variant={entry?.ohYes ? "filled" : "light"}
                      color="clay"
                      onClick={() =>
                        updatePlayerHole(playerId, { ohYes: !entry?.ohYes })
                      }
                      disabled={locked}
                      className="gml-score-btn"
                    >
                      Oh yes
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant={entry?.sandy ? "filled" : "light"}
                    color="yellow"
                    onClick={() =>
                      updatePlayerHole(playerId, { sandy: !entry?.sandy })
                    }
                    disabled={locked}
                    className="gml-score-btn"
                  >
                    Sandy
                  </Button>
                </Group>
                <div style={{ marginTop: "0.75rem" }}>
                  <Text size="sm" fw={600} mb={6}>
                    Castigos
                  </Text>
                  <Group gap="xs">
                    {PENALTIES.map((penalty) => {
                      const active = entry?.penalties?.includes(penalty.value);
                      return (
                        <Button
                          key={penalty.value}
                          size="xs"
                          variant={active ? "filled" : "light"}
                          color={active ? "clay" : "dusk"}
                          onClick={() =>
                            updatePlayerHole(playerId, {
                              penalties: togglePenaltyValue(
                                entry?.penalties,
                                penalty.value
                              ),
                            })
                          }
                          disabled={locked}
                          className="gml-score-btn"
                        >
                          {penalty.label}
                        </Button>
                      );
                    })}
                  </Group>
                </div>
              </Card>
            );
          })
        )}

        <Group justify="space-between" mt="lg">
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
      </AppShell>
    </main>
  );
}
