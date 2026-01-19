"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../components/AppShell";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    handicap: "",
    role: "player",
    password: "",
  });
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role !== "admin") {
          router.replace("/");
          return;
        }
        loadUsers();
      })
      .catch(() => router.replace("/"));
  }, [router]);

  const handleSelect = (id) => {
    setCreating(false);
    setSelectedId(id);
    const user = users.find((item) => item._id === id);
    if (!user) {
      return;
    }
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      handicap: String(user.handicap ?? ""),
      role: user.role || "player",
      password: "",
    });
  };

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(form.phone)) {
      notifications.show({
        title: "Telefono invalido",
        message: "Debe tener 10 digitos.",
        color: "clay",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        handicap: Number(form.handicap || 0),
        role: form.role,
        password: form.password || undefined,
      };
      const res = creating
        ? await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/users/${selectedId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo guardar.");
      }
      notifications.show({
        title: creating ? "Jugador creado" : "Jugador actualizado",
        message: creating ? "Nuevo jugador agregado." : "Cambios guardados.",
        color: "club",
      });
      setForm((prev) => ({ ...prev, password: "" }));
      setCreating(false);
      setSelectedId(null);
      loadUsers();
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

  return (
    <main>
      <AppShell title="Usuarios" subtitle="Altas, bajas y roles.">
        <Card mb="lg">
          <Group justify="space-between" mb="sm">
            <Text fw={700}>
              {creating ? "Nuevo jugador" : "Editar jugador"}
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setCreating(true);
                setSelectedId(null);
                setForm({
                  name: "",
                  phone: "",
                  handicap: "",
                  role: "player",
                  password: "",
                });
              }}
            >
              Nuevo jugador
            </Button>
          </Group>
          <form className="gml-form" onSubmit={handleSave}>
            <Select
              label="Jugador"
              placeholder="Selecciona"
              data={users.map((user) => ({
                value: user._id,
                label: `${user.name} · ${user.phone}`,
              }))}
              value={selectedId}
              onChange={handleSelect}
              searchable
              disabled={loading || creating}
            />
            <TextInput
              label="Nombre"
              placeholder="Nombre Apellido"
              value={form.name}
              onChange={(event) =>
                updateForm({ name: event.currentTarget.value })
              }
            />
            <TextInput
              label="Telefono"
              placeholder="5512345678"
              description="10 digitos"
              value={form.phone}
              onChange={(event) =>
                updateForm({ phone: event.currentTarget.value })
              }
            />
            <TextInput
              label="Handicap"
              placeholder="HC"
              value={form.handicap}
              onChange={(event) =>
                updateForm({ handicap: event.currentTarget.value })
              }
            />
            <Select
              label="Rol"
              value={form.role}
              onChange={(value) => updateForm({ role: value })}
              data={[
                { value: "player", label: "Jugador" },
                { value: "supervisor", label: "Supervisor" },
                { value: "admin", label: "Administrador" },
              ]}
            />
            <PasswordInput
              label="Nueva clave"
              placeholder="Dejar en blanco para no cambiar"
              value={form.password}
              onChange={(event) =>
                updateForm({ password: event.currentTarget.value })
              }
            />
            <Group justify="flex-end">
              <Button
                variant="light"
                type="button"
                onClick={() => {
                  if (creating) {
                    setCreating(false);
                    setSelectedId(null);
                    setForm({
                      name: "",
                      phone: "",
                      handicap: "",
                      role: "player",
                      password: "",
                    });
                    return;
                  }
                  handleSelect(selectedId);
                }}
              >
                {creating ? "Cancelar" : "Restablecer"}
              </Button>
              <Button color="club" type="submit" loading={saving}>
                {creating ? "Crear jugador" : "Guardar cambios"}
              </Button>
            </Group>
          </form>
        </Card>

        <Card>
          <Group justify="space-between" mb="sm">
            <Text fw={700}>Listado</Text>
            <Button size="xs" variant="light">
              Exportar
            </Button>
          </Group>
          {users.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay jugadores registrados.
            </Text>
          ) : (
            users.map((user) => (
              <Group key={user._id} justify="space-between" mb="sm">
                <div>
                  <Text fw={600}>{user.name}</Text>
                  <Text size="sm" c="dusk.6">
                    {user.phone} · HC {user.handicap ?? 0} · {user.role}
                  </Text>
                </div>
                <Button
                  variant="light"
                  onClick={() => handleSelect(user._id)}
                >
                  Editar
                </Button>
              </Group>
            ))
          )}
        </Card>
      </AppShell>
    </main>
  );
}
