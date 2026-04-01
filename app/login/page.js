"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  Modal,
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
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  const WhatsAppIcon = ({ size = 16 }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20.52 3.48A11.75 11.75 0 0 0 12.04 0C5.51 0 .2 5.3.2 11.83c0 2.08.54 4.1 1.57 5.89L0 24l6.47-1.7a11.79 11.79 0 0 0 5.57 1.42h.01c6.53 0 11.84-5.3 11.84-11.83 0-3.16-1.23-6.13-3.37-8.41Zm-8.47 18.24h-.01a9.8 9.8 0 0 1-5-1.36l-.36-.21-3.84 1 1.02-3.74-.23-.38a9.8 9.8 0 1 1 8.42 4.69Zm5.71-7.33c-.31-.16-1.86-.92-2.15-1.03-.29-.11-.5-.16-.7.16s-.8 1.03-.98 1.24c-.18.21-.36.24-.67.08-.31-.16-1.3-.48-2.48-1.54-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.14-.64.14-.14.31-.36.46-.54.16-.18.2-.31.31-.52.1-.21.05-.4-.02-.56-.08-.16-.7-1.68-.96-2.31-.25-.6-.5-.52-.7-.53h-.6c-.2 0-.52.08-.8.4-.28.31-1.05 1.03-1.05 2.52 0 1.49 1.08 2.93 1.23 3.13.16.2 2.12 3.25 5.14 4.56.72.31 1.29.49 1.73.63.73.23 1.4.2 1.92.12.58-.09 1.86-.76 2.13-1.5.26-.74.26-1.37.18-1.5-.08-.13-.29-.21-.6-.37Z"
      />
    </svg>
  );

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
        message: error.message || "Verifica el teléfono.",
        color: "clay",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleWhatsAppLogin = async () => {
    if (!phone.trim()) {
      setWhatsAppModalOpen(true);
      return;
    }
    setWhatsAppLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password: "" }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch (error) {
        data = {};
      }
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const message =
        data.error || "Te enviamos una liga por WhatsApp para ingresar.";
      const sentByWhatsApp = /whatsapp/i.test(message);
      notifications.show({
        title: sentByWhatsApp ? "Liga enviada" : "No se pudo enviar",
        message,
        color: sentByWhatsApp ? "club" : "clay",
      });
    } catch (error) {
      notifications.show({
        title: "No se pudo enviar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setWhatsAppLoading(false);
    }
  };

  return (
    <main>
      <AppShell title="Ingreso" subtitle="Entra con tu usuario y clave.">
        <Modal
          opened={whatsAppModalOpen}
          onClose={() => setWhatsAppModalOpen(false)}
          title="Falta tu telefono"
          centered
        >
          <Text size="sm" c="dusk.6" mb="md">
            Primero captura tu numero telefonico para enviarte la liga.
          </Text>
          <Button onClick={() => setWhatsAppModalOpen(false)}>Entendido</Button>
        </Modal>
        <Card>
          <form className="gml-form" onSubmit={handleLogin}>
            <TextInput
              label="Teléfono"
              placeholder="5512345678"
              description="8 a 13 digitos"
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
            <Group justify="space-between" align="center">
              <Button type="submit" color="club" loading={loading}>
                Entrar
              </Button>
              <Button
                type="button"
                variant="light"
                color="club"
                leftSection={<WhatsAppIcon size={18} />}
                loading={whatsAppLoading}
                onClick={handleWhatsAppLogin}
              >
                Ingresar con WhatsApp
              </Button>
            </Group>
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
              label="Teléfono para registro"
              placeholder="5512345678"
              description="8 a 13 digitos"
              value={registerPhone}
              onChange={(event) => setRegisterPhone(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Nombre"
              placeholder="Nombre Apellido"
              description="Nombre, apodo, alias, aka o lo que quieras ponerle para que te reconozcan"
              value={registerName}
              onChange={(event) => setRegisterName(event.currentTarget.value)}
              required
            />
            <TextInput
              label="Handicap"
              description="Captura el index que se muestra en tu Grint"
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
                Registrarme
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
