"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Text } from "@mantine/core";
import AppShell from "../../components/AppShell";

export default function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("validating");
  const [message, setMessage] = useState("Validando tu liga...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Liga invalida.");
      return;
    }

    fetch("/api/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "active") {
          setStatus("active");
          setMessage("Acceso aprobado. Entrando...");
          setTimeout(() => router.push("/"), 1200);
          return;
        }
        if (data.status === "pending") {
          setStatus("pending");
          setMessage(
            "Tu registro esta pendiente. Un administrador debe aprobarte."
          );
          return;
        }
        setStatus("error");
        setMessage("Liga invalida o expirada.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("No se pudo validar la liga.");
      });
  }, [router, token]);

  return (
    <main>
      <AppShell title="Validacion" subtitle="Liga de acceso por WhatsApp.">
        <Card>
          <Text fw={700} mb="xs">
            {message}
          </Text>
          {status === "pending" ? (
            <Text size="sm" c="dusk.6">
              Puedes solicitar una nueva liga desde la pantalla de ingreso.
            </Text>
          ) : null}
          {status === "error" ? (
            <Button mt="md" onClick={() => router.push("/login")}>
              Volver al ingreso
            </Button>
          ) : null}
        </Card>
      </AppShell>
    </main>
  );
}
