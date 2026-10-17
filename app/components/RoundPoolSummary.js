"use client";

import { useEffect, useState } from "react";
import { Accordion, Button, Card, Group, Table, Text } from "@mantine/core";

const money = (cents) => (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function RoundPoolSummary({ roundId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/rounds/${roundId}/pool`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo calcular la simulación.");
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [roundId, attempt]);

  const name = (playerId) => result?.rows?.find((row) => row.playerId === playerId)?.name || "Jugador";

  return <Card withBorder mt="md">
    <Group justify="space-between" mb="xs">
      <Text fw={700}>Formato no mediocre</Text>
    </Group>
    {error ? <>
      <Text role="alert" c="clay">{error}</Text>
      <Button mt="sm" variant="light" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Reintentar</Button>
    </> : !result ? <Text role="status">Calculando simulación...</Text> : !result.eligible ? <>
      <Text fw={600}>No se puede simular esta jugada</Text>
      {result.reasons.map((reason) => <Text size="sm" key={reason}>{reason}</Text>)}
    </> : <>
      <div style={{ width: "100%", overflowX: "auto" }} role="region" aria-label="Simulación de bolsa de la jugada" tabIndex={0}>
        <Table striped style={{ whiteSpace: "nowrap" }}>
          <Table.Thead><Table.Tr>
            <Table.Th className="gml-sticky-col">Jugador</Table.Th>
            <Table.Th>Pago neto</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>{result.rows.map((row) => <Table.Tr key={row.playerId}>
            <Table.Td className="gml-sticky-col">{row.name}</Table.Td>
            <Table.Td c={row.netCents < 0 ? "clay" : undefined}>{money(row.netCents)}</Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table>
      </div>
      <Accordion mt="md" variant="separated">
        <Accordion.Item value="awards">
          <Accordion.Control>Detalle</Accordion.Control>
          <Accordion.Panel>{result.awards.map((award) => <div key={award.key} style={{ marginBottom: 12 }}>
            <Text size="sm" fw={600}>{award.label}: {award.winners.map(name).join(" / ")}{award.total != null ? ` · ${award.total} golpes netos` : ""}</Text>
            {award.steps.map((step) => <Text size="sm" key={step.hole}>Ventaja {step.advantage}, hoyo {step.hole}: {step.scores.map((score) => `${name(score.playerId)} ${score.net} netos`).join(" · ")}</Text>)}
            {award.winners.length > 1 && <Text size="sm">Empate persistente: se comparte una participación.</Text>}
          </div>)}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>}
  </Card>;
}
