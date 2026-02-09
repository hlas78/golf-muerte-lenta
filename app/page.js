"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "./components/AppShell";
import StatCard from "./components/StatCard";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState("");
  const [rounds, setRounds] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importingRound, setImportingRound] = useState(false);
  const [importFile, setImportFile] = useState(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.user?.role === "admin");
        setRole(data.user?.role || "");
      })
      .catch(() => {
        setIsAdmin(false);
        setRole("");
      });
  }, []);

  useEffect(() => {
    fetch("/api/rounds")
      .then((res) => res.json())
      .then((data) => setRounds(Array.isArray(data) ? data : []))
      .catch(() => setRounds([]));
  }, []);

  const openRounds = rounds.filter(
    (round) => round.status === "open" || round.status === "active"
  );
  const closedRounds = rounds.filter((round) => round.status === "closed");
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

  const handleImportRound = async () => {
    if (!importFile) {
      return;
    }
    setImportingRound(true);
    try {
      const text = await importFile.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/rounds/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo importar la jugada.");
      }
      setImportOpen(false);
      setImportFile(null);
      if (Array.isArray(data.missingPlayers) && data.missingPlayers.length) {
        notifications.show({
          title: "Importacion parcial",
          message: `Faltan jugadores: ${data.missingPlayers.join(", ")}`,
          color: "clay",
        });
      } else {
        notifications.show({
          title: "Jugada importada",
          message: "Se importo correctamente.",
          color: "club",
        });
      }
      window.location.href = `/rounds/${data.id}`;
    } catch (error) {
      notifications.show({
        title: "No se pudo importar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setImportingRound(false);
    }
  };


  return (
    <main>
      <AppShell
        title="Tablero"
        subtitle=""
        showAdminNav={isAdmin}
        showGreetingAsTitle
      >
        <Modal
          opened={importOpen}
          onClose={() => setImportOpen(false)}
          title="Importar jugada"
          centered
        >
          <Text size="sm" c="dusk.6" mb="sm">
            Selecciona un archivo exportado de Golf Muerte Lenta.
          </Text>
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setImportFile(file);
            }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="club"
              onClick={handleImportRound}
              loading={importingRound}
              disabled={!importFile}
            >
              Importar
            </Button>
          </Group>
        </Modal>
        {/* <section className="gml-hero">
          <div className="gml-badge">Golf</div>
          <h1>Muerte Lenta</h1>
          <p>¡A jugar!
          </p>
          {<Group>
            <Button component={Link} href="/login" color="clay">
              Ingresar
            </Button>
            {role && role !== "player" ? (
              <Button variant="light" component={Link} href="/rounds/new">
                Abrir jugada
              </Button>
            ) : null}
            {isAdmin ? (
              <Button variant="light" component={Link} href="/admin/approvals">
                Aprobar usuarios
              </Button>
            ) : null}
          </Group> }
        </section> */}

        <section style={{ marginTop: "2rem" }}>
          <Group justify="space-between" mb="md">
            <Text fw={700} c="club.7">Jugadas abiertas</Text>
            <Group gap="sm">
              {isAdmin ? (
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setImportOpen(true)}
                >
                  Importar jugada
                </Button>
              ) : null}
              <Text size="sm" c="dusk.6">
                {openRounds.length} activas
              </Text>
            </Group>
          </Group>
          <div className="gml-card-grid">
            {openRounds.length === 0 ? (
              <Text size="sm" c="dusk.6">
                No hay jugadas abiertas.
              </Text>
            ) : (
              openRounds.map((round) => (
                <Card
                  key={round._id}
                  component={Link}
                  href={`/rounds/${round._id}`}
                  withBorder
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={700}>
                      {round.courseSnapshot?.clubName || "Campo"} - {round.holes} hoyos
                    </Text>
                  </Group>
                  {/* <Text size="sm" c="dusk.6">
                    {round.courseSnapshot?.courseName || "Curso"}
                  </Text> */}
                  <Text size="sm" c="dusk.6">
                    Jugadores: {round.players?.length
                      ? round.players
                          .map((player) => player?.name)
                          .filter(Boolean)
                          .join(", ")
                      : "Sin jugadores"}
                  </Text>
                  {round.description ? (
                    <Text size="sm" c="dusk.6">
                      {round.description}
                    </Text>
                  ) : null}
                  <Text size="sm" c="dusk.6">
                    Inicio: {formatRoundDate(round.createdAt)}
                  </Text>
                  {/* <Text size="sm" c="dusk.6">
                    Supervisa: {round.supervisor?.name || "Por asignar"}
                  </Text> */}
                </Card>
              ))
            )}
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <Group justify="space-between" mb="md">
            <Text fw={700} c="clay.7">Jugadas cerradas</Text>
            <Text size="sm" c="dusk.6">
              {closedRounds.length} cerradas
            </Text>
          </Group>
          <div className="gml-card-grid">
            {closedRounds.length === 0 ? (
              <Text size="sm" c="dusk.6">
                No hay jugadas cerradas.
              </Text>
            ) : (
              closedRounds.map((round) => (
                <Card
                  key={round._id}
                  component={Link}
                  href={`/rounds/${round._id}`}
                  withBorder
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={700}>
                      {round.courseSnapshot?.clubName || "Campo"}
                    </Text>
                    <Group gap="xs">
                      <Badge color="dusk" variant="light">
                        Cerrada
                      </Badge>
                    </Group>
                  </Group>
                  <Text size="sm" c="dusk.6">
                    {round.courseSnapshot?.courseName || "Curso"}
                  </Text>
                  <Text size="sm" c="dusk.6">
                    {round.holes} hoyos · Jugadores {round.players?.length || 0}
                  </Text>
                  {round.description ? (
                    <Text size="sm" c="dusk.6">
                      {round.description}
                    </Text>
                  ) : null}
                  <Text size="sm" c="dusk.6">
                    {formatRoundDate(round.createdAt)}
                  </Text>
                </Card>
              ))
            )}
          </div>
        </section>
      </AppShell>
    </main>
  );
}
