"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Group, PasswordInput, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../components/AppShell";

export default function GrintSettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifiedAt, setVerifiedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user?._id) {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/grint/credentials")
      .then((res) => res.json())
      .then((data) => {
        if (data.grintEmail) {
          setEmail(data.grintEmail);
        }
        if (data.grintVerifiedAt) {
          setVerifiedAt(data.grintVerifiedAt);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/grint/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo validar el acceso.");
      }
      notifications.show({
        title: "Credenciales verificadas",
        message: "Acceso a TheGrint confirmado.",
        color: "club",
      });
      setPassword("");
      setVerifiedAt(new Date().toISOString());
    } catch (error) {
      notifications.show({
        title: "No se pudo validar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <AppShell title="TheGrint" subtitle="Configura tus credenciales.">
        <Card>
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Configura tus datos de acceso para subir tus jugadas directamente a The Grint.</Text>
          </Group>
          <form className="gml-form" onSubmit={handleSubmit}>
            <TextInput
              label="Email TheGrint"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Password TheGrint"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            {verifiedAt ? (
              <Text size="xs" c="dusk.6">
                Ultima verificacion: {new Date(verifiedAt).toLocaleString("es-MX")}
              </Text>
            ) : null}
            <Group justify="flex-end" mt="md">
              <Button color="club" type="submit" loading={loading}>
                Verificar y guardar
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
