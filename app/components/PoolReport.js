"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Accordion, Button, Card, Group, NumberInput, Table, Text } from "@mantine/core";

const money = (cents) => (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const day = (date) => new Date(date).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
const summaryColumns = [
  ["roundsCount", "Jugadas"], ["feeCents", "Cuotas"], ["prizeCents", "Premios"],
  ["netCents", "Neto nuevo"], ["oldNetCents", "Neto histórico"], ["differenceCents", "Diferencia"],
];

function ScrollTable({ children, label }) {
  return <div className="gml-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <Table striped style={{ whiteSpace: "nowrap" }}>{children}</Table>
  </div>;
}

export default function PoolReport({ startDate, endDate }) {
  const [fee, setFee] = useState(250);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "name", direction: 1 });
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);

  const load = async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate, fee: String(fee) });
      const response = await fetch(`/api/reports/pool?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo calcular la simulación.");
      if (requestId.current === current) setReport(data);
    } catch (error) {
      if (requestId.current === current) setError(error.message);
    } finally {
      if (requestId.current === current) setLoading(false);
    }
  };
  const updateSort = (key) => setSort((previous) => ({ key, direction: previous.key === key ? -previous.direction : 1 }));
  const rows = [...(report?.rows || [])].sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name) : a[sort.key] - b[sort.key]) * sort.direction);
  const heading = (key, label, sticky = false) => <Table.Th className={sticky ? "gml-sticky-col" : undefined} aria-sort={sort.key === key ? (sort.direction === 1 ? "ascending" : "descending") : "none"}>
    <Button variant="subtle" size="compact-sm" onClick={() => updateSort(key)}>{label}{sort.key === key ? (sort.direction === 1 ? " ↑" : " ↓") : ""}</Button>
  </Table.Th>;

  return <>
    <Card mb="lg">
      <Text fw={700}>Simulación de bolsa · 18 hoyos</Text>
      <Text size="sm" c="dusk.6" mb="md">Cada Oh yes, cada Medal y Match valen una participación. Se usa el HC completo guardado. Los resultados son hipotéticos y no cambian pagos ni envían mensajes.</Text>
      <Group align="end">
        <NumberInput label="Cuota por jugador de 18 hoyos" prefix="$" value={fee} onChange={setFee} min={0.01} max={1000000} decimalScale={2} />
        <Button onClick={load} loading={loading}>Simular rango seleccionado</Button>
      </Group>
      {error && <Text c="red" role="alert" mt="sm">{error}</Text>}
    </Card>
    {report && <>
      <Card mb="lg">
        <Text fw={700}>{report.rounds.length} jugadas incluidas · {report.excluded.length} excluidas</Text>
        <Text size="sm" mb="md">Del {report.range.start} al {report.range.end} · Cuota de 18 hoyos: {money(report.feeCents)}; una sola vuelta: $150.00. Neto nuevo = premio − cuota. El histórico incluye todos los conceptos y apuestas individuales registrados.</Text>
        {report.rows.length === 0 ? <Text>No hay jugadas aptas para simular en este rango.</Text> : <ScrollTable label="Comparación acumulada de apuestas">
          <Table.Thead><Table.Tr>{heading("name", "Jugador", true)}{summaryColumns.map(([key, label]) => <Table.Th key={key} aria-sort={sort.key === key ? (sort.direction === 1 ? "ascending" : "descending") : "none"}><Button variant="subtle" size="compact-sm" onClick={() => updateSort(key)}>{label}{sort.key === key ? (sort.direction === 1 ? " ↑" : " ↓") : ""}</Button></Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>{rows.map((row) => <Table.Tr key={row.playerId}><Table.Td className="gml-sticky-col">{row.name}</Table.Td>{summaryColumns.map(([key]) => <Table.Td key={key} c={row[key] < 0 ? "clay" : undefined}>{key === "roundsCount" ? row[key] : money(row[key])}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
        </ScrollTable>}
      </Card>
      <Accordion multiple variant="separated">
        {report.rounds.map((round) => {
          const name = (playerId) => round.rows.find((row) => row.playerId === playerId)?.name || "Jugador";
          const won = (key, playerId) => {
            const award = round.awards.find((award) => award.key === key);
            return award?.winners.includes(playerId) ? (award.winners.length > 1 ? `1/${award.winners.length}` : "1") : "—";
          };
          return <Accordion.Item key={round.id} value={round.id}>
            <Accordion.Control>{day(round.date)} · {round.course} · Bolsa {money(round.poolCents)} · {round.shares} participaciones</Accordion.Control>
            <Accordion.Panel>
              <Link href={`/rounds/${round.id}`}>Ver jugada original</Link>
              <ScrollTable label={`Simulación de ${day(round.date)}`}>
                <Table.Thead><Table.Tr>{["Jugador / salida / HC", "Oh yes", "Medal 1", "Medal 2", "Match", "Neto v1", "Neto v2", "Premio", "Cuota", "Neto nuevo", "Histórico", "Diferencia"].map((label, i) => <Table.Th key={label} className={i === 0 ? "gml-sticky-col" : undefined}>{label}</Table.Th>)}</Table.Tr></Table.Thead>
                <Table.Tbody>{round.rows.map((row) => <Table.Tr key={row.playerId}>
                  <Table.Td className="gml-sticky-col">{row.name}<Text size="xs">{row.teeName} · HC campo {row.courseHandicap}</Text></Table.Td>
                  <Table.Td>{row.ohYes}</Table.Td>{["front", "back", "match"].map((key) => <Table.Td key={key}>{won(key, row.playerId)}</Table.Td>)}
                  <Table.Td>{row.frontNet ?? "—"}</Table.Td><Table.Td>{row.backNet ?? "—"}</Table.Td>
                  {["prizeCents", "feeCents", "netCents", "oldNetCents", "differenceCents"].map((key) => <Table.Td key={key} c={row[key] < 0 ? "clay" : undefined}>{money(row[key])}</Table.Td>)}
                </Table.Tr>)}</Table.Tbody>
              </ScrollTable>
              <Text size="xs" mt="sm">Cada premio equivale a una participación; los empates persistentes la comparten. El redondeo distribuye todos los centavos de la bolsa.</Text>
              {round.awards.map((award) => <div key={award.key} style={{ marginTop: 12 }}>
                <Text size="sm" fw={600}>{award.label}: {award.winners.map(name).join(" / ")}{award.total != null ? ` · ${award.total} golpes netos` : ""}</Text>
                {award.steps.length > 0 && <>
                  <Text size="sm">Empate inicial: {award.initialTied.map(name).join(", ")}</Text>
                  {award.steps.map((step) => <Text size="sm" c="dusk.6" key={step.hole}>Ventaja {step.advantage}, hoyo {step.hole}: {step.scores.map((score) => `${name(score.playerId)} ${score.net} netos`).join(" · ")}</Text>)}
                  {award.winners.length > 1 && <Text size="sm">Persiste el empate: se comparte la participación.</Text>}
                </>}
              </div>)}
            </Accordion.Panel>
          </Accordion.Item>;
        })}
      </Accordion>
      {report.excluded.length > 0 && <Card mt="lg"><Text fw={700} mb="sm">Jugadas excluidas · requieren revisión</Text>
        {report.excluded.map((round) => <div key={round.id} style={{ marginBottom: 16 }}><Link href={`/rounds/${round.id}`}>{day(round.date)} · {round.course}</Link>{round.reasons.map((reason) => <Text key={reason} size="sm">{reason}</Text>)}</div>)}
      </Card>}
    </>}
  </>;
}
