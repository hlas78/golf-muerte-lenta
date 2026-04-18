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
  NumberInput,
  Switch,
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
  berrinche: "Berrinche",
};

const ITEM_LABELS = {
  holeWinner: "",
  medalFront: "Medal vuelta 1",
  medalBack: "Medal vuelta 2",
  match: "Match",
  sandyPar: "Sandy",
  birdie: "Birdie",
  eagle: "Aguila",
  albatross: "Albatross",
  holeOut: "Hole out",
  wetPar: "Wet par",
  ohYes: "Oh yes",
  culebra: "Culebra",
  indFront: "Medal v1",
  indBack: "Medal v2",
  indRound: "Match",
  indHole: "Hoyo",
  indBirdie: "Birdie+",
  indSandy: "Sandy",
  indWet: "Wet",
  indOhYes: "Oh yes",
};

const ITEM_ORDER = Object.keys(ITEM_LABELS);
const GROUP_ITEMS = new Set([
  "holeWinner",
  "medalFront",
  "medalBack",
  "match",
  "sandyPar",
  "birdie",
  "eagle",
  "albatross",
  "holeOut",
  "wetPar",
  "ohYes",
]);

const formatRoundDate = (value) => {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }
  return date.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [betsOpen, setBetsOpen] = useState(false);
  const [betEditOpen, setBetEditOpen] = useState(false);
  const [betsDraft, setBetsDraft] = useState({});
  const [individualBetsDraft, setIndividualBetsDraft] = useState([]);
  const [betDraft, setBetDraft] = useState(null);
  const [culebraDraft, setCulebraDraft] = useState({
    enabled: false,
    players: [],
    amount: 0,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCardId, setUploadingCardId] = useState(null);
  const [uploadConfirmCard, setUploadConfirmCard] = useState(null);
  const [teesModalOpen, setTeesModalOpen] = useState(false);
  const [exportingRound, setExportingRound] = useState(false);
  const [removePlayerOpen, setRemovePlayerOpen] = useState(false);
  const [removePlayerId, setRemovePlayerId] = useState("");
  const [removingPlayer, setRemovingPlayer] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [addPlayerId, setAddPlayerId] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

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
    const allowed = me?.role === "admin" || me?.role === "supervisor";
    if (!allowed) {
      return;
    }
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => setAllUsers([]));
  }, [me?.role]);

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

  const sortedScorecards = useMemo(
    () =>
      [...scorecards].sort((a, b) => {
        const groupA =
          round?.playerGroups?.find(
            (entry) => String(entry.player) === String(a.player?._id)
          )?.group || 1;
        const groupB =
          round?.playerGroups?.find(
            (entry) => String(entry.player) === String(b.player?._id)
          )?.group || 1;
        if (groupA !== groupB) {
          return groupA - groupB;
        }
        return (a.player?.name || "").localeCompare(b.player?.name || "", "es", {
          sensitivity: "base",
        });
      }),
    [scorecards, round?.playerGroups]
  );

  const defaultBets = {
    holeWinner: 0,
    medal: 0,
    match: 0,
    sandyPar: 0,
    birdie: 0,
    eagle: 0,
    albatross: 0,
    holeOut: 0,
    wetPar: 0,
    ohYes: 0,
    culebra: 0,
  };

  const roundPlayers = useMemo(() => {
    if (Array.isArray(round?.players) && round.players.length > 0) {
      return round.players;
    }
    return scorecards.map((card) => card.player).filter(Boolean);
  }, [round?.players, scorecards]);

  const playerOptions = roundPlayers.map((player) => ({
    value: String(player._id),
    label: player.name,
    name: player.name,
  }));

  const openBetsModal = () => {
    const snapshot = round?.configSnapshot;
    const baseBets =
      snapshot && snapshot.bets ? snapshot.bets : snapshot || {};
    setBetsDraft({ ...defaultBets, ...baseBets });
    setIndividualBetsDraft(
      Array.isArray(snapshot?.individualBets) ? snapshot.individualBets : []
    );
    setCulebraDraft({
      enabled: Boolean(snapshot?.culebra?.enabled),
      players: Array.isArray(snapshot?.culebra?.players)
        ? snapshot.culebra.players
        : [],
      amount:
        Number(snapshot?.culebra?.amount) ||
        Number(baseBets?.culebra) ||
        0,
    });
    setBetsOpen(true);
  };

  const createEmptyBet = () => ({
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerA: "",
    playerB: "",
    accumulateOnTie: false,
    amounts: {
      front: 0,
      back: 0,
      round: 0,
      hole: 0,
      birdie: 0,
      sandy: 0,
      wet: 0,
      ohYes: 0,
    },
  });

  const openNewBet = () => {
    setBetDraft(createEmptyBet());
    setBetEditOpen(true);
  };

  const editBet = (bet) => {
    setBetDraft({
      ...bet,
      accumulateOnTie: Boolean(bet.accumulateOnTie),
      amounts: { ...bet.amounts },
    });
    setBetEditOpen(true);
  };

  const saveBet = () => {
    if (!betDraft?.playerA || !betDraft?.playerB) {
      notifications.show({
        title: "Faltan jugadores",
        message: "Selecciona ambos jugadores.",
        color: "clay",
      });
      return;
    }
    if (betDraft.playerA === betDraft.playerB) {
      notifications.show({
        title: "Jugadores invalidos",
        message: "Selecciona jugadores distintos.",
        color: "clay",
      });
      return;
    }
    setIndividualBetsDraft((prev) => {
      const exists = prev.find((bet) => bet.id === betDraft.id);
      if (exists) {
        return prev.map((bet) => (bet.id === betDraft.id ? betDraft : bet));
      }
      return [...prev, betDraft];
    });
    setBetEditOpen(false);
    setBetDraft(null);
  };

  const removeBet = (betId) => {
    setIndividualBetsDraft((prev) => prev.filter((bet) => bet.id !== betId));
  };

  const saveBetsConfig = async () => {
    if (!params?.id) {
      return;
    }
    try {
      const res = await fetch(`/api/rounds/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configSnapshot: {
            system: "group",
            bets: betsDraft,
            individualBets: individualBetsDraft,
            culebra: culebraDraft,
            notificationsMuted:
              round?.configSnapshot?.notificationsMuted !== false,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar.");
      }
      const updated = await res.json();
      setRound(updated);
      await handleSettle();
      setBetsOpen(false);
      notifications.show({
        title: "Apuestas actualizadas",
        message: "Se aplicaron los cambios.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo guardar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    }
  };

  const handleToggleNotifications = async (checked) => {
    if (!params?.id) {
      return;
    }
    try {
      const currentSnapshot = round?.configSnapshot || {};
      const res = await fetch(`/api/rounds/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configSnapshot: {
            ...currentSnapshot,
            notificationsMuted: !checked,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar.");
      }
      const updated = await res.json();
      setRound(updated);
      notifications.show({
        title: "Notificaciones actualizadas",
        message: checked ? "Se activaron." : "Se silenciaron.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo guardar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    }
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
  const canUploadAnyOwnGrint = useMemo(
    () =>
      Boolean(
        me?._id &&
          scorecards.some(
            (card) =>
              card.accepted &&
              !card.grintUploadedAt &&
              String(card.player?._id) === String(me._id)
          )
      ),
    [me?._id, scorecards]
  );
  const showActionColumn = canApprove || canUploadAnyOwnGrint;
  const roundStartAt = round?.startedAt || round?.createdAt;
  const roundStartLabel = loading
    ? "Cargando..."
    : `Inicio: ${formatRoundDate(roundStartAt)}`;

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

  const groupBetsConfig = useMemo(() => {
    const snapshot = round?.configSnapshot || {};
    return snapshot.bets || snapshot || {};
  }, [round?.configSnapshot]);

  const winningCells = useMemo(() => {
    if (!Array.isArray(summary?.payments)) {
      return {};
    }
    return summary.payments.reduce((acc, payment) => {
      if (!payment.hole || !GROUP_ITEMS.has(payment.item)) {
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

  const showAdvantages = Boolean(round?.holes) && scorecards.length > 0;
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
    if (!round?.holes) {
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
  }, [scorecards, round, minCourseHandicap]);

  const liveWinningCells = useMemo(() => {
    if (
      !scorecards.length ||
      !round?.holes ||
      !(Number(groupBetsConfig?.holeWinner) > 0)
    ) {
      return {};
    }
    const winners = {};
    for (let hole = 1; hole <= round.holes; hole += 1) {
      const netScores = scorecards
        .map((card) => {
          const playerId = card.player?._id?.toString();
          if (!playerId) {
            return null;
          }
          const entry = card.holes?.find((item) => item.hole === hole);
          if (entry?.strokes == null || entry.strokes === "") {
            return null;
          }
          const strokesMap = advantageStrokesByPlayer[playerId] || {};
          const net = (entry.strokes || 0) - (strokesMap[hole] || 0);
          return { playerId, net };
        })
        .filter(Boolean);
      if (!netScores.length) {
        continue;
      }
      const min = Math.min(...netScores.map((entry) => entry.net));
      const tied = netScores.filter((entry) => entry.net === min);
      if (tied.length === 1) {
        const winnerId = tied[0].playerId;
        if (!winners[winnerId]) {
          winners[winnerId] = new Set();
        }
        winners[winnerId].add(hole);
      }
    }
    return winners;
  }, [scorecards, round, advantageStrokesByPlayer, groupBetsConfig]);

  const liveBonusCells = useMemo(() => {
    if (!scorecards.length || !round?.holes) {
      return {};
    }
    const bonuses = {};
    scorecards.forEach((card) => {
      const playerId = card.player?._id?.toString();
      if (!playerId) {
        return;
      }
      card.holes?.forEach((entry) => {
        if (!entry?.hole) {
          return;
        }
        const strokes = entry.strokes;
        if (strokes == null || strokes === "") {
          return;
        }
        const par = holeMeta[entry.hole]?.par;
        const diff =
          Number.isFinite(par) && Number.isFinite(strokes)
            ? strokes - par
            : null;
        const isBirdieOrBetter = diff != null && diff <= -1;
        const isSandyParOrBetter =
          Number(groupBetsConfig?.sandyPar) > 0 &&
          entry.sandy &&
          diff != null &&
          diff <= 0;
        const isWetParOrBetter =
          Number(groupBetsConfig?.wetPar) > 0 &&
          entry.water &&
          diff != null &&
          diff <= 0;
        const isHoleOut =
          Number(groupBetsConfig?.holeOut) > 0 &&
          entry.putts === 0 &&
          ((entry.holeOut && Number.isFinite(strokes)) ||
            (diff != null && diff <= 0));
        const isOhYes =
          Number(groupBetsConfig?.ohYes) > 0 && par === 3 && entry.ohYes;
        if (
          (Number(groupBetsConfig?.birdie) > 0 && isBirdieOrBetter) ||
          isSandyParOrBetter ||
          isWetParOrBetter ||
          isHoleOut ||
          isOhYes
        ) {
          if (!bonuses[playerId]) {
            bonuses[playerId] = new Set();
          }
          bonuses[playerId].add(entry.hole);
        }
      });
    });
    return bonuses;
  }, [scorecards, round, holeMeta, groupBetsConfig]);

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

  const winningTotals = useMemo(() => {
    if (Array.isArray(summary?.payments)) {
      return summary.payments.reduce((acc, payment) => {
        if (!GROUP_ITEMS.has(payment.item)) {
          return acc;
        }
        const playerId = String(payment.to);
        if (!acc[playerId]) {
          acc[playerId] = new Set();
        }
        acc[playerId].add(payment.item);
        return acc;
      }, {});
    }
    if (!scorecards.length || !round?.holes) {
      return {};
    }
    const totals = {};
    const addWinner = (playerId, item) => {
      if (!playerId) {
        return;
      }
      if (!totals[playerId]) {
        totals[playerId] = new Set();
      }
      totals[playerId].add(item);
    };
    const getNetTotalForRange = (card, holeList) => {
      if (!Array.isArray(holeList) || holeList.length === 0) {
        return null;
      }
      const playerId = card.player?._id?.toString();
      if (!playerId) {
        return null;
      }
      const handicaps = getHoleHandicapsForCard(card);
      const fallbackHandicap =
        (playerId ? courseHandicapByPlayer[playerId] : undefined) ??
        card.player?.handicap ??
        0;
      const courseHandicap = Number.isFinite(card.courseHandicap)
        ? card.courseHandicap
        : fallbackHandicap;
      const relativeHandicap = Math.max(
        0,
        courseHandicap -
          (Number.isFinite(minCourseHandicap) ? minCourseHandicap : 0)
      );
      const strokesMap = buildStrokesMap(
        relativeHandicap,
        handicaps,
        round.holes
      );
      const missing = holeList.some((hole) => {
        const entry = card.holes?.find((item) => item.hole === hole);
        return entry?.strokes == null || entry.strokes === "";
      });
      if (missing) {
        return null;
      }
      return holeList.reduce((sum, hole) => {
        const entry = card.holes?.find((item) => item.hole === hole);
        const strokes = entry?.strokes || 0;
        return sum + (strokes - (strokesMap[hole] || 0));
      }, 0);
    };
    const evaluateWinner = (holeList, item) => {
      const totalsByPlayer = scorecards
        .map((card) => {
          const total = getNetTotalForRange(card, holeList);
          if (total == null) {
            return null;
          }
          return { playerId: String(card.player?._id), total };
        })
        .filter(Boolean);
      if (totalsByPlayer.length !== scorecards.length) {
        return;
      }
      const minValue = Math.min(...totalsByPlayer.map((entry) => entry.total));
      const tied = totalsByPlayer.filter((entry) => entry.total === minValue);
      if (tied.length === 1) {
        addWinner(tied[0].playerId, item);
      }
    };
    evaluateWinner(frontHoles, "medalFront");
    if (round.holes > 9) {
      evaluateWinner(backHoles, "medalBack");
      evaluateWinner(holes, "match");
    }
    return totals;
  }, [
    summary,
    scorecards,
    round,
    frontHoles,
    backHoles,
    holes,
    courseHandicapByPlayer,
    minCourseHandicap,
  ]);

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

  const handleAddPlayer = async () => {
    if (!params?.id || !addPlayerId) {
      return;
    }
    setAddingPlayer(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/players/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: addPlayerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo agregar el jugador.");
      }
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
      loadScorecards();
      setAddPlayerOpen(false);
      setAddPlayerId("");
      notifications.show({
        title: "Jugador agregado",
        message: "Se agrego a la jugada correctamente.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo agregar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setAddingPlayer(false);
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

  const handleReopen = async () => {
    if (!params?.id) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/reopen`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo reabrir la jugada.");
      }
      notifications.show({
        title: "Jugada reabierta",
        message: "Las tarjetas quedaron desbloqueadas.",
        color: "club",
      });
      const updated = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(updated);
    } catch (error) {
      notifications.show({
        title: "Error al reabrir",
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
  const allCardsComplete =
    scorecards.length > 0 && scorecards.every((card) => isCardComplete(card));

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
      <AppShell title="Jugada activa" subtitle={roundStartLabel}>
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
        <Modal
          opened={addPlayerOpen}
          onClose={() => setAddPlayerOpen(false)}
          title="Agregar jugador"
          centered
        >
          {allUsers.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay jugadores disponibles.
            </Text>
          ) : (
            <>
              <Text size="sm" c="dusk.6" mb="sm">
                Selecciona al jugador que deseas agregar.
              </Text>
              <Select
                data={allUsers
                  .filter(
                    (user) =>
                      !players.some(
                        (player) =>
                          String(player._id) === String(user._id)
                      )
                  )
                  .map((user) => ({
                    value: user._id,
                    label: `${user.name} · HC ${user.handicap ?? 0}`,
                  }))}
                value={addPlayerId}
                onChange={(value) => setAddPlayerId(value || "")}
                placeholder="Selecciona jugador"
                mb="md"
              />
              <Button
                color="club"
                fullWidth
                onClick={handleAddPlayer}
                loading={addingPlayer}
                disabled={!addPlayerId}
              >
                Agregar jugador
              </Button>
            </>
          )}
        </Modal>
        <Card mb="lg">
          <Group justify="space-between">
            <div>
              <Text fw={700}>{courseName}</Text>
              <Text size="sm" c="dusk.6">
                Inicio: {formatRoundDate(roundStartAt)}
              </Text>
            </div>
            {isClosed ? (
              <Group>
                {isAdmin ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleReopen}
                    loading={closing}
                  >
                    Reabrir jugada
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
              </Group>
            ) : (
              <Group>
                {!isJoined ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={handleJoin}
                    loading={joining}
                  >
                    Unirme
                  </Button>
                ) : null}
                {isJoined ? (
                  <Button
                    size="xs"
                    variant="light"
                    component="a"
                    href={`/rounds/${params?.id}/record`}
                  >
                    Editar mi tarjeta
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setTeesModalOpen(true)}
                  >
                    Editar tees
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button
                    size="xs"
                    variant="light"
                    color="clay"
                    onClick={() => setRemovePlayerOpen(true)}
                  >
                    Eliminar jugador
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setAddPlayerOpen(true)}
                  >
                    Agregar jugador
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={openBetsModal}
                  >
                    Editar apuestas
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button
                    size="xs"
                    color="club"
                    onClick={handleSettle}
                    loading={settling}
                    disabled={scorecards.length === 0}
                  >
                    Calcular pagos
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button
                    size="xs"
                    variant="light"
                    component={Link}
                    href={`/rounds/${params?.id}/record-multi`}
                  >
                    Captura por hoyo
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Button
                    size="xs"
                    variant="light"
                    component={Link}
                    href={`/rounds/${params?.id}/record-fast`}
                  >
                    Captura rápida
                  </Button>
                ) : null}
                {canApprove ? (
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
                {canApprove ? (
                  <Group gap="xs">
                    <Text size="xs" c="dusk.6">
                      Notificaciones
                    </Text>
                    <Switch
                      size="sm"
                      checked={round?.configSnapshot?.notificationsMuted === false}
                      onChange={(event) =>
                        handleToggleNotifications(event.currentTarget.checked)
                      }
                    />
                  </Group>
                ) : null}
              </Group>
            )}
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
                  {showActionColumn ? <Table.Th>Accion</Table.Th> : null}
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
                  {showActionColumn ? <Table.Th /> : null}
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
                  {showActionColumn ? <Table.Th /> : null}
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedScorecards.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={holes.length + 6 + (showActionColumn ? 1 : 0)}>
                      <Text size="sm" c="dusk.6">
                        Aun no hay tarjetas registradas.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  sortedScorecards.map((card) => {
                    const playerId = card.player?._id?.toString();
                    const strokesMap = playerId
                      ? advantageStrokesByPlayer[playerId] || {}
                      : {};
                    return (
                      <Table.Tr key={card._id}>
                        <Table.Td className="gml-sticky-col">
                          <Group gap="xs">
                            <Badge color="dusk" variant="light">
                              G
                              {round?.playerGroups?.find(
                                (entry) =>
                                  String(entry.player) ===
                                  String(card.player?._id)
                              )?.group || 1}
                              {round?.groupMarshals?.find(
                                (entry) =>
                                  String(entry.player) ===
                                  String(card.player?._id)
                              )
                                ? " · M"
                                : ""}
                            </Badge>
                            <Text size="sm">
                              {card.player?.name || "Jugador"}
                            </Text>
                          </Group>
                        </Table.Td>
                        {holes.map((hole) => {
                          const entry = card.holes?.find(
                            (item) => item.hole === hole
                          );
                          const strokes = entry?.strokes ?? "";
                          const putts = entry?.putts;
                          const ohYes = entry?.ohYes;
                          const sandy = entry?.sandy;
                          const wet = entry?.water;
                          const isWinningCell = Boolean(
                            playerId &&
                              (winningCells[playerId]?.has(hole) ||
                                liveWinningCells[playerId]?.has(hole) ||
                                liveBonusCells[playerId]?.has(hole))
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
                      {showActionColumn ? (
                        <Table.Td>
                          <Group gap="xs" className="gml-cell-actions">
                            {canApprove ? (
                              <Button
                                size="xs"
                                variant="light"
                                component="a"
                                href={`/rounds/${params?.id}/record?playerId=${card.player?._id}`}
                                className="gml-btn-tight"
                              >
                                Editar
                              </Button>
                            ) : null}
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
                            {canApprove ? (
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
                            ) : null}
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
              <Group key={`${item.player}-${item.hole}-${item.penalty}`} mb="sm">
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
            (() => {
              const payments = summary.payments || [];
              const getPlayerName = (id) =>
                scorecards.find(
                  (card) => String(card.player?._id) === String(id)
                )?.player?.name || "Jugador";
              const roundBets = round?.configSnapshot?.individualBets || [];
              const betLabelById = roundBets.reduce((acc, bet) => {
                const nameA = getPlayerName(bet.playerA);
                const nameB = getPlayerName(bet.playerB);
                acc[bet.id] = `Raya individual: ${nameA} vs ${nameB}`;
                return acc;
              }, {});

              const groupPayments = payments.filter((payment) =>
                GROUP_ITEMS.has(payment.item)
              );
              const culebraPayments = payments.filter(
                (payment) => payment.item === "culebra"
              );
              const individualPayments = payments.filter(
                (payment) =>
                  !GROUP_ITEMS.has(payment.item) && payment.item !== "culebra"
              );
              const strokesByPlayerHole = scorecards.reduce((acc, card) => {
                const playerId = card.player?._id?.toString();
                if (!playerId) {
                  return acc;
                }
                const holeStrokes = {};
                (card.holes || []).forEach((hole) => {
                  holeStrokes[hole.hole] = hole.strokes;
                });
                acc[playerId] = holeStrokes;
                return acc;
              }, {});
              const netTotalsByPlayer = scorecards.reduce((acc, card) => {
                const playerId = card.player?._id?.toString();
                if (!playerId) {
                  return acc;
                }
                const strokesMap = advantageStrokesByPlayer[playerId] || {};
                const frontEnd = Math.min(round?.holes || 18, 9);
                const getNetForRange = (start, end) => {
                  let total = 0;
                  for (let hole = start; hole <= end; hole += 1) {
                    const entry = card.holes?.find((item) => item.hole === hole);
                    const strokes = entry?.strokes || 0;
                    total += strokes - (strokesMap[hole] || 0);
                  }
                  return total;
                };
                acc[playerId] = {
                  front: getNetForRange(1, frontEnd),
                  back:
                    (round?.holes || 18) > 9
                      ? getNetForRange(10, round?.holes || 18)
                      : null,
                  match: getNetForRange(1, round?.holes || 18),
                };
                return acc;
              }, {});
              const groupedIndividual = individualPayments.reduce(
                (acc, payment) => {
                  const noteKey = payment.note ? `bet:${payment.note}` : null;
                  const fallbackKey = [String(payment.from), String(payment.to)]
                    .sort()
                    .join("-");
                  const key = noteKey || `pair:${fallbackKey}`;
                  if (!acc[key]) {
                    acc[key] = [];
                  }
                  acc[key].push(payment);
                  return acc;
                },
                {}
              );
              const orderedIndividualKeys = [
                ...roundBets
                  .map((bet) => `bet:${bet.id}`)
                  .filter((key) => key in groupedIndividual),
                ...Object.keys(groupedIndividual).filter(
                  (key) =>
                    !key.startsWith("bet:") &&
                    !roundBets.find((bet) => `bet:${bet.id}` === key)
                ),
              ];

              const renderPlayerBlock = (blockPayments, playerId) => {
                const wins = blockPayments.filter(
                  (payment) => String(payment.to) === playerId
                );
                const losses = blockPayments.filter(
                  (payment) => String(payment.from) === playerId
                );
                if (wins.length === 0 && losses.length === 0) {
                  return null;
                }
                const groupedWins = wins.reduce((acc, payment) => {
                  const label = ITEM_LABELS[payment.item] || "";
                  const holeLabel = payment.hole ? `Hoyo ${payment.hole}` : "";
                  const key = `${label} ${holeLabel ? ` ${holeLabel}` : ""}`;
                  if (!acc[key]) {
                    acc[key] = { amount: 0, extra: "" };
                  }
                  acc[key].amount += payment.amount;
                  if (payment.item === "holeWinner" && payment.hole) {
                    const strokes =
                      strokesByPlayerHole?.[playerId]?.[payment.hole];
                    if (Number.isFinite(strokes)) {
                      acc[key].extra = `· ${strokes} golpes`;
                    }
                  }
                  if (
                    ["medalFront", "medalBack", "match"].includes(payment.item)
                  ) {
                    const netTotals = netTotalsByPlayer[playerId];
                    const net =
                      payment.item === "medalFront"
                        ? netTotals?.front
                        : payment.item === "medalBack"
                          ? netTotals?.back
                          : netTotals?.match;
                    if (Number.isFinite(net)) {
                      acc[key].extra = `· Net ${net}`;
                    }
                  }
                  return acc;
                }, {});
                return (
                  <div key={`${playerId}-block`}>
                    {Object.entries(groupedWins).map(([label, entry], idx) => {
                      const extra = entry.extra ? ` ${entry.extra}` : "";
                      return (
                        <Group key={`${playerId}-win-${idx}`} mb="xs">
                          <Badge color="club" variant="light">
                            Gana
                          </Badge>
                          <Text size="sm">
                            {label}
                            {extra}
                          </Text>
                          <Text size="sm" c="club.7">
                            +${entry.amount}
                          </Text>
                        </Group>
                      );
                    })}
                    {losses.map((payment, idx) => {
                      const rivalId = String(payment.to);
                      const rival = getPlayerName(rivalId);
                      const label = ITEM_LABELS[payment.item] || "";
                      return (
                        <Group key={`${playerId}-loss-${idx}`} mb="xs">
                          <Badge color="clay" variant="light">
                            Paga
                          </Badge>
                          <Text size="sm">
                            {label}
                            {payment.hole ? ` Hoyo ${payment.hole}` : ""}
                            {rival ? ` vs ${rival}` : ""}
                          </Text>
                          <Text size="sm" c="clay.7">
                            -${payment.amount}
                          </Text>
                        </Group>
                      );
                    })}
                  </div>
                );
              };

              const renderBlock = (title, blockPayments, blockPlayers, keyId) => (
                <Card key={keyId || title} withBorder mb="md">
                  <Text fw={700} mb="sm">
                    {title}
                  </Text>
                  <Accordion variant="separated">
                    {blockPlayers.map((playerId) => {
                      const wins = blockPayments.filter(
                        (payment) => String(payment.to) === playerId
                      );
                      const losses = blockPayments.filter(
                        (payment) => String(payment.from) === playerId
                      );
                      if (wins.length === 0 && losses.length === 0) {
                        return null;
                      }
                      const total =
                        wins.reduce((sum, payment) => sum + payment.amount, 0) -
                        losses.reduce((sum, payment) => sum + payment.amount, 0);
                      return (
                        <Accordion.Item key={`${title}-${playerId}`} value={`${title}-${playerId}`}>
                          <Accordion.Control>
                            <Group justify="space-between">
                              <Text fw={600}>{getPlayerName(playerId)}</Text>
                              <Text size="sm" c={total >= 0 ? "club.7" : "clay.7"}>
                                {total >= 0 ? "+" : "-"}${Math.abs(total)}
                              </Text>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            {renderPlayerBlock(blockPayments, playerId)}
                          </Accordion.Panel>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                </Card>
              );

              const groupPlayers = scorecards.map((card) =>
                String(card.player?._id)
              );

              return (
                <>
                  {renderBlock("Rayas grupales", groupPayments, groupPlayers)}
                  {round?.configSnapshot?.culebra?.enabled
                    ? renderBlock("Culebra", culebraPayments, groupPlayers)
                    : null}
                  {orderedIndividualKeys.map((key) => {
                    const blockPayments = groupedIndividual[key] || [];
                    const playersInBlock = Array.from(
                      new Set(
                        blockPayments.flatMap((payment) => [
                          String(payment.from),
                          String(payment.to),
                        ])
                      )
                    );
                    const title = key.startsWith("bet:")
                      ? betLabelById[key.replace("bet:", "")] ||
                        "Raya individual"
                      : "Raya individual";
                    return renderBlock(title, blockPayments, playersInBlock, key);
                  })}
                </>
              );
            })()
          )}
        </Card>

        {/* <Card mt="lg">
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
        </Card> */}
      </AppShell>
      <Modal
        opened={betsOpen}
        onClose={() => setBetsOpen(false)}
        title="Editar apuestas"
        size="lg"
        centered
      >
        <Text fw={600} mb="sm">
          Rayas grupales
        </Text>
        <Group grow>
          <NumberInput
            label="Hoyo ganado"
            value={betsDraft.holeWinner}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, holeWinner: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Medal"
            value={betsDraft.medal}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, medal: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Match"
            value={betsDraft.match}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, match: Number(value) || 0 }))
            }
          />
        </Group>
        <Group grow mt="sm">
          <NumberInput
            label="Birdie"
            value={betsDraft.birdie}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, birdie: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Aguila"
            value={betsDraft.eagle}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, eagle: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Albatross"
            value={betsDraft.albatross}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, albatross: Number(value) || 0 }))
            }
          />
        </Group>
        <Group grow mt="sm">
          <NumberInput
            label="Hole out"
            value={betsDraft.holeOut}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, holeOut: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Sandy"
            value={betsDraft.sandyPar}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, sandyPar: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Wet"
            value={betsDraft.wetPar}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, wetPar: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="Oh yes"
            value={betsDraft.ohYes}
            onChange={(value) =>
              setBetsDraft((prev) => ({ ...prev, ohYes: Number(value) || 0 }))
            }
          />
        </Group>

        <Text fw={600} mt="lg" mb="sm">
          Rayas individuales
        </Text>
        <Group justify="space-between" mb="sm">
          <Button variant="light" onClick={openNewBet}>
            Agregar raya individual
          </Button>
          <Text size="xs" c="dusk.6">
            {individualBetsDraft.length} configuradas
          </Text>
        </Group>
        {individualBetsDraft.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugadores</Table.Th>
                <Table.Th>V1</Table.Th>
                <Table.Th>V2</Table.Th>
                <Table.Th>R18</Table.Th>
                <Table.Th>Hoyo</Table.Th>
                <Table.Th>Birdie+</Table.Th>
                <Table.Th>Sandy</Table.Th>
                <Table.Th>Wet</Table.Th>
                <Table.Th>Oh yes</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {individualBetsDraft.map((bet) => {
                const playerA = playerOptions.find(
                  (option) => option.value === bet.playerA
                );
                const playerB = playerOptions.find(
                  (option) => option.value === bet.playerB
                );
                return (
                  <Table.Tr key={bet.id}>
                    <Table.Td>
                      {playerA?.name || "Jugador"} vs {playerB?.name || "Jugador"}
                    </Table.Td>
                    <Table.Td>{bet.amounts.front}</Table.Td>
                    <Table.Td>{bet.amounts.back}</Table.Td>
                    <Table.Td>{bet.amounts.round}</Table.Td>
                    <Table.Td>{bet.amounts.hole}</Table.Td>
                    <Table.Td>{bet.amounts.birdie}</Table.Td>
                    <Table.Td>{bet.amounts.sandy}</Table.Td>
                    <Table.Td>{bet.amounts.wet}</Table.Td>
                    <Table.Td>{bet.amounts.ohYes}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => editBet(bet)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="clay"
                          onClick={() => removeBet(bet.id)}
                        >
                          Quitar
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="xs" c="dusk.6">
            No hay rayas individuales configuradas.
          </Text>
        )}

        <Text fw={600} mt="lg" mb="sm">
          Culebra
        </Text>
        <Group align="center" mb="sm">
          <Button
            variant={culebraDraft.enabled ? "filled" : "light"}
            color={culebraDraft.enabled ? "club" : "dusk"}
            onClick={() =>
              setCulebraDraft((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            disabled={roundPlayers.length === 0}
          >
            {culebraDraft.enabled ? "Activada" : "Activar culebra"}
          </Button>
          <NumberInput
            label="Monto"
            value={culebraDraft.amount}
            onChange={(value) =>
              setCulebraDraft((prev) => ({
                ...prev,
                amount: Number(value) || 0,
              }))
            }
          />
          <Button
            variant="light"
            size="xs"
            onClick={() =>
              setCulebraDraft((prev) => ({
                ...prev,
                players:
                  prev.players.length === roundPlayers.length
                    ? []
                    : roundPlayers.map((player) => String(player._id)),
              }))
            }
            disabled={!culebraDraft.enabled}
          >
            {culebraDraft.players.length === roundPlayers.length
              ? "Limpiar todos"
              : "Seleccionar todos"}
          </Button>
        </Group>
        {culebraDraft.enabled ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playerOptions.map((player) => {
                const selected = culebraDraft.players.includes(player.value);
                return (
                  <Table.Tr key={`culebra-${player.value}`}>
                    <Table.Td>{player.name}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant={selected ? "filled" : "light"}
                        color={selected ? "club" : "dusk"}
                        onClick={() =>
                          setCulebraDraft((prev) => ({
                            ...prev,
                            players: prev.players.includes(player.value)
                              ? prev.players.filter((id) => id !== player.value)
                              : [...prev.players, player.value],
                          }))
                        }
                      >
                        {selected ? "Quitar" : "Agregar"}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="xs" c="dusk.6">
            Activa la culebra para seleccionar participantes.
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => setBetsOpen(false)}>
            Cancelar
          </Button>
          <Button color="club" onClick={saveBetsConfig}>
            Guardar
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={betEditOpen}
        onClose={() => setBetEditOpen(false)}
        title="Raya individual"
        centered
      >
        <Select
          label="Jugador A"
          data={playerOptions}
          value={betDraft?.playerA || ""}
          onChange={(value) =>
            setBetDraft((prev) => ({ ...prev, playerA: value || "" }))
          }
        />
        <Select
          label="Jugador B"
          data={playerOptions}
          value={betDraft?.playerB || ""}
          onChange={(value) =>
            setBetDraft((prev) => ({ ...prev, playerB: value || "" }))
          }
        />
        <Group grow mt="md">
          <NumberInput
            label="Vuelta 1"
            value={betDraft?.amounts?.front ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, front: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Vuelta 2"
            value={betDraft?.amounts?.back ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, back: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Ronda 18"
            value={betDraft?.amounts?.round ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, round: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Hoyo ganado"
            value={betDraft?.amounts?.hole ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, hole: Number(value) || 0 },
              }))
            }
          />
        </Group>
        <Group grow mt="md">
          <NumberInput
            label="Birdie+"
            value={betDraft?.amounts?.birdie ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, birdie: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Sandy"
            value={betDraft?.amounts?.sandy ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, sandy: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Wet"
            value={betDraft?.amounts?.wet ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, wet: Number(value) || 0 },
              }))
            }
          />
          <NumberInput
            label="Oh yes"
            value={betDraft?.amounts?.ohYes ?? 0}
            onChange={(value) =>
              setBetDraft((prev) => ({
                ...prev,
                amounts: { ...prev.amounts, ohYes: Number(value) || 0 },
              }))
            }
          />
        </Group>
        <Switch
          mt="xs"
          label="Acumular en empate / sin ganador (solo por hoyo)"
          checked={Boolean(betDraft?.accumulateOnTie)}
          onChange={(event) =>
            setBetDraft((prev) => ({
              ...prev,
              accumulateOnTie: event.currentTarget.checked,
            }))
          }
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => setBetEditOpen(false)}>
            Cancelar
          </Button>
          <Button color="club" onClick={saveBet}>
            Guardar
          </Button>
        </Group>
      </Modal>
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
