"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";

export default function ApprovalsPage() {
  const router = useRouter();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadPending = async () => {
    const res = await fetch("/api/users?status=pending");
    const data = await res.json();
    setPending(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role !== "admin") {
          router.replace("/");
          return;
        }
        setIsAdmin(true);
        return loadPending();
      })
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const approveUser = async (id) => {
    const res = await fetch(`/api/users/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      notifications.show({
        title: "No se pudo aprobar",
        message: "Intenta de nuevo.",
        color: "clay",
      });
      return;
    }
    notifications.show({
      title: "Usuario aprobado",
      message: "Se envio confirmacion por WhatsApp.",
      color: "club",
    });
    loadPending();
  };

  const rejectUser = async (id) => {
    const res = await fetch(`/api/users/${id}/reject`, { method: "POST" });
    if (!res.ok) {
      notifications.show({
        title: "No se pudo rechazar",
        message: "Intenta de nuevo.",
        color: "clay",
      });
      return;
    }
    notifications.show({
      title: "Solicitud rechazada",
      message: "Se removio de la lista.",
      color: "dusk",
    });
    loadPending();
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <main>
      <AppShell
        title="Aprobaciones"
        subtitle="Solicitudes pendientes de acceso."
        showAdminNav
      >
        <Card>
          {loading ? (
            <Text>Cargando...</Text>
          ) : pending.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay solicitudes pendientes.
            </Text>
          ) : (
            pending.map((user) => (
              <Group key={user._id} justify="space-between" mb="sm">
                <div>
                  <Text fw={600}>{user.name}</Text>
                  <Text size="sm" c="dusk.6">
                    {user.phone}
                  </Text>
                </div>
                <Group>
                  <Button
                    variant="light"
                    color="dusk"
                    onClick={() => rejectUser(user._id)}
                  >
                    Rechazar
                  </Button>
                  <Button color="club" onClick={() => approveUser(user._id)}>
                    Aprobar
                  </Button>
                </Group>
              </Group>
            ))
          )}
        </Card>
      </AppShell>
    </main>
  );
}
