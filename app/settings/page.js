"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Group, NumberInput, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../components/AppShell";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [bets, setBets] = useState({
    holeWinner: 30,
    medal: 120,
    match: 120,
    sandyPar: 20,
    birdie: 30,
    eagle: 50,
    albatross: 80,
    holeOut: 40,
    wetPar: 20,
    ohYes: 30,
  });

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role !== "admin") {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bets) {
          setBets((prev) => ({ ...prev, ...data.bets }));
        }
      })
      .catch(() => {
        notifications.show({
          title: "No se pudo cargar configuracion",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      });
  }, []);

  const updateBet = (key, value) => {
    setBets((prev) => ({ ...prev, [key]: Number(value) || 0 }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo guardar.");
      }
      notifications.show({
        title: "Configuracion guardada",
        message: "Los montos fueron actualizados.",
        color: "club",
      });
    } catch (error) {
      notifications.show({
        title: "Error al guardar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <AppShell title="Configuracion" subtitle="Montos de apuesta globales.">
        <Card>
          <form className="gml-form" onSubmit={handleSave}>
            <NumberInput
              label="Ganador por hoyo"
              value={bets.holeWinner}
              onChange={(value) => updateBet("holeWinner", value)}
            />
            <NumberInput
              label="Ganador medal"
              value={bets.medal}
              onChange={(value) => updateBet("medal", value)}
            />
            <NumberInput
              label="Ganador match"
              value={bets.match}
              onChange={(value) => updateBet("match", value)}
            />
            <NumberInput
              label="Birdie"
              value={bets.birdie}
              onChange={(value) => updateBet("birdie", value)}
            />
            <NumberInput
              label="Aguila"
              value={bets.eagle}
              onChange={(value) => updateBet("eagle", value)}
            />
            <NumberInput
              label="Albatross"
              value={bets.albatross}
              onChange={(value) => updateBet("albatross", value)}
            />
            <NumberInput
              label="Hole out"
              value={bets.holeOut}
              onChange={(value) => updateBet("holeOut", value)}
            />
            <NumberInput
              label="Sandy"
              value={bets.sandyPar}
              onChange={(value) => updateBet("sandyPar", value)}
            />
            <NumberInput
              label="Wet par"
              value={bets.wetPar}
              onChange={(value) => updateBet("wetPar", value)}
            />
            <NumberInput
              label="Oh yes (par 3)"
              value={bets.ohYes}
              onChange={(value) => updateBet("ohYes", value)}
            />
            <Text size="sm" c="dusk.6">
              Los castigos se registran en la tarjeta, sin pagos en efectivo.
            </Text>
            <Group justify="space-between">
              <Text size="sm" c="dusk.6">
                Todos los montos en MXN.
              </Text>
              <Button color="club" type="submit" loading={loading}>
                Guardar cambios
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
