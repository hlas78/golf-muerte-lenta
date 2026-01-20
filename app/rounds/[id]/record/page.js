"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../../components/AppShell";
import { getSocket } from "@/lib/socketClient";

const PENALTIES = [
  { value: "pinkies", label: "Pinkies" },
  { value: "cuatriputt", label: "Cuatriputt" },
  { value: "saltapatras", label: "Saltapatras" },
  { value: "paloma", label: "Paloma" },
  { value: "nerdina", label: "Nerdina" },
];

export default function RecordScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [round, setRound] = useState(null);
  const [me, setMe] = useState(null);
  const [role, setRole] = useState("");
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [holes, setHoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [locked, setLocked] = useState(false);
  const [roundClosed, setRoundClosed] = useState(false);
  const [holeMeta, setHoleMeta] = useState({});
  const saveTimeout = useRef(null);
  const initialized = useRef(false);
  const loadedExisting = useRef(false);

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
    if (!params?.id || loadedExisting.current === true) {
      return;
    }
    const paramPlayerId = searchParams.get("playerId");
    if (
      paramPlayerId &&
      me?._id &&
      role !== "admin" &&
      String(round?.supervisor) !== String(me._id)
    ) {
      router.replace(`/rounds/${params.id}`);
      return;
    }
    const targetId = paramPlayerId || me?._id;
    if (!targetId) {
      return;
    }
    setActivePlayerId(targetId);
    fetch(`/api/rounds/${params.id}/scorecards`)
      .then((res) => res.json())
      .then((data) => {
        const existing = Array.isArray(data.scorecards)
          ? data.scorecards.find(
              (card) => String(card.player?._id) === String(targetId)
            )
          : null;
        if (existing?.holes?.length) {
          setLocked(Boolean(existing.accepted));
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
      })
      .catch(() => {
        loadedExisting.current = true;
      });
  }, [me, params, role, round, router, searchParams]);

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
    return `${round.courseSnapshot.clubName} · ${round.courseSnapshot.courseName}`;
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
        return {
          ...hole,
          ...patch,
          strokes: nextStrokes,
          putts: nextPutts,
          holeOut,
        };
      })
    );
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

  const applyPuttPreset = (index) => {
    updateHole(index, { putts: 3 });
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

  return (
    <main>
      <AppShell
        title={
          activePlayerId && String(activePlayerId) !== String(me?._id)
            ? `Tarjeta de ${activePlayerName || "jugador"}`
            : "Registro de tarjeta"
        }
        subtitle={round ? "Captura tus golpes por hoyo." : "Cargando..."}
      >
        <Card mb="lg">
          <Group justify="space-between">
            <Text fw={700}>{title}</Text>
            <Badge color="club">{round?.holes || "--"} hoyos</Badge>
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
        </Card>

        {holes.map((hole, index) => (
          <Card key={hole.hole} mb="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={700}>Hoyo {hole.hole}</Text>
              <Badge color="dusk" variant="light">
                Captura
              </Badge>
            </Group>
            <Text size="sm" c="dusk.6" mb="sm">
              Par {holeMeta[hole.hole]?.par ?? "--"} ·{" "}
              {holeMeta[hole.hole]?.yardage ?? "--"} yds · HC{" "}
              {holeMeta[hole.hole]?.handicap ?? "--"}
            </Text>
            <Group gap="xs" mb="sm">
              <Button
                size="xs"
                variant="light"
                onClick={() => applyStrokePreset(index, "birdie")}
                disabled={locked || roundClosed}
              >
                Birdie
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => applyStrokePreset(index, "par")}
                disabled={locked || roundClosed}
              >
                Par
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => applyStrokePreset(index, "bogey")}
                disabled={locked || roundClosed}
              >
                Bogey
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => applyStrokePreset(index, "zopi")}
                disabled={locked || roundClosed}
              >
                Zopi
              </Button>
            </Group>
            <Group gap="xs" mb="sm">
              <Button
                size="xs"
                variant="light"
                onClick={() => applyPuttPreset(index)}
                disabled={locked || roundClosed}
              >
                3 putt
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
            <Group grow align="flex-start">
              <NumberInput
                label="Golpes"
                placeholder="0"
                value={hole.strokes}
                min={0}
                onChange={(value) => updateHole(index, { strokes: value })}
                disabled={locked || roundClosed}
              />
              <NumberInput
                label="Putts"
                placeholder="0"
                value={hole.putts}
                min={0}
                onChange={(value) => updateHole(index, { putts: value })}
                disabled={locked || roundClosed}
              />
              <MultiSelect
                label="Castigos"
                data={PENALTIES}
                value={hole.penalties}
                onChange={(value) => updateHole(index, { penalties: value })}
                placeholder="Selecciona"
                clearable
                disabled={locked || roundClosed}
              />
            </Group>
          </Card>
        ))}

        <Group justify="flex-end" mt="lg">
          <Button
            color="club"
            onClick={handleSave}
            loading={saving}
            disabled={locked || roundClosed}
          >
            Guardar tarjeta
          </Button>
        </Group>
      </AppShell>
    </main>
  );
}
