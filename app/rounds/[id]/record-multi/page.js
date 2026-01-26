"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../../components/AppShell";
import { getSocket } from "@/lib/socketClient";

const PENALTIES = [
  { value: "pinkies", label: "Pinkies" },
  { value: "saltapatras", label: "Saltapatras" },
  { value: "paloma", label: "Paloma" },
  { value: "whiskeys", label: "Whiskeys" },
];

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

export default function RecordMultiPage() {
  const params = useParams();
  const router = useRouter();
  const [round, setRound] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedHole, setSelectedHole] = useState("1");
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimeout = useRef(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role !== "admin" && data.user?.role !== "supervisor") {
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

  useEffect(() => {
    if (!round?._id) {
      return;
    }
    loadScorecards();
  }, [round]);

  const isClosed = round?.status === "closed";
  const holeNumber = Number(selectedHole || 1);
  const players = useMemo(() => round?.players || [], [round]);
  const playerOptions = useMemo(
    () =>
      players.map((player) => ({
        value: player._id,
        label: `${player.name} · HC ${player.handicap ?? 0}`,
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

  const getHoleMetaForPlayer = (playerId) => {
    const tees = round?.courseSnapshot?.tees || {};
    const allTees = [...(tees.male || []), ...(tees.female || [])];
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

  const updatePlayerHole = (playerId, patch) => {
    if (!round?.holes || !playerId) {
      return;
    }
    const holeMeta = getHoleMetaForPlayer(playerId);
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
        const holes = (card.holes?.length ? card.holes : buildEmptyHoles(round.holes)).map(
          (hole) => ({
            ...hole,
            par: holeMeta[hole.hole]?.par,
            strokes:
              hole.strokes === "" || hole.strokes == null
                ? null
                : Number(hole.strokes),
            putts:
              hole.putts === "" || hole.putts == null
                ? null
                : Number(hole.putts),
          })
        );
        return fetch(`/api/rounds/${params.id}/scorecards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            holes,
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
    if (!selectedPlayers.length || !round?._id || isClosed) {
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

  return (
    <main>
      <AppShell
        title="Captura por hoyo"
        // subtitle="Selecciona jugadores y registra un hoyo a la vez."
      >
        <Card mb="lg">
          <Group grow align="flex-end">
            <MultiSelect
              label="Jugadores"
              placeholder="Selecciona participantes"
              data={playerOptions}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
              searchable
              clearable
              disabled={isClosed}
            />
            <Select
              label="Hoyo"
              placeholder="Selecciona hoyo"
              data={holeOptions}
              value={selectedHole}
              onChange={setSelectedHole}
            />
          </Group>
          <Group justify="space-between" mt="md">
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
        </Card>

        {selectedCards.length === 0 ? (
          <Card>
            <Text size="sm" c="dusk.6">
              Selecciona jugadores para comenzar la captura.
            </Text>
          </Card>
        ) : (
          selectedCards.map((card) => {
            const playerId = card.player?._id;
            const entry = card.holes?.find((hole) => hole.hole === holeNumber);
            const holeMeta = getHoleMetaForPlayer(playerId);
            const meta = holeMeta[holeNumber] || {};
            const locked = card.accepted || isClosed;
            return (
              <Card key={playerId} mb="lg">
                <Group justify="space-between" mb="sm">
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
                <Text size="sm" c="dusk.6" mb="sm">
                  Par {meta.par ?? "-"} · {meta.yardage ?? "--"} yds · HC{" "}
                  {meta.handicap ?? "--"}
                </Text>
                <Group gap="xs" mb="sm">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyStrokePreset(playerId, "birdie")}
                    disabled={locked}
                  >
                    Birdie
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyStrokePreset(playerId, "par")}
                    disabled={locked}
                  >
                    Par
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyStrokePreset(playerId, "bogey")}
                    disabled={locked}
                  >
                    Bogey
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyStrokePreset(playerId, "zopi")}
                    disabled={locked}
                  >
                    Zopi
                  </Button>
                </Group>
                <Group gap="xs" mb="sm">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyPuttPreset(playerId, 0)}
                    disabled={locked}
                  >
                    0 putt
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyPuttPreset(playerId, 1)}
                    disabled={locked}
                  >
                    1 putt
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyPuttPreset(playerId, 2)}
                    disabled={locked}
                  >
                    2 putt
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => applyPuttPreset(playerId, 3)}
                    disabled={locked}
                  >
                    3 putt
                  </Button>
                </Group>
                <Group grow align="flex-start" mb="sm">
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
                <Group gap="xs" mb="sm">
                  <Button
                    size="xs"
                    variant={entry?.water ? "filled" : "light"}
                    color="blue"
                    onClick={() =>
                      updatePlayerHole(playerId, { water: !entry?.water })
                    }
                    disabled={locked}
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
                  >
                    Sandy
                  </Button>
                </Group>
                <MultiSelect
                  label="Castigos"
                  data={PENALTIES}
                  value={entry?.penalties || []}
                  onChange={(value) =>
                    updatePlayerHole(playerId, { penalties: value })
                  }
                  placeholder="Selecciona"
                  clearable
                  disabled={locked}
                />
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
