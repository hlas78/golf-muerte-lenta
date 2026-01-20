"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  PasswordInput,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../components/AppShell";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerHandicap, setRegisterHandicap] = useState("");
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar sesion");
      }
      window.location.href = "/";
    } catch (error) {
      notifications.show({
        title: "No se pudo ingresar",
        message: error.message || "Revisa tus datos.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegistering(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: registerPhone,
          name: registerName,
          handicap: registerHandicap,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo enviar la liga.");
      }
      notifications.show({
        title: "Solicitud enviada",
        message: "Se mandaron tus datos a revisión, te daremos el acceso a través de whatsapp.",
        color: "club",
      });
      setRegisterPhone("");
      setRegisterName("");
      setRegisterHandicap("");
    } catch (error) {
      notifications.show({
        title: "Registro fallido",
        message: error.message || "Verifica el telefono.",
        color: "clay",
      });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <main>
      <AppShell title="Ingreso" subtitle="Entra con tu usuario y clave.">
        <Card>
          <form className="gml-form" onSubmit={handleLogin}>
            <TextInput
              label="Telefono"
              placeholder="5512345678"
              description="10 digitos"
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Clave"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Button type="submit" color="club" loading={loading}>
              Entrar
            </Button>
          </form>
          <Text size="xs" mt="md" c="dusk.6">
            Tu sesion se conserva en este dispositivo.
          </Text>
        </Card>

        <Card mt="lg">
          <Text fw={700} mb="xs">
            ¿Nuevo en el grupo?
          </Text>
          <Text size="sm" c="dusk.6" mb="md">
            Enviaremos una liga por WhatsApp. Quedaras pendiente hasta que el
            admin te acepte.
          </Text>
          <form className="gml-form" onSubmit={handleRegister}>
            <TextInput
              label="Telefono para registro"
              placeholder="5512345678"
              description="10 digitos"
              value={registerPhone}
              onChange={(event) => setRegisterPhone(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Nombre"
              placeholder="Nombre Apellido"
              description="Nombre y apellido"
              value={registerName}
              onChange={(event) => setRegisterName(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Handicap"
              placeholder="12"
              value={registerHandicap}
              onChange={(event) =>
                setRegisterHandicap(event.currentTarget.value)
              }
              required
            />
            <Group justify="space-between">
              <Button
                variant="light"
                onClick={() => router.push("/")}
                type="button"
              >
                Volver
              </Button>
              <Button color="clay" type="submit" loading={registering}>
                Enviar liga
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
