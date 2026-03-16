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
  const [startedAt, setStartedAt] = useState(() =>
    toLocalDateTimeValue(new Date())
  );
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [editingTeeByPlayer, setEditingTeeByPlayer] = useState({});

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
    fetch("/api/users")
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
          if (!nextTees[playerId] && defaultTeeName) {
            nextTees[playerId] = defaultTeeName;
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
                const teeName = playerTees[player.value] || defaultTeeName;
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
