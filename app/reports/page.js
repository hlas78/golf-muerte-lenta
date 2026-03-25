"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Group, Select, Table, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../components/AppShell";

const pad2 = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) => {
  if (!date) {
    return "";
  }
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) {
    return "";
  }
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(
    next.getDate()
  )}`;
};

const getDefaultRange = () => {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(today),
  };
};

export default function ReportsPage() {
  const router = useRouter();
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("payments");
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.role !== "admin") {
          router.replace("/");
          return;
        }
        setIsAdmin(true);
      })
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const loadReport = async () => {
    if (!startDate || !endDate) {
      notifications.show({
        title: "Fechas incompletas",
        message: "Selecciona fecha inicial y final.",
        color: "clay",
      });
      return;
    }
    setLoadingReport(true);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });
      const res = await fetch(`/api/reports/payments?${params.toString()}`);
      if (!res.ok) {
        throw new Error("failed");
      }
      const data = await res.json();
      setReport(data);
    } catch (error) {
      notifications.show({
        title: "No se pudo cargar",
        message: "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadReport();
    }
  }, [isAdmin]);

  const columns = report?.columns || [];
  const rows = report?.rows || [];
  const sortedRows = useMemo(() => {
    const next = [...rows];
    const direction = sortDir === "desc" ? -1 : 1;
    next.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name) * direction;
      }
      if (sortKey === "roundsCount") {
        return ((a.roundsCount ?? 0) - (b.roundsCount ?? 0)) * direction;
      }
      if (sortKey === "total") {
        return (a.total - b.total) * direction;
      }
      const aValue = a.values?.[sortKey] ?? 0;
      const bValue = b.values?.[sortKey] ?? 0;
      return (aValue - bValue) * direction;
    });
    return next;
  }, [rows, sortDir, sortKey]);

  const updateSort = (key) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <main>
      <AppShell
        title="Reportes"
        subtitle="Resumenes por rango de fechas."
        showAdminNav
      >
        <Card mb="lg">
          <Group align="end" gap="md">
            <TextInput
              label="Fecha inicial"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <TextInput
              label="Fecha final"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            <Select
              label="Reporte"
              value={reportType}
              onChange={(value) => setReportType(value || "payments")}
              data={[{ value: "payments", label: "Pagos" }]}
            />
            <Button onClick={loadReport} loading={loadingReport}>
              Cargar
            </Button>
          </Group>
        </Card>

        <Card>
          {loading ? (
            <Text>Cargando...</Text>
          ) : reportType !== "payments" ? (
            <Text size="sm" c="dusk.6">
              Reporte no disponible.
            </Text>
          ) : columns.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay pagos en este rango.
            </Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    style={{ cursor: "pointer" }}
                    onClick={() => updateSort("name")}
                  >
                    Jugador
                  </Table.Th>
                  {columns.map((column) => (
                    <Table.Th
                      key={column.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => updateSort(column.id)}
                    >
                      {column.label}
                    </Table.Th>
                  ))}
                  <Table.Th
                    style={{ cursor: "pointer" }}
                    onClick={() => updateSort("roundsCount")}
                  >
                    # Jugadas
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: "pointer" }}
                    onClick={() => updateSort("total")}
                  >
                    Total
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedRows.map((row) => (
                  <Table.Tr key={row.playerId}>
                    <Table.Td>{row.name}</Table.Td>
                    {columns.map((column) => {
                      const value = row.values?.[column.id] ?? 0;
                      const formatted =
                        value === 0
                          ? "-"
                          : `${value > 0 ? "+" : "-"}$${Math.abs(value)}`;
                      return (
                        <Table.Td
                          key={column.id}
                          c={value < 0 ? "clay" : undefined}
                        >
                          {formatted}
                        </Table.Td>
                      );
                    })}
                    <Table.Td>{row.roundsCount ?? 0}</Table.Td>
                    <Table.Td>
                      <Text c={row.total < 0 ? "clay" : undefined}>
                        {row.total === 0
                          ? "-"
                          : `${row.total > 0 ? "+" : "-"}$${Math.abs(row.total)}`}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </AppShell>
    </main>
  );
}
