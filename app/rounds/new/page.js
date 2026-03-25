"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  Modal,
  Select,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";
import { getCourseHandicapForRound } from "@/lib/scoring";

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalDateTimeValue = (date) => {
  if (!date) {
    return "";
  }
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) {
    return "";
  }
  return [
    `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`,
    `${pad2(next.getHours())}:${pad2(next.getMinutes())}`,
  ].join("T");
};

export default function NewRoundPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [holes, setHoles] = useState("18");
  const [nineType, setNineType] = useState("front");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [playerTees, setPlayerTees] = useState({});
  const [description, setDescription] = useState("");
  const [bets, setBets] = useState({ culebra: 0 });
  const [startedAt, setStartedAt] = useState(() =>
    toLocalDateTimeValue(new Date())
  );
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [editingTeeByPlayer, setEditingTeeByPlayer] = useState({});
  const [individualBets, setIndividualBets] = useState([]);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betDraft, setBetDraft] = useState(null);
  const [culebraEnabled, setCulebraEnabled] = useState(false);
  const [culebraPlayers, setCulebraPlayers] = useState([]);
  const [culebraAmount, setCulebraAmount] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const currentRole = data.user?.role || "";
        setRole(currentRole);
        if (currentRole === "player") {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => {
        notifications.show({
          title: "No se pudieron cargar los campos",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      });
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bets) {
          setBets((prev) => ({ ...prev, ...data.bets }));
          if (Number.isFinite(data.bets.culebra)) {
            setCulebraAmount(data.bets.culebra);
          }
        }
      })
      .catch(() => {
        setBets((prev) => ({ ...prev }));
      });
  }, []);

  useEffect(() => {
    fetch("/api/users?status=active")
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);


  const courseOptions = courses.map((course) => ({
    value: String(course.courseId),
    label: `${course.clubName} - ${course.courseName}`,
  }));

  const playerOptions = users.map((user) => ({
    value: user._id,
    label: `${user.name} · HC ${user.handicap ?? 0}`,
    name: user.name,
    handicap: user.handicap ?? 0,
    defaultTeeName: user.defaultTeeName || "",
  }));

  const selectedCourse = courses.find(
    (course) => String(course.courseId) === String(selectedCourseId)
  );
  const courseTees = selectedCourse?.tees || {};
  const allTees = [
    ...(courseTees.male || []),
    ...(courseTees.female || []),
  ];
  const teeOptions = allTees.map((tee) => ({
    value: tee.tee_name,
    label: tee.tee_name,
  }));
  const defaultTeeName =
    allTees.find((option) => option.tee_name === "BLANCAS")?.tee_name ||
    allTees[0]?.tee_name ||
    "";

  const togglePlayer = (playerId) => {
    setSelectedPlayers((prev) => {
      const exists = prev.includes(playerId);
      const next = exists
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId];
      setPlayerTees((prevTees) => {
        const nextTees = { ...prevTees };
        if (!exists) {
          if (!nextTees[playerId]) {
            const player = playerOptions.find(
              (option) => option.value === playerId
            );
            const preferred = String(player?.defaultTeeName || "").toUpperCase();
            const preferredValid =
              preferred &&
              allTees.find((option) => option.tee_name === preferred);
            nextTees[playerId] =
              preferredValid?.tee_name || defaultTeeName;
          }
        } else {
          delete nextTees[playerId];
        }
        return nextTees;
      });
      return next;
    });
  };

  const updatePlayerTee = (playerId, teeName) => {
    setPlayerTees((prev) => ({ ...prev, [playerId]: teeName }));
  };

  const setEditingTee = (playerId, isEditing) => {
    setEditingTeeByPlayer((prev) => ({ ...prev, [playerId]: isEditing }));
  };

  const roundMeta = {
    holes: Number(holes) || 18,
    nineType: holes === "9" ? nineType : "front",
  };

  const createEmptyBet = () => ({
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerA: "",
    playerB: "",
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

  const playerSelectionOptions = playerOptions.filter((player) =>
    selectedPlayers.includes(player.value)
  );

  useEffect(() => {
    setIndividualBets((prev) =>
      prev.filter(
        (bet) =>
          selectedPlayers.includes(bet.playerA) &&
          selectedPlayers.includes(bet.playerB)
      )
    );
  }, [selectedPlayers]);

  useEffect(() => {
    setCulebraPlayers((prev) =>
      prev.filter((playerId) => selectedPlayers.includes(playerId))
    );
  }, [selectedPlayers]);

  const openNewBet = () => {
    setBetDraft(createEmptyBet());
    setBetModalOpen(true);
  };

  const editBet = (bet) => {
    setBetDraft({ ...bet, amounts: { ...bet.amounts } });
    setBetModalOpen(true);
  };

  const removeBet = (betId) => {
    setIndividualBets((prev) => prev.filter((bet) => bet.id !== betId));
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
    setIndividualBets((prev) => {
      const exists = prev.find((bet) => bet.id === betDraft.id);
      if (exists) {
        return prev.map((bet) => (bet.id === betDraft.id ? betDraft : bet));
      }
      return [...prev, betDraft];
    });
    setBetModalOpen(false);
    setBetDraft(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (role === "player") {
      return;
    }
    if (!selectedCourseId) {
      notifications.show({
        title: "Faltan datos",
        message: "Selecciona un campo.",
        color: "clay",
      });
      return;
    }
    if (holes === "9" && !nineType) {
      notifications.show({
        title: "Faltan datos",
        message: "Selecciona si es front 9 o back 9.",
        color: "clay",
      });
      return;
    }
    setLoading(true);
    try {
      const me = await fetch("/api/me").then((res) => res.json());
      const startedAtValue =
        startedAt && !Number.isNaN(new Date(startedAt).getTime())
          ? new Date(startedAt).toISOString()
          : null;
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: Number(selectedCourseId),
          holes: Number(holes),
          nineType: holes === "9" ? nineType : "front",
          createdBy: me.user?._id,
          supervisor: me.user?._id,
          players: selectedPlayers,
          playerTees: selectedPlayers.map((playerId) => ({
            player: playerId,
            teeName: playerTees[playerId],
          })),
          individualBets,
          culebra: {
            enabled: culebraEnabled,
            players: culebraPlayers,
            amount: Number(culebraAmount) || 0,
          },
          description: description.trim(),
          startedAt: startedAtValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo abrir la jugada.");
      }
      router.push(`/rounds/${data.id}`);
    } catch (error) {
      notifications.show({
        title: "No se pudo abrir la jugada",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <AppShell title="Nueva jugada" subtitle="Selecciona campo y modalidad.">
        <Modal
          opened={playersModalOpen}
          onClose={() => setPlayersModalOpen(false)}
          title="Selecciona jugadores"
          centered
        >
          {!selectedCourseId ? (
            <Text size="sm" c="dusk.6" mb="sm">
              Selecciona un campo para habilitar los tees de salida.
            </Text>
          ) : null}
          <div className="gml-players-compact">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th>HC</Table.Th>
                <Table.Th>Tee</Table.Th>
                <Table.Th>HC Tee</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playerOptions.map((player) => {
                const selected = selectedPlayers.includes(player.value);
                const preferred = String(player.defaultTeeName || "").toUpperCase();
                const preferredValid =
                  preferred &&
                  allTees.find((option) => option.tee_name === preferred);
                const teeName =
                  playerTees[player.value] ||
                  preferredValid?.tee_name ||
                  defaultTeeName;
                const tee = allTees.find((option) => option.tee_name === teeName);
                const courseHandicap = getCourseHandicapForRound(
                  tee,
                  roundMeta,
                  player.handicap
                );
                const isEditing = Boolean(editingTeeByPlayer[player.value]);
                return (
                  <Table.Tr key={player.value}>
                    <Table.Td>{player.name}</Table.Td>
                    <Table.Td>{player.handicap}</Table.Td>
                    <Table.Td>
                      {isEditing && selectedCourseId ? (
                        <Select
                          data={teeOptions}
                          value={teeName}
                          onChange={(value) => {
                            updatePlayerTee(player.value, value || "");
                            setEditingTee(player.value, false);
                          }}
                          placeholder="Sin tee"
                          size="xs"
                        />
                      ) : (
                        <Button
                          variant="subtle"
                          size="xs"
                          className="gml-link-text"
                          onClick={() => setEditingTee(player.value, true)}
                          disabled={!selectedCourseId}
                        >
                          {teeName || "Sin tee"}
                        </Button>
                      )}
                    </Table.Td>
                    <Table.Td>{courseHandicap}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant={selected ? "filled" : "light"}
                        color={selected ? "club" : "dusk"}
                        onClick={() => togglePlayer(player.value)}
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
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setPlayersModalOpen(false)}>
              Listo
            </Button>
          </Group>
        </Modal>
        <Modal
          opened={betModalOpen}
          onClose={() => setBetModalOpen(false)}
          title="Raya individual"
          centered
        >
          {selectedPlayers.length < 2 ? (
            <Text size="sm" c="dusk.6">
              Selecciona al menos 2 jugadores para crear una raya individual.
            </Text>
          ) : (
            <>
              <Select
                label="Jugador A"
                data={playerSelectionOptions.map((player) => ({
                  value: player.value,
                  label: player.label,
                }))}
                value={betDraft?.playerA || ""}
                onChange={(value) =>
                  setBetDraft((prev) => ({ ...prev, playerA: value || "" }))
                }
              />
              <Select
                label="Jugador B"
                data={playerSelectionOptions.map((player) => ({
                  value: player.value,
                  label: player.label,
                }))}
                value={betDraft?.playerB || ""}
                onChange={(value) =>
                  setBetDraft((prev) => ({ ...prev, playerB: value || "" }))
                }
              />
              <Group grow mt="md">
                <TextInput
                  label="Vuelta 1"
                  type="number"
                  value={betDraft?.amounts?.front ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        front:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Vuelta 2"
                  type="number"
                  value={betDraft?.amounts?.back ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        back: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Ronda 18"
                  type="number"
                  value={betDraft?.amounts?.round ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        round:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Hoyo ganado"
                  type="number"
                  value={betDraft?.amounts?.hole ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        hole: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
              </Group>
              <Group grow mt="md">
                <TextInput
                  label="Birdie o menor"
                  type="number"
                  value={betDraft?.amounts?.birdie ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        birdie:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Sandy"
                  type="number"
                  value={betDraft?.amounts?.sandy ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        sandy:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Wet"
                  type="number"
                  value={betDraft?.amounts?.wet ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        wet: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Oh yes"
                  type="number"
                  value={betDraft?.amounts?.ohYes ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        ohYes:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
              </Group>
              <Group mt="md">
                <Text size="xs" c="dusk.6">
                  Predefinir montos:
                </Text>
                {[10, 20, 50, 100].map((preset) => (
                  <Button
                    key={preset}
                    size="xs"
                    variant="light"
                    onClick={() =>
                      setBetDraft((prev) => ({
                        ...prev,
                        amounts: {
                          ...prev.amounts,
                          front: preset,
                          back: preset,
                          round: preset,
                          hole: preset,
                          birdie: preset,
                          sandy: preset,
                          wet: preset,
                          ohYes: preset,
                        },
                      }))
                    }
                  >
                    ${preset}
                  </Button>
                ))}
              </Group>
              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setBetModalOpen(false)}>
                  Cancelar
                </Button>
                <Button color="club" onClick={saveBet}>
                  Guardar
                </Button>
              </Group>
            </>
          )}
        </Modal>
        <Card>
          <form className="gml-form" onSubmit={handleSubmit}>
            <Select
              label="Campo"
              placeholder="Selecciona un campo"
              data={courseOptions}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              searchable
            />
            <Select
              label="Ronda"
              placeholder="9 o 18 hoyos"
              data={[
                { value: "9", label: "9 hoyos" },
                { value: "18", label: "18 hoyos" },
              ]}
              value={holes}
              onChange={setHoles}
            />
            {holes === "9" ? (
              <Select
                label="Vuelta"
                placeholder="Front 9 o Back 9"
                data={[
                  { value: "front", label: "Front 9" },
                  { value: "back", label: "Back 9" },
                ]}
                value={nineType}
                onChange={setNineType}
              />
            ) : null}
            <div>
              <Text size="sm" fw={600} mb={6}>
                Jugadores
              </Text>
            <Button
              variant="light"
              onClick={() => setPlayersModalOpen(true)}
              disabled={!selectedCourseId}
            >
              {selectedPlayers.length > 0
                ? `Editar jugadores (${selectedPlayers.length})`
                : "Seleccionar jugadores"}
            </Button>
              {selectedPlayers.length > 0 ? (
                <Text size="xs" c="dusk.6" mt={4}>
                  {selectedPlayers
                    .map(
                      (id) =>
                        playerOptions.find((option) => option.value === id)
                          ?.label
                    )
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              ) : null}
            </div>
            <div>
              <Text size="sm" fw={600} mb={6}>
                Apuestas
              </Text>
              <Text size="xs" c="dusk.6" mb="sm">
                Sistema base: Rayas grupales (default)
              </Text>
              <Group justify="space-between" mb="sm">
                <Button
                  variant="light"
                  onClick={openNewBet}
                  disabled={selectedPlayers.length < 2}
                >
                  Agregar raya individual
                </Button>
                <Text size="xs" c="dusk.6">
                  {individualBets.length} configuradas
                </Text>
              </Group>
              {individualBets.length > 0 ? (
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
                    {individualBets.map((bet) => {
                      const playerA = playerOptions.find(
                        (option) => option.value === bet.playerA
                      );
                      const playerB = playerOptions.find(
                        (option) => option.value === bet.playerB
                      );
                      return (
                        <Table.Tr key={bet.id}>
                          <Table.Td>
                            {playerA?.name || "Jugador"} vs{" "}
                            {playerB?.name || "Jugador"}
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
            </div>
            <div>
              <Text size="sm" fw={600} mb={6}>
                Culebra
              </Text>
              <Group align="center" mb="sm">
                <Button
                  variant={culebraEnabled ? "filled" : "light"}
                  color={culebraEnabled ? "club" : "dusk"}
                  onClick={() => setCulebraEnabled((prev) => !prev)}
                  disabled={selectedPlayers.length === 0}
                >
                  {culebraEnabled ? "Activada" : "Activar culebra"}
                </Button>
                <TextInput
                  label="Monto"
                  type="number"
                  value={culebraAmount}
                  onChange={(event) =>
                    setCulebraAmount(
                      Number(event?.currentTarget?.value ?? "") || 0
                    )
                  }
                  size="xs"
                />
                <Button
                  variant="light"
                  size="xs"
                  onClick={() =>
                    setCulebraPlayers((prev) =>
                      prev.length === selectedPlayers.length
                        ? []
                        : [...selectedPlayers]
                    )
                  }
                  disabled={!culebraEnabled}
                >
                  {culebraPlayers.length === selectedPlayers.length
                    ? "Limpiar todos"
                    : "Seleccionar todos"}
                </Button>
              </Group>
              {culebraEnabled ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jugador</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {playerSelectionOptions.map((player) => {
                      const selected = culebraPlayers.includes(player.value);
                      return (
                        <Table.Tr key={`culebra-${player.value}`}>
                          <Table.Td>{player.name}</Table.Td>
                          <Table.Td>
                            <Button
                              size="xs"
                              variant={selected ? "filled" : "light"}
                              color={selected ? "club" : "dusk"}
                              onClick={() =>
                                setCulebraPlayers((prev) =>
                                  prev.includes(player.value)
                                    ? prev.filter((id) => id !== player.value)
                                    : [...prev, player.value]
                                )
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
            </div>
            <TextInput
              label="Inicio de la jugada"
              type="datetime-local"
              value={startedAt}
              onChange={(event) => setStartedAt(event.currentTarget.value)}
            />
            <Textarea
              label="Descripcion (opcional)"
              placeholder=""
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="space-between" mt="md">
              <Button color="club" type="submit" loading={loading}>
                Abrir jugada
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
