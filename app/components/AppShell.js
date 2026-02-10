"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Drawer, Group, Text, Badge, Button } from "@mantine/core";
import { buildInfo } from "../buildInfo";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = useMemo(() => {
    const items = [{ label: "Inicio", href: "/" }];
    if (userRole && userRole !== "player") {
      items.push({ label: "Nueva jugada", href: "/rounds/new" });
    }
    if (userRole === "admin") {
      items.push({ label: "Usuarios", href: "/users" });
    }
    if (showAdminNav) {
      items.push({ label: "Aprobaciones", href: "/admin/approvals" });
    }
    if (userRole === "admin") {
      items.push({ label: "Config", href: "/settings" });
      items.push({ label: "Descarga campo", href: "/admin/course-download" });
    }
    if (userRole) {
      items.push({ label: "TheGrint", href: "/grint" });
    }
    items.push({ label: "Historial", href: "/history" });
    return items;
  }, [showAdminNav, userRole]);

  const primaryNav = navItems.slice(0, 3);
  const overflowNav = navItems.slice(3);

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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  };

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
        {userName ? (
          <Button
            variant="light"
            size="xs"
            onClick={handleLogout}
            loading={loggingOut}
          >
            Cerrar sesion
          </Button>
        ) : null}
      </Group>
      {children}
      <Text size="xs" c="dusk.6" mt="lg">
        v{buildInfo.version} · {buildInfo.builtAt}
      </Text>
      <nav className="gml-nav">
        <div className="gml-nav-inner">
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          {overflowNav.length > 0 ? (
            <Button
              variant="light"
              size="xs"
              onClick={() => setMoreOpen(true)}
            >
              Mas
            </Button>
          ) : null}
        </div>
      </nav>
      <Drawer
        opened={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Mas opciones"
        position="bottom"
      >
        <Group direction="column" gap="sm">
          {overflowNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </Group>
      </Drawer>
    </div>
  );
}
