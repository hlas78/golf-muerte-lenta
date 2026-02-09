"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";

export default function NewRoundPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [holes, setHoles] = useState("18");
  const [nineType, setNineType] = useState("front");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const currentRole = data.user?.role || "";
        setRole(currentRole);
        if (currentRole === "player") {
          router.replace("/");
        }
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => {
        notifications.show({
          title: "No se pudieron cargar los campos",
          message: "Intenta mas tarde.",
          color: "clay",
        });
      });
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);


  const courseOptions = courses.map((course) => ({
    value: String(course.courseId),
    label: `${course.clubName} - ${course.courseName}`,
  }));

  const playerOptions = users.map((user) => ({
    value: user._id,
    label: `${user.name} · HC ${user.handicap ?? 0}`,
  }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (role === "player") {
      return;
    }
    if (!selectedCourseId) {
      notifications.show({
        title: "Faltan datos",
        message: "Selecciona un campo.",
        color: "clay",
      });
      return;
    }
    if (holes === "9" && !nineType) {
      notifications.show({
        title: "Faltan datos",
        message: "Selecciona si es front 9 o back 9.",
        color: "clay",
      });
      return;
    }
    setLoading(true);
    try {
      const me = await fetch("/api/me").then((res) => res.json());
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: Number(selectedCourseId),
          holes: Number(holes),
          nineType: holes === "9" ? nineType : "front",
          createdBy: me.user?._id,
          supervisor: me.user?._id,
          players: selectedPlayers,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo abrir la jugada.");
      }
      router.push(`/rounds/${data.id}`);
    } catch (error) {
      notifications.show({
        title: "No se pudo abrir la jugada",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <AppShell title="Nueva jugada" subtitle="Selecciona campo y modalidad.">
        <Card>
          <form className="gml-form" onSubmit={handleSubmit}>
            <Select
              label="Campo"
              placeholder="Selecciona un campo"
              data={courseOptions}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              searchable
            />
            <Select
              label="Ronda"
              placeholder="9 o 18 hoyos"
              data={[
                { value: "9", label: "9 hoyos" },
                { value: "18", label: "18 hoyos" },
              ]}
              value={holes}
              onChange={setHoles}
            />
            {holes === "9" ? (
              <Select
                label="Vuelta"
                placeholder="Front 9 o Back 9"
                data={[
                  { value: "front", label: "Front 9" },
                  { value: "back", label: "Back 9" },
                ]}
                value={nineType}
                onChange={setNineType}
              />
            ) : null}
            <MultiSelect
              label="Jugadores"
              placeholder="Selecciona jugadores"
              data={playerOptions}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
              searchable
              clearable
            />
            <Textarea
              label="Descripcion (opcional)"
              placeholder=""
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="space-between" mt="md">
              <Button color="club" type="submit" loading={loading}>
                Abrir jugada
              </Button>
            </Group>
          </form>
        </Card>
      </AppShell>
    </main>
  );
}
