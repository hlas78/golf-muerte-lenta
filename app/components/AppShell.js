"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Group, Text, Badge } from "@mantine/core";
import LogoMark from "./LogoMark";

export default function AppShell({
  title,
  subtitle,
  children,
  showAdminNav,
  showGreetingAsTitle,
}) {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setUserName(data.user?.name || "");
        setUserRole(data.user?.role || "");
      })
      .catch(() => {
        setUserName("");
        setUserRole("");
      });
  }, []);

  return (
    <div className="gml-shell">
      <Group justify="space-between" align="center" mb="xl">
        <Group align="center">
          <LogoMark size={44} />
          <div>
            <Text tt="uppercase" size="xs" c="dusk.6" fw={600}>
              Golf Muerte Lenta
            </Text>
            <Text fw={700} size="lg">
              {showGreetingAsTitle && userName ? `Hola, ${userName}` : title}
            </Text>
            {subtitle ? (
              <Text size="sm" c="dusk.6">
                {subtitle}
              </Text>
            ) : null}
            {!showGreetingAsTitle && userName ? (
              <Text size="sm" c="dusk.6">
                Hola, {userName}
              </Text>
            ) : null}
          </div>
        </Group>
        {/* <Badge color="clay" variant="filled">
          MXN
        </Badge> */}
      </Group>
      {children}
      <nav className="gml-nav">
        <div className="gml-nav-inner">
          <Link href="/">Inicio</Link>
          <Link href="/history">Historial</Link>
          {userRole && userRole !== "player" ? (
            <Link href="/rounds/new">Nueva jugada</Link>
          ) : null}
          {userRole === "admin" ? <Link href="/users">Usuarios</Link> : null}
          {showAdminNav ? <Link href="/admin/approvals">Aprobaciones</Link> : null}
          {userRole === "admin" ? <Link href="/settings">Config</Link> : null}
        </div>
      </nav>
    </div>
  );
}
