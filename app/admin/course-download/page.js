"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Accordion,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";

export default function CourseDownloadPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        const currentRole = data.user?.role || "";
        setRole(currentRole);
        if (currentRole !== "admin") {
          router.replace("/");
          return;
        }
        setCoursesLoading(true);
        fetch("/api/courses")
          .then((res) => res.json())
          .then((list) => setCourses(Array.isArray(list) ? list : []))
          .catch(() => setCourses([]))
          .finally(() => setCoursesLoading(false));
      })
      .catch(() => router.replace("/"));
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!url.trim()) {
      notifications.show({
        title: "URL requerida",
        message: "Ingresa la URL del campo en TheGrint.",
        color: "clay",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo descargar el campo.");
      }
      notifications.show({
        title: "Campo descargado",
        message: `Se guardo el campo ${data.courseId}.`,
        color: "club",
      });
      setUrl("");
    } catch (error) {
      notifications.show({
        title: "No se pudo descargar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCourseTee = async (courseId, gender, teeName) => {
    const course = courses.find((item) => item._id === courseId);
    const tees = course?.tees?.[gender] || [];
    const tee = tees.find((item) => item.tee_name === teeName);
    if (!tee) {
      return;
    }
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender,
          teeName,
          course_rating: tee.course_rating,
          slope_rating: tee.slope_rating,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar.");
      }
      notifications.show({
        title: "Valores actualizados",
        message: "Se guardaron los ajustes del tee.",
        color: "club",
      });
      setCourses((prev) =>
        prev.map((item) => (item._id === courseId ? data.course : item))
      );
    } catch (error) {
      notifications.show({
        title: "No se pudo guardar",
        message: error.message || "Intenta de nuevo.",
        color: "clay",
      });
    }
  };

  const handleRatingChange = (courseId, gender, teeName, field, value) => {
    setCourses((prev) =>
      prev.map((item) => {
        if (item._id !== courseId) {
          return item;
        }
        const tees = item.tees?.[gender] || [];
        const updated = tees.map((tee) =>
          tee.tee_name === teeName ? { ...tee, [field]: value } : tee
        );
        return {
          ...item,
          tees: { ...item.tees, [gender]: updated },
        };
      })
    );
  };

  return (
    <main>
      <AppShell
        title="Descarga campo"
        subtitle="Descarga la informacion de un campo desde TheGrint."
        showAdminNav
        showGreetingAsTitle
      >
        <Card>
          <form className="gml-form" onSubmit={handleSubmit}>
            <TextInput
              label="URL del campo"
              placeholder="https://thegrint.com/course/scorecard/17405/..."
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
              disabled={loading || role !== "admin"}
            />
            <Group justify="flex-end" mt="md">
              <Button type="submit" loading={loading}>
                Descargar
              </Button>
            </Group>
          </form>
        </Card>
        <Card mt="lg">
          <Text fw={700} mb="sm">
            Editar ratings por salida
          </Text>
          {coursesLoading ? (
            <Text size="sm" c="dusk.6">
              Cargando campos...
            </Text>
          ) : courses.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay campos cargados todavía.
            </Text>
          ) : (
            <Accordion multiple>
              {Object.entries(
                courses.reduce((acc, course) => {
                  const key = course.clubName || "Sin club";
                  if (!acc[key]) {
                    acc[key] = [];
                  }
                  acc[key].push(course);
                  return acc;
                }, {})
              ).map(([clubName, clubCourses]) => (
                <Accordion.Item key={clubName} value={clubName}>
                  <Accordion.Control>{clubName}</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      {clubCourses.map((course) => (
                        <Card key={course._id} withBorder>
                          <Text fw={600}>{course.courseName}</Text>
                          <Text size="sm" c="dusk.6" mb="sm">
                            {course.clubName}
                          </Text>
                          {["male", "female"].map((gender) => {
                            const tees = course.tees?.[gender] || [];
                            if (tees.length === 0) {
                              return null;
                            }
                            return (
                              <div key={`${course._id}-${gender}`}>
                                <Text fw={600} size="sm" mb="xs">
                                  {gender === "male" ? "Hombres" : "Damas"}
                                </Text>
                                <Stack gap="sm">
                                  {tees.map((tee) => (
                                    <Card
                                      key={`${course._id}-${gender}-${tee.tee_name}`}
                                      withBorder
                                      padding="sm"
                                    >
                                      <Group justify="space-between" align="flex-end">
                                        <div>
                                          <Text fw={600} size="sm">
                                            {tee.tee_name}
                                          </Text>
                                        </div>
                                        <Group align="flex-end" gap="sm" wrap="nowrap">
                                          <NumberInput
                                            label="Course rating"
                                            value={tee.course_rating ?? ""}
                                            min={0}
                                            precision={1}
                                            step={0.1}
                                            onChange={(value) =>
                                              handleRatingChange(
                                                course._id,
                                                gender,
                                                tee.tee_name,
                                                "course_rating",
                                                value
                                              )
                                            }
                                          />
                                          <NumberInput
                                            label="Slope rating"
                                            value={tee.slope_rating ?? ""}
                                            min={0}
                                            precision={1}
                                            step={0.1}
                                            onChange={(value) =>
                                              handleRatingChange(
                                                course._id,
                                                gender,
                                                tee.tee_name,
                                                "slope_rating",
                                                value
                                              )
                                            }
                                          />
                                          <Button
                                            onClick={() =>
                                              updateCourseTee(
                                                course._id,
                                                gender,
                                                tee.tee_name
                                              )
                                            }
                                          >
                                            Guardar
                                          </Button>
                                        </Group>
                                      </Group>
                                    </Card>
                                  ))}
                                </Stack>
                              </div>
                            );
                          })}
                        </Card>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card>
      </AppShell>
    </main>
  );
}
