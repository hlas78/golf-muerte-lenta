"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Accordion,
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
import AppShell from "../../components/AppShell";
import { getSocket } from "@/lib/socketClient";
import { getCourseHandicapForRound } from "@/lib/scoring";
import { normalizeHoleHandicaps } from "@/lib/scoring";

const PENALTY_LABELS = {
  pinkies: "Pinkies",
  cuatriputt: "Cuatriputt",
  saltapatras: "Saltapatras",
  paloma: "Paloma",
  nerdina: "Nerdiña",
  whiskeys: "Whiskeys",
};

const ITEM_LABELS = {
  holeWinner: "Ganador de hoyo",
  medalFront: "Medal vuelta 1",
  medalBack: "Medal vuelta 2",
  match: "Ganador de match",
  sandyPar: "Sandy",
  birdie: "Birdie",
  eagle: "Aguila",
  albatross: "Albatross",
  holeOut: "Hole out",
  wetPar: "Wet par",
  ohYes: "Oh yes",
};

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
  const [scorecards, setScorecards] = useState([]);
  const [viewMode, setViewMode] = useState("gross");
  const [summary, setSummary] = useState(null);
  const [settling, setSettling] = useState(false);
  const [allAccepted, setAllAccepted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [optimizedTransfers, setOptimizedTransfers] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCardId, setUploadingCardId] = useState(null);
  const [uploadConfirmCard, setUploadConfirmCard] = useState(null);
  const [teesModalOpen, setTeesModalOpen] = useState(false);
  const [exportingRound, setExportingRound] = useState(false);
  const [removePlayerOpen, setRemovePlayerOpen] = useState(false);
  const [removePlayerId, setRemovePlayerId] = useState("");
  const [removingPlayer, setRemovingPlayer] = useState(false);

  const holes = useMemo(
    () => Array.from({ length: round?.holes || 9 }, (_, idx) => idx + 1),
    [round]
  );
  const router = useRouter();
  const frontHoles = useMemo(() => holes.slice(0, 9), [holes]);
  const backHoles = useMemo(() => holes.slice(9, 18), [holes]);
  const holeMeta = useMemo(() => {
    const tees = round?.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const selected =
      allTees.find((tee) => tee.tee_name === round?.teeName) || allTees[0];
    const normalized = normalizeHoleHandicaps(selected?.holes || [], round);
    return normalized.reduce((acc, hole, idx) => {
      acc[hole.hole ?? idx + 1] = hole;
      return acc;
    }, {});
  }, [round]);

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
      loadScorecards();
    });

    return () => {
      socket.off("scorecard:update");
    };
  }, [round]);

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
      .then((data) => {
        setSummary(data);
        if (Array.isArray(data.payments)) {
          setOptimizedTransfers(minimizeTransfers(data.payments));
        }
      })
      .catch(() => setSummary(null));
  }, [params]);

  const courseName = round?.courseSnapshot?.clubName
    ? round.courseSnapshot.clubName
    : round?.courseSnapshot?.courseName || "Jugada";

  const players = useMemo(() => round?.players || [], [round]);
  const playerTees = useMemo(() => round?.playerTees || [], [round]);
  const playerTeeMap = useMemo(() => {
    return playerTees.reduce((acc, entry) => {
      acc[String(entry.player)] = entry.teeName;
      return acc;
    }, {});
  }, [playerTees]);
  const isJoined = useMemo(
    () =>
      Boolean(
        me?._id &&
          players.some((player) => String(player._id) === String(me._id))
      ),
    [me, players]
  );
  const canManage = me?.role === "admin" || me?.role === "supervisor";
  const canApprove = canManage;
  const isClosed = round?.status === "closed";
  const isAdmin = me?.role === "admin";

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

  const winningCells = useMemo(() => {
    if (!Array.isArray(summary?.payments)) {
      return {};
    }
    return summary.payments.reduce((acc, payment) => {
      if (!payment.hole) {
        return acc;
      }
      const playerId = String(payment.to);
      if (!acc[playerId]) {
        acc[playerId] = new Set();
      }
      acc[playerId].add(payment.hole);
      return acc;
    }, {});
  }, [summary]);

  const winningTotals = useMemo(() => {
    if (!Array.isArray(summary?.payments)) {
      return {};
    }
    return summary.payments.reduce((acc, payment) => {
      const playerId = String(payment.to);
      if (!acc[playerId]) {
        acc[playerId] = new Set();
      }
      acc[playerId].add(payment.item);
      return acc;
    }, {});
  }, [summary]);

  const holeHandicapsByPlayer = useMemo(() => {
    const tees = round?.courseSnapshot?.tees;
    if (!tees || !scorecards.length) {
      return {};
    }
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    return scorecards.reduce((acc, card) => {
      const playerId = card.player?._id?.toString();
      if (!playerId) {
        return acc;
      }
      const teeName =
        card.teeName ||
      playerTeeMap[String(playerId)] ||
      round?.teeName;
      const selected =
        allTees.find((tee) => tee.tee_name === teeName) || allTees[0];
      const normalized = normalizeHoleHandicaps(selected?.holes || [], round);
      acc[playerId] =
        normalized.map((hole, idx) => ({
          hole: hole.hole ?? idx + 1,
          handicap: hole.handicap,
        })) || [];
      return acc;
    }, {});
  }, [round, scorecards]);

  const getHoleHandicapsForCard = (card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) {
      return [];
    }
    return holeHandicapsByPlayer[playerId] || [];
  };

  const showAdvantages =
    Array.isArray(summary?.payments) && summary.payments.length > 0;
  const minCourseHandicap = useMemo(() => {
    if (!scorecards.length) {
      return 0;
    }
    return scorecards.reduce((min, entry) => {
      const value = Number.isFinite(entry.courseHandicap)
        ? entry.courseHandicap
        : entry.player?.handicap || 0;
      return value < min ? value : min;
    }, Number.POSITIVE_INFINITY);
  }, [scorecards]);
  const advantageStrokesByPlayer = useMemo(() => {
    if (!showAdvantages || !round?.holes) {
      return {};
    }
    return scorecards.reduce((acc, card) => {
      const playerId = card.player?._id?.toString();
      if (!playerId) {
        return acc;
      }
      const handicaps = getHoleHandicapsForCard(card);
      const courseHandicap = Number.isFinite(card.courseHandicap)
        ? card.courseHandicap
        : card.player?.handicap || 0;
      const relativeHandicap = Math.max(
        0,
        courseHandicap -
          (Number.isFinite(minCourseHandicap) ? minCourseHandicap : 0)
      );
      acc[playerId] = buildStrokesMap(
        relativeHandicap,
        handicaps,
        round.holes
      );
      return acc;
    }, {});
  }, [scorecards, round, minCourseHandicap, showAdvantages]);

  const courseHandicapByPlayer = useMemo(() => {
    if (!scorecards.length) {
      return {};
    }
    const tees = round?.courseSnapshot?.tees;
    const allTees = tees
      ? [...(tees.male || []), ...(tees.female || [])]
      : [];
    return scorecards.reduce((acc, card) => {
      const playerId = card.player?._id?.toString();
      if (!playerId) {
        return acc;
      }
      if (Number.isFinite(card.courseHandicap)) {
        acc[playerId] = card.courseHandicap;
        return acc;
      }
      if (!allTees.length) {
        acc[playerId] = card.player?.handicap ?? "-";
        return acc;
      }
      const teeName =
        card.teeName ||
        playerTeeMap[String(playerId)] ||
        round?.teeName;
      const selected =
        allTees.find((tee) => tee.tee_name === teeName) || allTees[0];
      if (!selected) {
        acc[playerId] = card.player?.handicap ?? "-";
        return acc;
      }
      acc[playerId] = getCourseHandicapForRound(
        selected,
        round,
        card.player?.handicap || 0
      );
      return acc;
    }, {});
  }, [round, scorecards]);

  const getCourseHandicapForCard = (card) => {
    const playerId = card.player?._id?.toString();
    if (!playerId) {
      return "-";
    }
    return courseHandicapByPlayer[playerId] ?? "-";
  };

  function buildStrokesMap(handicap, holeHandicaps, holesCount) {
    const strokesPerHole = {};
    const base = Math.floor(handicap / holesCount);
    const extra = handicap % holesCount;
    const sorted = holeHandicaps
      .slice(0, holesCount)
      .map((hole) => ({ hole: hole.hole, rank: hole.handicap }))
      .sort((a, b) => a.rank - b.rank);
    sorted.forEach((hole, idx) => {
      strokesPerHole[hole.hole] = base + (idx < extra ? 1 : 0);
    });
    return strokesPerHole;
  }

  const getTotalForHoles = (card, holeList) => {
    if (!Array.isArray(holeList) || holeList.length === 0) {
      return "-";
    }
    if (viewMode === "gross") {
      return (
        holeList.reduce((sum, hole) => {
          const entry = card.holes?.find((item) => item.hole === hole);
          return sum + (entry?.strokes || 0);
        }, 0) || "-"
      );
    }
    const holesCount = round?.holes || 18;
    const handicaps = getHoleHandicapsForCard(card);
    const playerId = card.player?._id?.toString();
    const fallbackHandicap =
      (playerId ? courseHandicapByPlayer[playerId] : undefined) ??
      card.player?.handicap ??
      0;
    const courseHandicap = Number.isFinite(card.courseHandicap)
      ? card.courseHandicap
      : fallbackHandicap;
    const relativeHandicap = Math.max(
      0,
      courseHandicap - (Number.isFinite(minCourseHandicap) ? minCourseHandicap : 0)
    );
    const strokesMap = buildStrokesMap(
      relativeHandicap,
      handicaps,
      holesCount
    );
    return (
      holeList.reduce((sum, hole) => {
        const entry = card.holes?.find((item) => item.hole === hole);
        const strokes = entry?.strokes || 0;
        return sum + (strokes - (strokesMap[hole] || 0));
      }, 0) || "-"
    );
  };

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

  const handleUploadGrint = async (scorecardId) => {
    if (!scorecardId) {
      return;
    }
    setUploadingCardId(scorecardId);
    try {
      const res = await fetch("/api/grint/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scorecardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar la tarjeta.");
      }
      notifications.show({
        title: "Tarjeta enviada",
        message: "Se cargo en TheGrint",
        color: "club",
      });
      loadScorecards();
    } catch (error) {
      notifications.show({
        title: "No se pudo cargar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setUploadingCardId(null);
    }
  };

  const handleExportRound = async () => {
    if (!params?.id) {
      return;
    }
    setExportingRound(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/export`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo exportar la jugada.");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (courseName || "jugada")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .toLowerCase();
      link.href = url;
      link.download = `gml-round-${safeName}-${params.id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notifications.show({
        title: "Jugada exportada",
        message: "Archivo generado correctamente.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo exportar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setExportingRound(false);
    }
  };


  const handleRemovePlayer = async () => {
    if (!params?.id || !removePlayerId) {
      return;
    }
    setRemovingPlayer(true);
    try {
      const res = await fetch(
        `/api/rounds/${params.id}/players/${removePlayerId}/remove`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el jugador.");
      }
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
      loadScorecards();
      setRemovePlayerOpen(false);
      setRemovePlayerId("");
      notifications.show({
        title: "Jugador eliminado",
        message: "Se removio de la jugada correctamente.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo eliminar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setRemovingPlayer(false);
    }
  };

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
      if (Array.isArray(data.payments)) {
        setOptimizedTransfers(minimizeTransfers(data.payments));
      }
      loadScorecards();
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


  const minimizeTransfers = (payments) => {
    const summaryMap = {};
    payments.forEach((payment) => {
      const from = String(payment.from);
      const to = String(payment.to);
      summaryMap[from] = (summaryMap[from] || 0) - payment.amount;
      summaryMap[to] = (summaryMap[to] || 0) + payment.amount;
    });

    const debtors = [];
    const creditors = [];
    Object.entries(summaryMap).forEach(([playerId, amount]) => {
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
  };

  const isCardComplete = (card) => {
    if (!round?.holes) {
      return false;
    }
    for (let i = 1; i <= round.holes; i += 1) {
      const entry = card.holes?.find((hole) => hole.hole === i);
      if (entry?.strokes == null || entry.strokes === "") {
        return false;
      }
    }
    return true;
  };

  const handleDeleteRound = async () => {
    if (!round?._id) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/rounds/${round._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar la jugada.");
      }
      router.push("/");
    } catch (error) {
      notifications.show({
        title: "No se pudo eliminar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <main>
      <AppShell title="Jugada activa" subtitle={loading ? "Cargando..." : ""}>
      <Modal
        opened={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar jugada"
      >
        <Text size="sm" c="dusk.6" mb="md">
            Esto elimina la jugada, sus tarjetas y pagos. Esta accion no se puede
            deshacer.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button color="clay" onClick={handleDeleteRound} loading={deleting}>
              Eliminar
            </Button>
          </Group>
        </Modal>
        <Modal
          opened={teesModalOpen}
          onClose={() => setTeesModalOpen(false)}
          title="Editar tees de salida"
          centered
        >
          {players.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay jugadores en la jugada.
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
                <Select
                  data={teeOptions}
                  value={playerTeeMap[String(player._id)] || ""}
                  onChange={(value) => handleUpdateTee(player._id, value)}
                  placeholder="Sin tee"
                  disabled={updatingTee === player._id}
                />
              </Group>
            ))
          )}
        </Modal>
        <Modal
          opened={removePlayerOpen}
          onClose={() => setRemovePlayerOpen(false)}
          title="Eliminar jugador"
          centered
        >
          {players.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay jugadores en la jugada.
            </Text>
          ) : (
            <>
              <Text size="sm" c="dusk.6" mb="sm">
                Selecciona al jugador que deseas eliminar.
              </Text>
              <Select
                data={players.map((player) => ({
                  value: player._id,
                  label: player.name,
                }))}
                value={removePlayerId}
                onChange={(value) => setRemovePlayerId(value || "")}
                placeholder="Selecciona jugador"
                mb="md"
              />
              <Button
                color="clay"
                fullWidth
                onClick={handleRemovePlayer}
                loading={removingPlayer}
                disabled={!removePlayerId}
              >
                Confirmar eliminacion
              </Button>
            </>
          )}
        </Modal>
        <Card mb="lg">
          <Group justify="space-between">
            <div>
              <Text fw={700}>{courseName}</Text>
            </div>
            <Group>
              {!isJoined && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleJoin}
                  loading={joining}
                >
                  Unirme
                </Button>
              ) : null}
              {isJoined && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  component="a"
                  href={`/rounds/${params?.id}/record`}
                >
                  Editar tarjeta
                </Button>
              ) : null}
              {canManage && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setTeesModalOpen(true)}
                >
                  Editar tees
                </Button>
              ) : null}
              {canApprove && !isClosed ? (
                <Button
                  size="xs"
                  variant="light"
                  color="clay"
                  onClick={() => setRemovePlayerOpen(true)}
                >
                  Eliminar jugador
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
                  component={Link}
                  href={`/rounds/${params?.id}/record-multi`}
                >
                  Captura por hoyo
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
              {isAdmin ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleExportRound}
                  loading={exportingRound}
                >
                  Exportar
                </Button>
              ) : null}
              {isAdmin ? (
                <Button
                  size="xs"
                  variant="light"
                  color="clay"
                  onClick={() => setDeleteOpen(true)}
                >
                  Eliminar
                </Button>
              ) : null}
              {/* <Badge color={isClosed ? "dusk" : "club"}>
                {isClosed ? "Cerrada" : "En juego"}
              </Badge> */}
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
                  {/* <Table.Th>Estado</Table.Th> */}
                  {canApprove ? <Table.Th>Accion</Table.Th> : null}
                  <Table.Th>HC tee</Table.Th>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th className="gml-sticky-col">Par</Table.Th>
                  {holes.map((hole) => (
                    <Table.Th key={`par-${hole}`}>
                      {holeMeta[hole]?.par ?? "-"}
                    </Table.Th>
                  ))}
                  <Table.Th />
                  <Table.Th />
                  <Table.Th />
                  <Table.Th />
                  {canApprove ? <Table.Th /> : null}
                  <Table.Th />
                </Table.Tr>
                <Table.Tr>
                  <Table.Th className="gml-sticky-col">HC</Table.Th>
                  {holes.map((hole) => (
                    <Table.Th key={`hc-${hole}`}>
                      {holeMeta[hole]?.handicap ?? "-"}
                    </Table.Th>
                  ))}
                  <Table.Th />
                  <Table.Th />
                  <Table.Th />
                  <Table.Th />
                  {canApprove ? <Table.Th /> : null}
                  <Table.Th />
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
                  scorecards.map((card) => {
                    const playerId = card.player?._id?.toString();
                    const strokesMap = playerId
                      ? advantageStrokesByPlayer[playerId] || {}
                      : {};
                    return (
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
                          const wet = entry?.water;
                          const isWinningCell = Boolean(
                            playerId && winningCells[playerId]?.has(hole)
                          );
                          const advantageCount = showAdvantages
                            ? strokesMap[hole] || 0
                            : 0;
                          return (
                            <Table.Td
                              key={hole}
                              className={[
                                isWinningCell ? "gml-win-cell" : "",
                                advantageCount > 0 ? "gml-advantage-cell" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {advantageCount > 0 ? (
                                <span className="gml-advantage">
                                  {"•".repeat(advantageCount)}
                                </span>
                              ) : null}
                              {strokes}
                              {putts != null ? ` (${putts})` : ""}
                              {ohYes ? " · OY" : ""}
                              {sandy ? " · S" : ""}
                              {wet ? " · W" : ""}
                            </Table.Td>
                          );
                        })}
                      <Table.Td
                        className={
                          card.player?._id &&
                          winningTotals[String(card.player._id)]?.has(
                            "medalFront"
                          )
                            ? "gml-win-cell"
                            : undefined
                        }
                      >
                        {getTotalForHoles(card, frontHoles)}
                      </Table.Td>
                      <Table.Td
                        className={
                          card.player?._id &&
                          winningTotals[String(card.player._id)]?.has(
                            "medalBack"
                          )
                            ? "gml-win-cell"
                            : undefined
                        }
                      >
                        {getTotalForHoles(card, backHoles)}
                      </Table.Td>
                      <Table.Td
                        className={
                          card.player?._id &&
                          winningTotals[String(card.player._id)]?.has("match")
                            ? "gml-win-cell"
                            : undefined
                        }
                      >
                        {viewMode === "net"
                          ? card.netTotal ?? "-"
                          : card.grossTotal ?? "-"}
                      </Table.Td>
                      <Table.Td>{card.puttsTotal ?? "-"}</Table.Td>
                      {/* <Table.Td>
                        <Badge
                          color={card.accepted ? "club" : "dusk"}
                          variant="light"
                        >
                          {card.accepted ? "Aceptada" : "Pendiente"}
                        </Badge>
                      </Table.Td> */}
                      {canApprove ? (
                        <Table.Td>
                          <Group gap="xs" className="gml-cell-actions">
                            <Button
                              size="xs"
                              variant="light"
                              component="a"
                              href={`/rounds/${params?.id}/record?playerId=${card.player?._id}`}
                              className="gml-btn-tight"
                            >
                              Editar
                            </Button>
                            {card.accepted &&
                            !card.grintUploadedAt &&
                            me?._id &&
                            String(card.player?._id) === String(me._id) ? (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => setUploadConfirmCard(card)}
                                loading={uploadingCardId === card._id}
                                className="gml-btn-tight"
                              >
                                Subir a Grint
                              </Button>
                            ) : null}
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => handleAccept(card._id)}
                              disabled={
                                card.accepted ||
                                !isCardComplete(card)
                              }
                              className="gml-btn-tight"
                            >
                              {card.accepted ? "Listo" : "Aceptar"}
                            </Button>
                          </Group>
                        </Table.Td>
                      ) : null}
                        <Table.Td>{getCourseHandicapForCard(card)}</Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </div>
        </Card>

        <Card mt="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Castigos</Text>
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
                </div>
              </Group>
            ))
          )}
        </Card>


        {/* <Card mt="lg">
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
        </Card> */}

        <Card mt="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Resumen de pagos</Text>
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
                          const label =
                            ITEM_LABELS[payment.item] || payment.item;
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
                              <Text
                                size="sm"
                                c={isWin ? "club.7" : "clay.7"}
                              >
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
          </Group>
          {optimizedTransfers.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay transacciones optimizadas para mostrar.
            </Text>
          ) : (
            optimizedTransfers.map((transfer, idx) => {
              const fromPlayer = scorecards.find(
                (card) => String(card.player?._id) === String(transfer.from)
              )?.player?.name;
              const toPlayer = scorecards.find(
                (card) => String(card.player?._id) === String(transfer.to)
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
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Unirme a la jugada"
        centered
      >
        <Text size="sm" c="dusk.6" mb="sm">
          Selecciona tu tee de salida para {courseName}.
        </Text>
        <Select
          placeholder="Selecciona tee"
          data={teeOptions}
          value={joinTee}
          onChange={setJoinTee}
        />
        <Text size="xs" c="dusk.6" mt="sm">
          Te vas a unir con tee {joinTee || "-"}.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            color="club"
            onClick={confirmJoin}
            loading={joining}
            disabled={!joinTee}
          >
            Confirmar
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={Boolean(uploadConfirmCard)}
        onClose={() => setUploadConfirmCard(null)}
        title="Confirmar subida a TheGrint"
        centered
      >
        {uploadConfirmCard ? (
          <>
            <Text size="sm" c="dusk.6" mb="sm">
              Revisa el resumen antes de enviar la tarjeta.
            </Text>
            <Text fw={600}>{uploadConfirmCard.player?.name || "Jugador"}</Text>
            <Text size="sm" c="dusk.6">
              Tee: {uploadConfirmCard.teeName || "Sin tee"}
            </Text>
            <Text size="sm" c="dusk.6">
              Campo: {courseName}
            </Text>
            <Text size="sm" c="dusk.6">
              Hoyos: {round?.holes || "-"}
            </Text>
            <Text size="sm" c="dusk.6">
              Total Golpes: {uploadConfirmCard.grossTotal ?? "-"} · Putts:{" "}
              {uploadConfirmCard.puttsTotal ?? "-"}
            </Text>
          </>
        ) : null}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => setUploadConfirmCard(null)}>
            Cancelar
          </Button>
          <Button
            color="club"
            onClick={() => {
              if (uploadConfirmCard?._id) {
                handleUploadGrint(uploadConfirmCard._id);
              }
              setUploadConfirmCard(null);
            }}
            loading={uploadingCardId === uploadConfirmCard?._id}
          >
            Confirmar
          </Button>
        </Group>
      </Modal>
    </main>
  );
}
