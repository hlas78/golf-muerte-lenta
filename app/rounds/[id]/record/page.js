"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Select,
  Loader,
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

export default function RecordScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [round, setRound] = useState(null);
  const [me, setMe] = useState(null);
  const [role, setRole] = useState("");
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [holes, setHoles] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [roundClosed, setRoundClosed] = useState(false);
  const [holeMeta, setHoleMeta] = useState({});
  const [teeOptions, setTeeOptions] = useState([]);
  const [selectedTee, setSelectedTee] = useState(null);
  const [updatingTee, setUpdatingTee] = useState(false);
  const [grintModalOpen, setGrintModalOpen] = useState(false);
  const [grintScores, setGrintScores] = useState([]);
  const [grintLoading, setGrintLoading] = useState(false);
  const [grintImporting, setGrintImporting] = useState(false);
  const saveTimeout = useRef(null);
  const initialized = useRef(false);
  const loadedExisting = useRef(false);
  const didScrollToMissing = useRef(false);
  const [authenticating, setAuthenticating] = useState(false);
  const didMagic = useRef(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setMe(data.user || null);
        setRole(data.user?.role || "");
      })
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token || didMagic.current || me?._id) {
      return;
    }
    didMagic.current = true;
    setAuthenticating(true);
    fetch("/api/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "active") {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.delete("token");
          const nextQuery = nextParams.toString();
          const nextUrl = nextQuery
            ? `/rounds/${params.id}/record?${nextQuery}`
            : `/rounds/${params.id}/record`;
          window.location.href = nextUrl;
        } else if (data.status === "pending") {
          notifications.show({
            title: "Aun pendiente",
            message: "Tu acceso todavia no ha sido aprobado.",
            color: "dusk",
          });
        }
      })
      .catch(() => {
        notifications.show({
          title: "No se pudo autenticar",
          message: "Revisa tu liga e intenta de nuevo.",
          color: "clay",
        });
      })
      .finally(() => setAuthenticating(false));
  }, [me, params, searchParams]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setRound(data);
        setRoundClosed(data?.status === "closed");
        const count = data?.holes || 18;
        setHoles(
          Array.from({ length: count }, (_, idx) => ({
            hole: idx + 1,
            strokes: "",
            putts: "",
            ohYes: false,
            sandy: false,
            penalties: [],
            bunker: false,
            water: false,
            holeOut: false,
          }))
        );
        const tees = data?.courseSnapshot?.tees || {};
        const allTees = [...(tees.male || []), ...(tees.female || [])];
        const meta = allTees[0]?.holes || [];
        const metaMap = meta.reduce((acc, hole, idx) => {
          acc[idx + 1] = hole;
          return acc;
        }, {});
        setHoleMeta(metaMap);
        const options = allTees.map((tee) => ({
          value: tee.tee_name,
          label: tee.tee_name,
        }));
        setTeeOptions(options);
        initialized.current = true;
      })
      .catch(() => {
        notifications.show({
          title: "No se pudo cargar la jugada",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      });
  }, [params]);

  useEffect(() => {
    if (
      !params?.id ||
      !round?._id ||
      holes.length === 0 ||
      loadedExisting.current === true
    ) {
      return;
    }
    const paramPlayerId = searchParams.get("playerId");
    if (
      paramPlayerId &&
      me?._id &&
      !["admin", "supervisor"].includes(role)
    ) {
      router.replace(`/rounds/${params.id}`);
      return;
    }
    const targetId = paramPlayerId || me?._id;
    if (!targetId) {
      return;
    }
    setActivePlayerId(targetId);
    const teeName =
      round.playerTees?.find(
        (entry) => String(entry.player) === String(targetId)
      )?.teeName || null;
    setSelectedTee(teeName);
    setLoadingExisting(true);
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) => {
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : []);
        const existing = Array.isArray(data.scorecards)
          ? data.scorecards.find(
              (card) => String(card.player?._id) === String(targetId)
            )
          : null;
        if (existing?.holes?.length) {
          const isAdmin = role === "admin";
          if (existing.accepted && isAdmin && !roundClosed) {
            fetch(
              `/api/rounds/${params.id}/scorecards/${existing._id}/reopen`,
              { method: "POST" }
            )
              .then(() => setLocked(false))
              .catch(() => setLocked(false));
          } else {
            setLocked(Boolean(existing.accepted));
          }
          if (existing.teeName && round?.courseSnapshot?.tees) {
            const tees = round.courseSnapshot.tees || {};
            const allTees = [...(tees.male || []), ...(tees.female || [])];
            const selected = allTees.find(
              (tee) => tee.tee_name === existing.teeName
            );
            const meta = selected?.holes || allTees[0]?.holes || [];
            const metaMap = meta.reduce((acc, hole, idx) => {
              acc[idx + 1] = hole;
              return acc;
            }, {});
            setHoleMeta(metaMap);
          }
          setHoles((prev) =>
            prev.map((hole) => {
              const match = existing.holes.find(
                (entry) => entry.hole === hole.hole
              );
              if (!match) {
                return hole;
              }
              return {
                ...hole,
                strokes: match.strokes ?? "",
                putts: match.putts ?? "",
                ohYes: Boolean(match.ohYes),
                sandy: Boolean(match.sandy),
                penalties: match.penalties || [],
                bunker: Boolean(match.bunker),
                water: Boolean(match.water),
                holeOut: Boolean(match.holeOut),
              };
            })
          );
        }
        loadedExisting.current = true;
        setLoadingExisting(false);
      })
      .catch(() => {
        loadedExisting.current = true;
        setLoadingExisting(false);
      });
  }, [holes.length, me, params, role, round, router, searchParams]);

  useEffect(() => {
    if (loadingExisting || didScrollToMissing.current || holes.length === 0) {
      return;
    }
    const hasCaptured = holes.some(
      (hole) => hole.strokes != null && hole.strokes !== ""
    );
    const missingIndex = holes.findIndex(
      (hole) => hole.strokes == null || hole.strokes === ""
    );
    if (!hasCaptured || missingIndex === -1) {
      return;
    }
    didScrollToMissing.current = true;
    const targetId = `hole-card-${holes[missingIndex].hole}`;
    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  }, [loadingExisting, holes]);

  useEffect(() => {
    if (!round?.courseSnapshot?.tees || !me?._id) {
      return;
    }
    const tees = round.courseSnapshot.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
    const selectedName = round.playerTees?.find(
      (entry) => String(entry.player) === String(me._id)
    )?.teeName;
    const selected = allTees.find((tee) => tee.tee_name === selectedName);
    if (!selected) {
      return;
    }
    const metaMap = (selected.holes || []).reduce((acc, hole, idx) => {
      acc[idx + 1] = hole;
      return acc;
    }, {});
    setHoleMeta(metaMap);
  }, [round, me]);

  const title = useMemo(() => {
    if (!round?.courseSnapshot) return "Registro de tarjeta";
    return `${round.courseSnapshot.clubName}`;
  }, [round]);

  const activePlayerName = useMemo(() => {
    if (!round?.players || !activePlayerId) {
      return "";
    }
    return (
      round.players.find(
        (player) => String(player._id) === String(activePlayerId)
      )?.name || ""
    );
  }, [round, activePlayerId]);

  const activePlayer = useMemo(() => {
    if (!round?.players || !activePlayerId) {
      return null;
    }
    return (
      round.players.find(
        (player) => String(player._id) === String(activePlayerId)
      ) || null
    );
  }, [round, activePlayerId]);

  const allTees = useMemo(() => {
    const tees = round?.courseSnapshot?.tees;
    return tees ? [...(tees.male || []), ...(tees.female || [])] : [];
  }, [round]);

  const playerCourseHandicaps = useMemo(() => {
    if (!round?.players?.length || !allTees.length) {
      return {};
    }
    return round.players.reduce((acc, player) => {
      const teeName =
        round.playerTees?.find(
          (entry) => String(entry.player) === String(player._id)
        )?.teeName || round.teeName;
      const tee =
        allTees.find((option) => option.tee_name === teeName) || allTees[0];
      acc[String(player._id)] = getCourseHandicapForRound(
        tee,
        round,
        player.handicap
      );
      return acc;
    }, {});
  }, [round, allTees]);

  const minCourseHandicap = useMemo(() => {
    const values = Object.values(playerCourseHandicaps).filter((value) =>
      Number.isFinite(value)
    );
    if (!values.length) {
      return 0;
    }
    return values.reduce((min, value) => (value < min ? value : min), values[0]);
  }, [playerCourseHandicaps]);

  const strokesMapByPlayer = useMemo(() => {
    if (!round?.players?.length || !allTees.length) {
      return {};
    }
    return round.players.reduce((acc, player) => {
      const teeName =
        round.playerTees?.find(
          (entry) => String(entry.player) === String(player._id)
        )?.teeName || round.teeName;
      const tee =
        allTees.find((option) => option.tee_name === teeName) || allTees[0];
      const normalized = normalizeHoleHandicaps(tee?.holes || [], round);
      const holeHandicaps = normalized.map((hole, idx) => ({
        hole: hole.hole ?? idx + 1,
        handicap: hole.handicap,
      }));
      const courseHandicap =
        playerCourseHandicaps[String(player._id)] ?? player.handicap ?? 0;
      const relativeHandicap = Math.max(
        0,
        courseHandicap -
          (Number.isFinite(minCourseHandicap) ? minCourseHandicap : 0)
      );
      acc[String(player._id)] = allocateStrokes(
        relativeHandicap,
        holeHandicaps,
        round.holes
      );
      return acc;
    }, {});
  }, [round, allTees, playerCourseHandicaps, minCourseHandicap]);

  const fallbackStrokesMap = useMemo(() => {
    const activeId = String(activePlayerId || "");
    if (!activeId || !round?.holes) {
      return {};
    }
    if (strokesMapByPlayer[activeId]) {
      return strokesMapByPlayer[activeId];
    }
    const handicaps = Object.values(holeMeta || {})
      .map((hole, idx) => ({
        hole: hole.hole ?? idx + 1,
        handicap: hole.handicap,
      }))
      .filter((hole) => Number.isFinite(hole.handicap));
    if (!handicaps.length) {
      return {};
    }
    const courseHandicap =
      playerCourseHandicaps[activeId] ?? activePlayer?.handicap ?? 0;
    const relativeHandicap = Math.max(
      0,
      courseHandicap - (Number.isFinite(minCourseHandicap) ? minCourseHandicap : 0)
    );
    return allocateStrokes(relativeHandicap, handicaps, round.holes);
  }, [
    activePlayerId,
    round,
    strokesMapByPlayer,
    holeMeta,
    playerCourseHandicaps,
    activePlayer,
    minCourseHandicap,
  ]);

  const liveScorecards = useMemo(() => {
    if (!round?.players?.length) {
      return [];
    }
    const base = Array.isArray(scorecards) ? scorecards : [];
    const withActive = base.map((card) => {
      if (String(card.player?._id) === String(activePlayerId)) {
        return { ...card, holes };
      }
      return card;
    });
    if (
      activePlayerId &&
      !withActive.some(
        (card) => String(card.player?._id) === String(activePlayerId)
      )
    ) {
      const player = round.players.find(
        (entry) => String(entry._id) === String(activePlayerId)
      );
      if (player) {
        withActive.push({
          player,
          holes,
        });
      }
    }
    return withActive;
  }, [scorecards, activePlayerId, holes, round]);

  const holeWinners = useMemo(() => {
    if (!round?.holes || !liveScorecards.length) {
      return {};
    }
    const winners = {};
    for (let i = 1; i <= round.holes; i += 1) {
      const netScores = liveScorecards
        .map((card) => {
          const strokes = card.holes?.find((entry) => entry.hole === i)?.strokes;
          if (strokes == null || strokes === "") {
            return null;
          }
          const playerId = String(card.player?._id || "");
          const strokesMap = strokesMapByPlayer[playerId] || {};
          const net = Number(strokes) - (strokesMap[i] || 0);
          return { playerId, net };
        })
        .filter(Boolean);
      if (!netScores.length) {
        continue;
      }
      const min = Math.min(...netScores.map((entry) => entry.net));
      const tied = netScores.filter((entry) => entry.net === min);
      if (tied.length === 1) {
        winners[i] = tied[0].playerId;
      }
    }
    return winners;
  }, [liveScorecards, strokesMapByPlayer, round]);

  const updateHole = (index, patch) => {
    if (locked) {
      return;
    }
    setHoles((prev) =>
      prev.map((hole, idx) => {
        if (idx !== index) {
          return hole;
        }
        const hasStrokes = Object.prototype.hasOwnProperty.call(patch, "strokes");
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
      })
    );
  };

  const canEditTee =
    !roundClosed &&
    !locked &&
    activePlayerId &&
    (String(activePlayerId) === String(me?._id) ||
      role === "admin" ||
      role === "supervisor");

  const handleUpdateTee = async (value) => {
    if (!value || !activePlayerId || !params?.id) {
      return;
    }
    setUpdatingTee(true);
    try {
      const res = await fetch(
        `/api/rounds/${params.id}/players/${activePlayerId}/tee`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teeName: value }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el tee.");
      }
      setSelectedTee(value);
      const nextRound = await fetch(`/api/rounds/${params.id}`).then((r) =>
        r.json()
      );
      setRound(nextRound);
      notifications.show({
        title: "Tee actualizado",
        message: "Se actualizo el tee de salida.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo actualizar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setUpdatingTee(false);
    }
  };

  const applyStrokePreset = (index, preset) => {
    const par = holeMeta[holes[index]?.hole]?.par;
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
    updateHole(index, { strokes: value });
  };

  const applyPuttPreset = (index, value) => {
    updateHole(index, { putts: value });
  };

  const updateNumber = (index, key, delta) => {
    const current = Number(holes[index]?.[key] ?? 0);
    const next = Math.max(0, current + delta);
    updateHole(index, { [key]: next });
  };

  const loadScorecards = () => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) =>
        setScorecards(Array.isArray(data.scorecards) ? data.scorecards : [])
      )
      .catch(() => setScorecards([]));
  };

  const handleSave = async () => {
    if (!me?._id || !activePlayerId) {
      notifications.show({
        title: "Sin usuario",
        message: "Inicia sesion para guardar.",
        color: "clay",
      });
      return;
    }
    if (locked || roundClosed) {
      notifications.show({
        title: "Tarjeta bloqueada",
        message: roundClosed
          ? "La jugada ya fue cerrada."
          : "El supervisor ya la acepto.",
        color: "dusk",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rounds/${params.id}/scorecards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: activePlayerId,
          holes: holes.map((hole) => ({
            ...hole,
            strokes:
              hole.strokes === "" || hole.strokes == null
                ? null
                : Number(hole.strokes),
            putts:
              hole.putts === "" || hole.putts == null ? null : Number(hole.putts),
            par: holeMeta[hole.hole]?.par,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo guardar.");
      }
      const socket = getSocket();
      socket.emit("scorecard:update", {
        roundId: params.id,
        payload: { playerId: activePlayerId },
      });
      notifications.show({
        title: "Tarjeta guardada",
        message: "Se envio tu registro.",
        color: "club",
      });
      router.push(`/rounds/${params.id}/scorecard`);
    } catch (error) {
      notifications.show({
        title: "Error al guardar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveScorecard = async () => {
    if (!me?._id || !round?._id || !activePlayerId || locked || roundClosed) {
      return;
    }
    setAutoSaving(true);
    try {
      await fetch(`/api/rounds/${params.id}/scorecards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: activePlayerId,
          holes: holes.map((hole) => ({
            ...hole,
            strokes:
              hole.strokes === "" || hole.strokes == null
                ? null
                : Number(hole.strokes),
            putts:
              hole.putts === "" || hole.putts == null ? null : Number(hole.putts),
            par: holeMeta[hole.hole]?.par,
          })),
        }),
      });
      const socket = getSocket();
      socket.emit("scorecard:update", {
        roundId: params.id,
        payload: { playerId: activePlayerId },
      });
      setLastSavedAt(new Date());
    } catch (error) {
      notifications.show({
        title: "Error en guardado automatico",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setAutoSaving(false);
    }
  };

  const loadGrintScores = async () => {
    if (!activePlayer?.grintId) {
      notifications.show({
        title: "Grint ID requerido",
        message: "Captura tu Grint ID para poder cargar desde Grint.",
        color: "clay",
      });
      setGrintScores([]);
      return;
    }
    setGrintLoading(true);
    try {
      const res = await fetch(
        `/api/grint/dashboard?grintId=${encodeURIComponent(
          activePlayer.grintId
        )}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo leer las jugadas.");
      }
      setGrintScores(Array.isArray(data.scores) ? data.scores : []);
    } catch (error) {
      notifications.show({
        title: "No se pudo cargar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setGrintLoading(false);
    }
  };

  const openGrintModal = () => {
    setGrintModalOpen(true);
    loadGrintScores();
  };

  const applyGrintScorecard = async (scoreId) => {
    if (!scoreId) {
      return;
    }
    setGrintImporting(true);
    try {
      const res = await fetch(
        `/api/grint/scorecard?scoreId=${encodeURIComponent(scoreId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar la tarjeta.");
      }
      const imported = Array.isArray(data.holes) ? data.holes : [];
      setHoles((prev) =>
        prev.map((hole) => {
          const match = imported.find((entry) => entry.hole === hole.hole);
          if (!match) {
            return hole;
          }
          return {
            ...hole,
            strokes: match.strokes ?? "",
            putts: match.putts ?? "",
          };
        })
      );
      notifications.show({
        title: "Tarjeta cargada",
        message: "Datos importados desde TheGrint.",
        color: "club",
      });
      setGrintModalOpen(false);
    } catch (error) {
      notifications.show({
        title: "No se pudo importar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setGrintImporting(false);
    }
  };

  useEffect(() => {
    if (!initialized.current || !me?._id || !round?._id) {
      return;
    }
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => {
      saveScorecard();
    }, 800);
    return () => clearTimeout(saveTimeout.current);
  }, [holes, me, round]);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    const socket = getSocket();
    socket.emit("round:join", params.id);
    socket.on("scorecard:update", loadScorecards);
    loadScorecards();
    return () => {
      socket.off("scorecard:update", loadScorecards);
    };
  }, [params?.id]);

  return (
    <main className="gml-scorecard-compact">
      <AppShell
        title={
          activePlayerId && String(activePlayerId) !== String(me?._id)
            ? `Tarjeta de ${activePlayerName || "jugador"}`
            : "Registro de tarjeta"
        }
        // subtitle={round ? "Captura tus golpes por hoyo." : "Cargando..."}
      >
        <Modal
          opened={grintModalOpen}
          onClose={() => setGrintModalOpen(false)}
          title="Jugadas en TheGrint"
        >
          {grintLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : grintScores.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No se encontraron jugadas recientes para este jugador.
            </Text>
          ) : (
            <Stack>
              {grintScores.map((score) => (
                <Card key={score.scoreId} withBorder>
                  <Text fw={600}>{score.course || "Jugada"}</Text>
                  {score.date ? (
                    <Text size="xs" c="dusk.6">
                      {score.date}
                    </Text>
                  ) : null}
                  {score.teeInfo ? (
                    <Text size="xs" c="dusk.6">
                      {score.teeInfo}
                    </Text>
                  ) : null}
                  <Group justify="space-between" mt="sm">
                    <Badge color="club" variant="light">
                      {score.score ? `Score ${score.score}` : "Score"}
                    </Badge>
                    <Badge color="dusk" variant="light">
                      {score.holes ? `${score.holes} hoyos` : "Hoyos"}
                    </Badge>
                    <Button
                      size="xs"
                      loading={grintImporting}
                      onClick={() => applyGrintScorecard(score.scoreId)}
                    >
                      Cargar
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Modal>
        <Card mb="sm" p="sm">
          <Group justify="space-between">
            <Text fw={700}>{title}</Text>
            {/* <Badge color="club">{round?.holes || "--"} hoyos</Badge> */}
          </Group>
          <Text size="sm" c="dusk.6">
            {activePlayerId && String(activePlayerId) !== String(me?._id)
              ? `Estas editando la tarjeta de ${activePlayerName || "otro jugador"}.`
              : "Guarda tu propia tarjeta. El supervisor valida al final."}
          </Text>
          <Text size="xs" c="dusk.6" mt="xs">
            {autoSaving
              ? "Guardando..."
              : lastSavedAt
              ? `Guardado automatico ${lastSavedAt.toLocaleTimeString()}`
              : "Guardado automatico activo"}
          </Text>
          {loadingExisting ? (
            <Text size="xs" c="dusk.6" mt="xs">
              Cargando datos guardados...
            </Text>
          ) : null}
          {authenticating ? (
            <Text size="xs" c="dusk.6" mt="xs">
              Verificando acceso...
            </Text>
          ) : null}
          {locked ? (
            <Text size="xs" c="dusk.6" mt="xs">
              Tarjeta aceptada por supervisor. Edicion bloqueada.
            </Text>
          ) : null}
          {roundClosed ? (
            <Text size="xs" c="dusk.6" mt="xs">
              Jugada cerrada. Edicion bloqueada.
            </Text>
          ) : null}
          <Text size="sm" c="dusk.6" mt="sm" mb="xs">
            Tee de salida
          </Text>
          <Select
            placeholder="Selecciona tee"
            data={teeOptions}
            value={selectedTee}
            onChange={(value) => {
              if (value) {
                setSelectedTee(value);
                handleUpdateTee(value);
              }
            }}
            disabled={!canEditTee || updatingTee}
          />
          <Group justify="flex-end" mt="xs">
            {!locked && !roundClosed ? (
              <Button variant="light" onClick={openGrintModal}>
                Cargar desde Grint
              </Button>
            ) : null}
            <Button
              variant="light"
              component="a"
              href={`/rounds/${params.id}/scorecard`}
            >
              Ver tarjeta
            </Button>
          </Group>
        </Card>

        {holes.map((hole, index) => {
          const hasStrokes = hole.strokes != null && hole.strokes !== "";
          const activeId = String(activePlayerId || "");
          const advantageCount =
            strokesMapByPlayer[activeId]?.[hole.hole] ??
            fallbackStrokesMap[hole.hole] ??
            0;
          const isWinner =
            hasStrokes && holeWinners[hole.hole] === activeId;
          return (
          <Card key={hole.hole} mb="xs" p="sm" id={`hole-card-${hole.hole}`}>
            <Group justify="space-between" mb="xs">
              <div
                className={
                  advantageCount > 0 ? "gml-advantage-cell" : undefined
                }
              >
                <Text fw={700} className={isWinner ? "gml-win-cell" : undefined}>
                  Hoyo {hole.hole}
                </Text>
                {advantageCount > 0 ? (
                  <span className="gml-advantage">
                    {"•".repeat(advantageCount)}
                  </span>
                ) : null}
              </div>
              {/* <Badge color="dusk" variant="light">
                Captura
              </Badge> */}
              <Text size="sm" c="dusk.6" mb="sm">
                Par {holeMeta[hole.hole]?.par ?? "--"} ·{" "}
                {holeMeta[hole.hole]?.yardage ?? "--"} yds · Ventaja {" "}
                {holeMeta[hole.hole]?.handicap ?? "--"}
              </Text>
            </Group>
            <Group gap="xs" mb="xs">
              {(() => {
                const parValue = holeMeta[hole.hole]?.par;
                const strokesValue =
                  hole.strokes === "" || hole.strokes == null
                    ? null
                    : Number(hole.strokes);
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
                onClick={() => applyStrokePreset(index, "birdie")}
                disabled={locked || roundClosed}
              >
                Birdie
              </Button>
              <Button
                size="xs"
                variant={isPar ? "filled" : "light"}
                onClick={() => applyStrokePreset(index, "par")}
                disabled={locked || roundClosed}
              >
                Par
              </Button>
              <Button
                size="xs"
                variant={isBogey ? "filled" : "light"}
                onClick={() => applyStrokePreset(index, "bogey")}
                disabled={locked || roundClosed}
              >
                Bogey
              </Button>
              <Button
                size="xs"
                variant={isZopi ? "filled" : "light"}
                onClick={() => applyStrokePreset(index, "zopi")}
                disabled={locked || roundClosed}
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
                  hole.putts === "" || hole.putts == null
                    ? null
                    : Number(hole.putts);
                return (
                  <>
              <Button
                size="xs"
                variant={puttsValue === 0 ? "filled" : "light"}
                onClick={() => applyPuttPreset(index, 0)}
                disabled={locked || roundClosed}
              >
                Hole out
              </Button>
              <Button
                size="xs"
                variant={puttsValue === 1 ? "filled" : "light"}
                onClick={() => applyPuttPreset(index, 1)}
                disabled={locked || roundClosed}
              >
                1 putt
              </Button>
              <Button
                size="xs"
                variant={puttsValue === 2 ? "filled" : "light"}
                onClick={() => applyPuttPreset(index, 2)}
                disabled={locked || roundClosed}
              >
                2 putt
              </Button>
              <Button
                size="xs"
                variant={puttsValue === 3 ? "filled" : "light"}
                onClick={() => applyPuttPreset(index, 3)}
                disabled={locked || roundClosed}
              >
                3 putt
              </Button>
                  </>
                );
              })()}
              <Button
                size="xs"
                variant={hole.water ? "filled" : "light"}
                color="blue"
                onClick={() => updateHole(index, { water: !hole.water })}
                disabled={locked || roundClosed}
              >
                Wet
              </Button>
              {holeMeta[hole.hole]?.par === 3 ? (
                <Button
                  size="xs"
                  variant={hole.ohYes ? "filled" : "light"}
                  color="clay"
                  onClick={() => updateHole(index, { ohYes: !hole.ohYes })}
                  disabled={locked || roundClosed}
                >
                  Oh yes
                </Button>
              ) : null}
              <Button
                size="xs"
                variant={hole.sandy ? "filled" : "light"}
                color="yellow"
                onClick={() => updateHole(index, { sandy: !hole.sandy })}
                disabled={locked || roundClosed}
              >
                Sandy
              </Button>
            </Group>
            <Group grow align="flex-start" gap="xs">
              <div className="gml-stepper">
                <Text size="sm" fw={600}>
                  Golpes
                </Text>
                <div className="gml-stepper-controls">
                  <Button
                    variant="light"
                    onClick={() => updateNumber(index, "strokes", -1)}
                    disabled={locked || roundClosed}
                    className="gml-score-btn"
                  >
                    -
                  </Button>
                  <Text fw={700} className="gml-stepper-value">
                    {hole.strokes === "" || hole.strokes == null
                      ? "-"
                      : hole.strokes}
                  </Text>
                  <Button
                    variant="light"
                    onClick={() => updateNumber(index, "strokes", 1)}
                    disabled={locked || roundClosed}
                    className="gml-score-btn"
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
                    onClick={() => updateNumber(index, "putts", -1)}
                    disabled={locked || roundClosed}
                    className="gml-score-btn"
                  >
                    -
                  </Button>
                  <Text fw={700} className="gml-stepper-value">
                    {hole.putts === "" || hole.putts == null ? "-" : hole.putts}
                  </Text>
                  <Button
                    variant="light"
                    onClick={() => updateNumber(index, "putts", 1)}
                    disabled={locked || roundClosed}
                    className="gml-score-btn"
                  >
                    +
                  </Button>
                </div>
              </div>
            </Group>
            <div style={{ marginTop: "0.75rem" }}>
              <Text size="sm" fw={600} mb={6}>
                Castigos
              </Text>
              <Group gap="xs">
                {PENALTIES.map((penalty) => {
                  const active = hole.penalties?.includes(penalty.value);
                  return (
                    <Button
                      key={penalty.value}
                      size="xs"
                      variant={active ? "filled" : "light"}
                      color={active ? "clay" : "dusk"}
                      onClick={() =>
                        updateHole(index, {
                          penalties: togglePenaltyValue(
                            hole.penalties,
                            penalty.value
                          ),
                        })
                      }
                      disabled={locked || roundClosed}
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
        })}

        <Group justify="flex-end" mt="lg">
          <Button
            color="club"
            component="a"
            href={`/rounds/${params.id}/scorecard`}
          >
            Ver tarjeta
          </Button>
        </Group>
      </AppShell>
    </main>
  );
}
