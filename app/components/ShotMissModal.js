"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

const HOLES = Array.from({ length: 18 }, (_, idx) => idx + 1);
const CLUBS = [
  "Driver",
  "M3",
  "H4",
  "H5",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "PW",
  "AW",
  "SW",
  "Putt",
];
const DISTANCES = ["Corto", "Largo"];
const DIRECTIONS = ["Izquierda", "Derecha", "Chang"];
const HEIGHTS = ["Gorda", "Toppeada"];

function ToggleButtons({ options, value, onChange }) {
  return (
    <Group gap="xs">
      {options.map((option) => {
        const selected = value === option;
        return (
          <Button
            key={option}
            size="xs"
            variant={selected ? "filled" : "light"}
            color={selected ? "club" : "dusk"}
            onClick={() => onChange(selected ? "" : option)}
          >
            {option}
          </Button>
        );
      })}
    </Group>
  );
}

function getCurrentPosition() {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          capturedAt: new Date(position.timestamp).toISOString(),
        }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

const buildInitialState = (initialHole) => ({
  hole: Number(initialHole) || 1,
  club: "",
  distance: "",
  direction: "",
  height: "",
  notes: "",
});

export default function ShotMissModal({
  opened,
  onClose,
  roundId,
  player,
  initialHole,
  onSaved,
}) {
  const [form, setForm] = useState(buildInitialState(initialHole));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setForm(buildInitialState(initialHole));
  }, [opened, initialHole]);

  const title = useMemo(() => {
    const playerName = player?.name || "mis tiros";
    return `Registrar falla · ${playerName}`;
  }, [player]);

  const updateForm = (patch) =>
    setForm((current) => ({
      ...current,
      ...patch,
    }));

  const handleSave = async () => {
    if (!roundId) {
      return;
    }
    if (!form.club) {
      notifications.show({
        title: "Bastón requerido",
        message: "Selecciona el bastón.",
        color: "clay",
      });
      return;
    }
    setSaving(true);
    try {
      const gps = await getCurrentPosition();
      const res = await fetch(`/api/rounds/${roundId}/shot-misses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hole: form.hole,
          club: form.club,
          distance: form.distance,
          direction: form.direction,
          height: form.height,
          notes: form.notes,
          gps,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar.");
      }
      if (!gps) {
        notifications.show({
          title: "Falla guardada",
          message: "Se guardó sin GPS porque no estuvo disponible.",
          color: "dusk",
        });
      } else {
        notifications.show({
          title: "Falla guardada",
          message: "Registro almacenado correctamente.",
          color: "club",
        });
      }
      onSaved?.(data.shotMiss);
      onClose();
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size="lg"
    >
      <Stack gap="sm">
        <div>
          <Text size="sm" fw={600} mb={6}>
            Hoyo
          </Text>
          <ToggleButtons
            options={HOLES}
            value={form.hole}
            onChange={(value) => updateForm({ hole: Number(value) || 1 })}
          />
        </div>

        <div>
          <Text size="sm" fw={600} mb={6}>
            Bastón
          </Text>
          <ToggleButtons
            options={CLUBS}
            value={form.club}
            onChange={(value) => updateForm({ club: value })}
          />
        </div>

        <div>
          <Text size="sm" fw={600} mb={6}>
            Distancia
          </Text>
          <ToggleButtons
            options={DISTANCES}
            value={form.distance}
            onChange={(value) => updateForm({ distance: value })}
          />
        </div>

        <div>
          <Text size="sm" fw={600} mb={6}>
            Dirección
          </Text>
          <ToggleButtons
            options={DIRECTIONS}
            value={form.direction}
            onChange={(value) => updateForm({ direction: value })}
          />
        </div>

        <div>
          <Text size="sm" fw={600} mb={6}>
            Altura
          </Text>
          <ToggleButtons
            options={HEIGHTS}
            value={form.height}
            onChange={(value) => updateForm({ height: value })}
          />
        </div>

        <div>
          <Text size="sm" fw={600} mb={6}>
            Notas
          </Text>
          <Textarea
            minRows={3}
            placeholder="Captura notas libres"
            value={form.notes}
            onChange={(event) => updateForm({ notes: event.currentTarget.value })}
          />
        </div>

        <Group justify="flex-end">
          <Button variant="light" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Guardar y cerrar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
