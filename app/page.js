"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Group, Text } from "@mantine/core";
import AppShell from "./components/AppShell";
import StatCard from "./components/StatCard";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState("");
  const [rounds, setRounds] = useState([]);

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

  return (
    <main>
      <AppShell
        title="Tablero"
        subtitle=""
        showAdminNav={isAdmin}
        showGreetingAsTitle
      >
        <section className="gml-hero">
          <div className="gml-badge">Golf</div>
          <h1>Muerte Lenta</h1>
          <p>¡A jugar!
          </p>
          {/* <Group>
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
          </Group> */}
        </section>

        <section style={{ marginTop: "2rem" }}>
          <Group justify="space-between" mb="md">
            <Text fw={700}>Jugadas abiertas</Text>
            <Text size="sm" c="dusk.6">
              {openRounds.length} activas
            </Text>
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
                      {round.courseSnapshot?.clubName || "Campo"}
                    </Text>
                    <Badge color={round.status === "active" ? "club" : "dusk"}>
                      {round.status === "active" ? "Activa" : "Abierta"}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dusk.6">
                    {round.courseSnapshot?.courseName || "Curso"} · tee por
                    jugador
                  </Text>
                  <Text size="sm" c="dusk.6">
                    {round.holes} hoyos · Jugadores {round.players?.length || 0}
                  </Text>
                  <Text size="sm" c="dusk.6">
                    {round.players?.length
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
                    {formatRoundDate(round.createdAt)}
                  </Text>
                  <Text size="sm" c="dusk.6">
                    Supervisa: {round.supervisor?.name || "Por asignar"}
                  </Text>
                </Card>
              ))
            )}
          </div>
        </section>

        <section style={{ marginTop: "2rem" }}>
          <Group justify="space-between" mb="md">
            <Text fw={700}>Jugadas cerradas</Text>
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
                  href={`/rounds/${round._id}/scorecard`}
                  withBorder
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={700}>
                      {round.courseSnapshot?.clubName || "Campo"}
                    </Text>
                    <Badge color="dusk" variant="light">
                      Cerrada
                    </Badge>
                  </Group>
                  <Text size="sm" c="dusk.6">
                    {round.courseSnapshot?.courseName || "Curso"} · tee por
                    jugador
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
                  <Text size="sm" c="dusk.6">
                    Pagos disponibles
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
