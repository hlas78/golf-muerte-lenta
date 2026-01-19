import { Card, Group, Text } from "@mantine/core";

export default function StatCard({ label, value, meta }) {
  return (
    <Card>
      <Text size="xs" tt="uppercase" c="dusk.6" fw={600}>
        {label}
      </Text>
      <Group justify="space-between" mt="xs" align="flex-end">
        <Text size="xl" fw={700}>
          {value}
        </Text>
        {meta ? (
          <Text size="xs" c="dusk.5">
            {meta}
          </Text>
        ) : null}
      </Group>
    </Card>
  );
}
