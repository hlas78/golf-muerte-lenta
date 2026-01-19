"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  Group,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import AppShell from "../components/AppShell";

export default function HistoryPage() {
  const [rounds, setRounds] = useState([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetch("/api/rounds")
      .then((res) => res.json())
      .then((data) => setRounds(Array.isArray(data) ? data : []))
      .catch(() => setRounds([]));
  }, []);

  const closedRounds = useMemo(
    () => rounds.filter((round) => round.status === "closed"),
    [rounds]
  );

  const courseOptions = useMemo(() => {
    const unique = new Set(
      closedRounds.map((round) => round.courseSnapshot?.clubName).filter(Boolean)
    );
    return Array.from(unique).map((name) => ({
      value: name,
      label: name,
    }));
  }, [closedRounds]);

  const filtered = useMemo(() => {
    return closedRounds.filter((round) => {
      const matchesCourse =
        !courseFilter ||
        round.courseSnapshot?.clubName === courseFilter;
      const matchesQuery =
        !query ||
        `${round.courseSnapshot?.clubName || ""} ${
          round.courseSnapshot?.courseName || ""
        }`
          .toLowerCase()
          .includes(query.toLowerCase());
      const ended = round.endedAt ? new Date(round.endedAt) : null;
      const fromOk = dateFrom ? ended && ended >= new Date(dateFrom) : true;
      const toOk = dateTo ? ended && ended <= new Date(dateTo) : true;
      return matchesCourse && matchesQuery && fromOk && toOk;
    });
  }, [closedRounds, courseFilter, query, dateFrom, dateTo]);

  return (
    <main>
      <AppShell title="Historial" subtitle="Jugadas cerradas y pagos.">
        <Card mb="lg">
          <Group grow>
            <Select
              label="Campo"
              placeholder="Todos"
              data={courseOptions}
              value={courseFilter}
              onChange={setCourseFilter}
              clearable
            />
            <TextInput
              label="Buscar"
              placeholder="Nombre del campo"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </Group>
          <Group grow mt="sm">
            <TextInput
              label="Desde"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.currentTarget.value)}
            />
            <TextInput
              label="Hasta"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.currentTarget.value)}
            />
          </Group>
        </Card>

        <div className="gml-card-grid">
          {filtered.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay jugadas cerradas con esos filtros.
            </Text>
          ) : (
            filtered.map((round) => (
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
                <Text size="sm" c="dusk.6">
                  {round.endedAt
                    ? new Date(round.endedAt).toLocaleDateString()
                    : "Sin fecha"}
                </Text>
              </Card>
            ))
          )}
        </div>
      </AppShell>
    </main>
  );
}
