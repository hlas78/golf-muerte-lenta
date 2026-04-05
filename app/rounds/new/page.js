"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  Accordion,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import AppShell from "../../components/AppShell";
import { getCourseHandicapForRound } from "@/lib/scoring";

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalDateTimeValue = (date) => {
  if (!date) {
    return "";
  }
  const next = new Date(date);
  if (Number.isNaN(next.getTime())) {
    return "";
  }
  return [
    `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`,
    `${pad2(next.getHours())}:${pad2(next.getMinutes())}`,
  ].join("T");
};

const getNextWeekdayDate = (weekday) => {
  const today = new Date();
  const current = today.getDay();
  let daysAhead = (weekday - current + 7) % 7;
  if (daysAhead === 0) {
    daysAhead = 7;
  }
  const next = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysAhead,
    7,
    0,
    0,
    0
  );
  return next;
};

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
  const [playerTees, setPlayerTees] = useState({});
  const [playerGroups, setPlayerGroups] = useState({});
  const [groupMarshals, setGroupMarshals] = useState({});
  const [description, setDescription] = useState("");
  const [bets, setBets] = useState({ culebra: 0 });
  const [startedAt, setStartedAt] = useState(() =>
    toLocalDateTimeValue(new Date())
  );
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [editingTeeByPlayer, setEditingTeeByPlayer] = useState({});
  const [individualBets, setIndividualBets] = useState([]);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betDraft, setBetDraft] = useState(null);
  const [culebraEnabled, setCulebraEnabled] = useState(false);
  const [culebraPlayers, setCulebraPlayers] = useState([]);
  const [culebraAmount, setCulebraAmount] = useState(0);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollData, setPollData] = useState(null);

  const userById = useMemo(() => {
    const map = {};
    users.forEach((user) => {
      map[String(user._id)] = user;
    });
    return map;
  }, [users]);

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
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data?.bets) {
          setBets((prev) => ({ ...prev, ...data.bets }));
          if (Number.isFinite(data.bets.culebra)) {
            setCulebraAmount(data.bets.culebra);
          }
        }
      })
      .catch(() => {
        setBets((prev) => ({ ...prev }));
      });
  }, []);

  useEffect(() => {
    fetch("/api/users?status=active")
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const applyPollOptionDate = (optionName) => {
    const normalized = String(optionName || "").toLowerCase();
    if (normalized.includes("sabado") || normalized.includes("sábado")) {
      setStartedAt(toLocalDateTimeValue(getNextWeekdayDate(6)));
      return;
    }
    if (normalized.includes("domingo")) {
      setStartedAt(toLocalDateTimeValue(getNextWeekdayDate(0)));
    }
  };


  const courseOptions = courses.map((course) => ({
    value: String(course.courseId),
    label: `${course.clubName} - ${course.courseName}`,
  }));

  const playerOptions = users.map((user) => ({
    value: user._id,
    label: `${user.name} · HC ${user.handicap ?? 0}`,
    name: user.name,
    handicap: user.handicap ?? 0,
    defaultTeeName: user.defaultTeeName || "",
  }));

  const pollOptions = useMemo(
    () => (Array.isArray(pollData?.options) ? pollData.options : []),
    [pollData]
  );

  const selectedCourse = courses.find(
    (course) => String(course.courseId) === String(selectedCourseId)
  );
  const courseTees = selectedCourse?.tees || {};
  const allTees = [
    ...(courseTees.male || []),
    ...(courseTees.female || []),
  ];
  const teeOptions = allTees.map((tee) => ({
    value: tee.tee_name,
    label: tee.tee_name,
  }));
  const defaultTeeName =
    allTees.find((option) => option.tee_name === "BLANCAS")?.tee_name ||
    allTees[0]?.tee_name ||
    "";

  const roundMeta = {
    holes: Number(holes) || 18,
    nineType: holes === "9" ? nineType : "front",
  };

  const selectedPlayerRows = useMemo(() => {
    if (selectedPlayers.length === 0) {
      return [];
    }
    return selectedPlayers
      .map((playerId) => {
        const player = playerOptions.find(
          (option) => option.value === playerId
        );
        if (!player) {
          return null;
        }
        const preferred = String(player.defaultTeeName || "").toUpperCase();
        const preferredValid =
          preferred && allTees.find((option) => option.tee_name === preferred);
        const teeName =
          playerTees[playerId] || preferredValid?.tee_name || defaultTeeName;
        const tee = allTees.find((option) => option.tee_name === teeName);
        const courseHandicap = getCourseHandicapForRound(
          tee,
          roundMeta,
          player.handicap
        );
        const group = playerGroups[playerId];
        const groupNumberRaw =
          typeof group === "string" ? group.replace(/^G/i, "") : group;
        const groupNumber = groupNumberRaw ? Number(groupNumberRaw) : null;
        const groupIndex = Number.isFinite(groupNumber)
          ? (groupNumber - 1) % 4
          : null;
        const groupColors = [
          "rgba(25, 113, 194, 0.14)",
          "rgba(46, 139, 87, 0.16)",
          "rgba(240, 140, 0, 0.18)",
          "rgba(153, 102, 255, 0.16)",
        ];
        const groupShade =
          groupIndex != null ? groupColors[groupIndex] : null;
        return {
          id: playerId,
          name: player.name,
          group: Number.isFinite(groupNumber) ? groupNumber : null,
          groupLabel: Number.isFinite(groupNumber)
            ? `G${groupNumber}`
            : "-",
          teeName: teeName || "-",
          courseHandicap,
          groupShade,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const groupA = a.group ? Number(a.group) : 99;
        const groupB = b.group ? Number(b.group) : 99;
        if (groupA !== groupB) {
          return groupA - groupB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [
    selectedPlayers,
    playerOptions,
    playerTees,
    defaultTeeName,
    allTees,
    roundMeta,
    playerGroups,
  ]);

  const togglePlayer = (playerId) => {
    setSelectedPlayers((prev) => {
      const exists = prev.includes(playerId);
      const next = exists
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId];
      setPlayerTees((prevTees) => {
        const nextTees = { ...prevTees };
        if (!exists) {
          if (!nextTees[playerId]) {
            const player = playerOptions.find(
              (option) => option.value === playerId
            );
            const preferred = String(player?.defaultTeeName || "").toUpperCase();
            const preferredValid =
              preferred &&
              allTees.find((option) => option.tee_name === preferred);
            nextTees[playerId] =
              preferredValid?.tee_name || defaultTeeName;
          }
        } else {
          delete nextTees[playerId];
        }
        return nextTees;
      });
      setPlayerGroups((prevGroups) => {
        const nextGroups = { ...prevGroups };
        if (exists) {
          delete nextGroups[playerId];
        }
        return nextGroups;
      });
      setGroupMarshals((prevMarshals) => {
        const nextMarshals = { ...prevMarshals };
        Object.keys(nextMarshals).forEach((groupKey) => {
          if (nextMarshals[groupKey] === playerId) {
            delete nextMarshals[groupKey];
          }
        });
        return nextMarshals;
      });
      return next;
    });
  };

  const setPlayerGroup = (playerId, group) => {
    setSelectedPlayers((prev) => {
      if (!prev.includes(playerId)) {
        return [...prev, playerId];
      }
      return prev;
    });
    setPlayerGroups((prevGroups) => {
      const currentRaw = prevGroups[playerId];
      const current = Number.isFinite(
        Number(String(currentRaw || "").replace(/^G/i, ""))
      )
        ? Number(String(currentRaw || "").replace(/^G/i, ""))
        : currentRaw;
      const nextGroups = { ...prevGroups };
      if (current === group) {
        delete nextGroups[playerId];
        setGroupMarshals((prevMarshals) => {
          const nextMarshals = { ...prevMarshals };
          if (nextMarshals[group] === playerId) {
            delete nextMarshals[group];
          }
          return nextMarshals;
        });
        setSelectedPlayers((prev) => prev.filter((id) => id !== playerId));
      } else {
        nextGroups[playerId] = group;
      }
      return nextGroups;
    });
  };

  const toggleMarshal = (playerId) => {
    const groupRaw = playerGroups[playerId];
    const group = Number.isFinite(
      Number(String(groupRaw || "").replace(/^G/i, ""))
    )
      ? Number(String(groupRaw || "").replace(/^G/i, ""))
      : null;
    if (!group) {
      return;
    }
    setGroupMarshals((prevMarshals) => {
      const nextMarshals = { ...prevMarshals };
      if (nextMarshals[group] === playerId) {
        delete nextMarshals[group];
      } else {
        nextMarshals[group] = playerId;
      }
      return nextMarshals;
    });
  };

  const updatePlayerTee = (playerId, teeName) => {
    setPlayerTees((prev) => ({ ...prev, [playerId]: teeName }));
  };

  const setEditingTee = (playerId, isEditing) => {
    setEditingTeeByPlayer((prev) => ({ ...prev, [playerId]: isEditing }));
  };

  const createEmptyBet = () => ({
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerA: "",
    playerB: "",
    accumulateOnTie: false,
      amounts: {
        front: 0,
        back: 0,
        round: 0,
        hole: 0,
        birdie: 0,
        sandy: 0,
        wet: 0,
        ohYes: 0,
      },
  });

  const playerSelectionOptions = playerOptions.filter((player) =>
    selectedPlayers.includes(player.value)
  );

  useEffect(() => {
    setIndividualBets((prev) =>
      prev.filter(
        (bet) =>
          selectedPlayers.includes(bet.playerA) &&
          selectedPlayers.includes(bet.playerB)
      )
    );
  }, [selectedPlayers]);

  useEffect(() => {
    setCulebraPlayers((prev) =>
      prev.filter((playerId) => selectedPlayers.includes(playerId))
    );
  }, [selectedPlayers]);

  const loadPoll = async () => {
    setPollLoading(true);
    try {
      const res = await fetch("/api/poll");
      if (!res.ok) {
        throw new Error("No se pudo cargar la encuesta.");
      }
      const data = await res.json();
      setPollData(data);
    } catch (error) {
      notifications.show({
        title: "No se pudo cargar",
        message: error.message || "Intenta mas tarde.",
        color: "clay",
      });
    } finally {
      setPollLoading(false);
    }
  };

  const openPoll = () => {
    setPollOpen(true);
    loadPoll();
  };

  const autoAssignGroups = (incomingIds) => {
    const existingIds = Array.isArray(selectedPlayers) ? selectedPlayers : [];
    const allIds = Array.from(new Set([...existingIds, ...incomingIds]));
    if (allIds.length === 0) {
      return;
    }

    const getUser = (id) => userById[String(id)];
    const getName = (id) => getUser(id)?.name || "Jugador";
    const getHandicap = (id) => Number(getUser(id)?.handicap || 0);
    const hasCart = (id) => Boolean(getUser(id)?.hasCart);
    const getFamily = (id) =>
      (Array.isArray(getUser(id)?.family) ? getUser(id).family : []).map(
        (entry) => String(entry)
      );
    const getEnemies = (id) =>
      (Array.isArray(getUser(id)?.enemies) ? getUser(id).enemies : []).map(
        (entry) => String(entry)
      );

    const allIdSet = new Set(allIds.map((id) => String(id)));
    const existingGroups = Object.entries(playerGroups).reduce(
      (acc, [playerId, value]) => {
        const normalized = Number(String(value || "").replace(/^G/i, ""));
        acc[playerId] = Number.isFinite(normalized) ? normalized : value;
        return acc;
      },
      {}
    );
    const existingGroupNumbers = Object.values(existingGroups)
      .map((value) => Number(String(value || "").replace(/^G/i, "")))
      .filter((value) => Number.isFinite(value));
    const existingGroupCount =
      existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) : 0;

    const totalPlayers = allIds.length;
    const minGroups = Math.ceil(totalPlayers / 5);
    const maxGroups = Math.floor(totalPlayers / 4);
    let groupCount = Math.max(existingGroupCount, minGroups);
    if (maxGroups >= 1) {
      groupCount = Math.min(groupCount, maxGroups);
    }
    if (groupCount < minGroups) {
      groupCount = minGroups;
    }
    const issues = [];

    const minSize = Math.floor(totalPlayers / groupCount);
    const maxSize = Math.ceil(totalPlayers / groupCount);
    if (maxGroups < minGroups) {
      issues.push(
        `Condición 1: No es posible formar grupos de 4 o 5 con ${totalPlayers} jugadores.`
      );
    }
    if (groupCount > 4) {
      issues.push(
        `Condición 1: Se requieren ${groupCount} grupos, pero solo existen 4.`
      );
      groupCount = 4;
    }
    if (groupCount < 1) {
      groupCount = 1;
    }

    const groups = Array.from({ length: groupCount }, (_, idx) => ({
      id: `G${idx + 1}`,
      members: [],
      handicap: 0,
      carts: 0,
    }));

    const addToGroup = (group, playerId) => {
      group.members.push(playerId);
      group.handicap += getHandicap(playerId);
      group.carts += hasCart(playerId) ? 1 : 0;
    };

    allIds.forEach((playerId) => {
      const groupId = existingGroups[String(playerId)];
      if (!groupId) {
        return;
      }
      const idx = Number(String(groupId).replace(/^G/i, "")) - 1;
      if (idx >= 0 && idx < groups.length) {
        addToGroup(groups[idx], String(playerId));
      }
    });

    const parent = {};
    const find = (x) => {
      parent[x] = parent[x] || x;
      if (parent[x] === x) return x;
      parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };
    allIds.forEach((playerId) => {
      const id = String(playerId);
      getFamily(id).forEach((relative) => {
        if (allIdSet.has(relative)) {
          union(id, relative);
        }
      });
    });

    const clustersByRoot = {};
    allIds.forEach((playerId) => {
      const id = String(playerId);
      const root = find(id);
      if (!clustersByRoot[root]) clustersByRoot[root] = [];
      clustersByRoot[root].push(id);
    });
    const clusters = Object.values(clustersByRoot).sort(
      (a, b) => b.length - a.length
    );

    const enemyPairs = [];
    allIds.forEach((playerId) => {
      const id = String(playerId);
      getEnemies(id).forEach((enemyId) => {
        if (allIdSet.has(enemyId)) {
          const pair = [id, enemyId].sort().join("-");
          enemyPairs.push(pair);
        }
      });
    });
    const enemySet = new Set(enemyPairs);
    const hasEnemyConflict = (group, cluster) =>
      cluster.some((id) =>
        group.members.some((member) =>
          enemySet.has([id, member].sort().join("-"))
        )
      );

    clusters.forEach((cluster) => {
      const assignedGroups = new Set(
        cluster
          .map((id) => existingGroups[String(id)])
          .filter(Boolean)
      );
      if (assignedGroups.size > 1) {
        issues.push(
          `Condición 2: Familiares separados: ${cluster
            .map((id) => getName(id))
            .join(", ")}.`
        );
      }
    });

    const avgHandicap = totalPlayers
      ? allIds.reduce((sum, id) => sum + getHandicap(id), 0) / groupCount
      : 0;
    const variance = (totals) => {
      if (totals.length === 0) return 0;
      const avg =
        totals.reduce((sum, value) => sum + value, 0) / totals.length;
      return (
        totals.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
        totals.length
      );
    };
    const scoreAdd = (groupIndex, clusterHandicap) => {
      const totals = groups.map((group, idx) =>
        idx === groupIndex ? group.handicap + clusterHandicap : group.handicap
      );
      const varScore = variance(totals);
      const maxMin = Math.max(...totals) - Math.min(...totals);
      const diffScore = Math.abs(totals[groupIndex] - avgHandicap);
      return maxMin * 0.45 + varScore * 0.35 + diffScore * 0.2;
    };

    const unassignedClusters = clusters
      .filter((cluster) => cluster.some((id) => !existingGroups[String(id)]))
      .map((cluster) => ({
        ids: cluster,
        handicap: cluster.reduce((sum, id) => sum + getHandicap(id), 0),
        carts: cluster.reduce((sum, id) => sum + (hasCart(id) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.handicap - a.handicap);

    unassignedClusters.forEach((cluster) => {
      const clusterSize = cluster.ids.length;
      const clusterHandicap = cluster.handicap;
      const clusterCarts = cluster.carts;
      const preferredGroup = cluster.ids
        .map((id) => existingGroups[String(id)])
        .find(Boolean);

      let candidates = groups
        .map((group, idx) => ({ group, idx }))
        .filter(
          ({ group }) =>
            group.members.length + clusterSize <= maxSize &&
            !hasEnemyConflict(group, cluster.ids)
        );

      if (candidates.length === 0) {
        candidates = groups
          .map((group, idx) => ({ group, idx }))
          .filter(
            ({ group }) =>
              group.members.length + clusterSize <= maxSize
          );
      }

      if (preferredGroup) {
        const preferredIndex =
          Number(String(preferredGroup).replace(/^G/i, "")) - 1;
        const preferred = candidates.find(
          ({ idx }) => idx === preferredIndex
        );
        if (preferred) {
          cluster.ids.forEach((id) => addToGroup(preferred.group, id));
          cluster.ids.forEach((id) => {
            if (!existingGroups[String(id)]) {
              existingGroups[String(id)] = Number(
                String(preferred.group.id).replace(/^G/i, "")
              );
            }
          });
          return;
        }
      }

      if (candidates.length === 0) {
        return;
      }

      candidates.sort((a, b) => {
        const scoreA =
          scoreAdd(a.idx, clusterHandicap) +
          (a.group.carts < 2 && clusterCarts === 0 ? 100 : 0);
        const scoreB =
          scoreAdd(b.idx, clusterHandicap) +
          (b.group.carts < 2 && clusterCarts === 0 ? 100 : 0);
        return scoreA - scoreB;
      });
      const targetIndex = candidates[0].idx;

      const target = groups[targetIndex];
      cluster.ids.forEach((id) => addToGroup(target, id));
      cluster.ids.forEach((id) => {
        if (!existingGroups[String(id)]) {
          existingGroups[String(id)] = Number(
            String(target.id).replace(/^G/i, "")
          );
        }
      });
    });

    groups.forEach((group) => {
      if (group.carts < 2 && group.members.length > 0) {
        issues.push(
          `Condición 5: Grupo ${group.id} con menos de 2 carritos: ${group.members
            .map((id) => getName(id))
            .join(", ")}.`
        );
      }
    });

    const overfilled = groups.filter((group) => group.members.length > maxSize);
    const underfilled = groups.filter((group) => group.members.length < minSize);

    if (overfilled.length > 0 && underfilled.length > 0) {
      const tryMove = (fromGroup, toGroup) => {
        const candidates = [...fromGroup.members].reverse();
        for (const playerId of candidates) {
          const enemyConflict = hasEnemyConflict(toGroup, [playerId]);
          if (enemyConflict) {
            continue;
          }
          fromGroup.members = fromGroup.members.filter((id) => id !== playerId);
          fromGroup.handicap -= getHandicap(playerId);
          fromGroup.carts -= hasCart(playerId) ? 1 : 0;
          addToGroup(toGroup, playerId);
          existingGroups[String(playerId)] = Number(
            String(toGroup.id).replace(/^G/i, "")
          );
          return true;
        }
        return false;
      };

      overfilled.forEach((fromGroup) => {
        while (
          fromGroup.members.length > maxSize &&
          underfilled.some((group) => group.members.length < minSize)
        ) {
          const target = underfilled.find(
            (group) => group.members.length < minSize
          );
          if (!target) {
            break;
          }
          const moved = tryMove(fromGroup, target);
          if (!moved) {
            break;
          }
        }
      });
    }

    const clusterSizeByPlayer = {};
    clusters.forEach((cluster) => {
      cluster.forEach((id) => {
        clusterSizeByPlayer[id] = cluster.length;
      });
    });

    const scoreGroups = () => {
      const totals = groups.map((group) => group.handicap);
      if (totals.length === 0) return 0;
      const avg =
        totals.reduce((sum, value) => sum + value, 0) / totals.length;
      const varScore =
        totals.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
        totals.length;
      const maxMin = Math.max(...totals) - Math.min(...totals);
      return varScore + maxMin * 0.35;
    };

    const hasEnemyConflictWith = (members, playerId) =>
      members.some((member) =>
        enemySet.has([member, playerId].sort().join("-"))
      );

    let swapIterations = 0;
    let improved = true;
    while (improved && swapIterations < 30) {
      swapIterations += 1;
      improved = false;
      const currentScore = scoreGroups();
      let bestDelta = 0;
      let bestSwap = null;

      for (let i = 0; i < groups.length; i += 1) {
        for (let j = i + 1; j < groups.length; j += 1) {
          const groupA = groups[i];
          const groupB = groups[j];
          for (const playerA of groupA.members) {
            if (clusterSizeByPlayer[playerA] > 1) continue;
            for (const playerB of groupB.members) {
              if (clusterSizeByPlayer[playerB] > 1) continue;

              const nextMembersA = groupA.members.filter(
                (id) => id !== playerA
              );
              const nextMembersB = groupB.members.filter(
                (id) => id !== playerB
              );
              if (
                hasEnemyConflictWith(nextMembersA, playerB) ||
                hasEnemyConflictWith(nextMembersB, playerA)
              ) {
                continue;
              }

              const nextTotals = groups.map((group, idx) => {
                if (idx === i) {
                  return (
                    group.handicap -
                    getHandicap(playerA) +
                    getHandicap(playerB)
                  );
                }
                if (idx === j) {
                  return (
                    group.handicap -
                    getHandicap(playerB) +
                    getHandicap(playerA)
                  );
                }
                return group.handicap;
              });
              const avg =
                nextTotals.reduce((sum, value) => sum + value, 0) /
                nextTotals.length;
              const varScore =
                nextTotals.reduce(
                  (sum, value) => sum + (value - avg) ** 2,
                  0
                ) / nextTotals.length;
              const maxMin =
                Math.max(...nextTotals) - Math.min(...nextTotals);
              const nextScore = varScore + maxMin * 0.35;
              const delta = currentScore - nextScore;

              if (delta > bestDelta) {
                bestDelta = delta;
                bestSwap = { i, j, playerA, playerB };
              }
            }
          }
        }
      }

      if (bestSwap) {
        improved = true;
        const groupA = groups[bestSwap.i];
        const groupB = groups[bestSwap.j];
        groupA.members = groupA.members.map((id) =>
          id === bestSwap.playerA ? bestSwap.playerB : id
        );
        groupB.members = groupB.members.map((id) =>
          id === bestSwap.playerB ? bestSwap.playerA : id
        );
        groupA.handicap =
          groupA.handicap -
          getHandicap(bestSwap.playerA) +
          getHandicap(bestSwap.playerB);
        groupB.handicap =
          groupB.handicap -
          getHandicap(bestSwap.playerB) +
          getHandicap(bestSwap.playerA);
        groupA.carts =
          groupA.carts -
          (hasCart(bestSwap.playerA) ? 1 : 0) +
          (hasCart(bestSwap.playerB) ? 1 : 0);
        groupB.carts =
          groupB.carts -
          (hasCart(bestSwap.playerB) ? 1 : 0) +
          (hasCart(bestSwap.playerA) ? 1 : 0);
        existingGroups[String(bestSwap.playerA)] = Number(
          String(groupB.id).replace(/^G/i, "")
        );
        existingGroups[String(bestSwap.playerB)] = Number(
          String(groupA.id).replace(/^G/i, "")
        );
      }
    }

    const groupHandicaps = groups
      .filter((group) => group.members.length > 0)
      .map((group) => group.handicap);
    if (groupHandicaps.length > 1) {
      const maxHandicap = Math.max(...groupHandicaps);
      const minHandicap = Math.min(...groupHandicaps);
      if (maxHandicap - minHandicap > 8) {
        issues.push(
          `Condición 3: Handicap total desbalanceado (max ${maxHandicap} vs min ${minHandicap}).`
        );
      }
    }

    const violatingEnemyPairs = [];
    groups.forEach((group) => {
      group.members.forEach((id) => {
        group.members.forEach((other) => {
          if (id === other) return;
          const key = [id, other].sort().join("-");
          if (enemySet.has(key)) {
            violatingEnemyPairs.push(
              `${getName(id)} / ${getName(other)}`
            );
          }
        });
      });
    });
    if (violatingEnemyPairs.length > 0) {
      issues.push(
        `Condición 4: Enemigos en el mismo grupo: ${Array.from(
          new Set(violatingEnemyPairs)
        ).join(", ")}.`
      );
    }

    setPlayerGroups((prev) => ({ ...prev, ...existingGroups }));

  };

  const addPlayersFromOption = (optionName) => {
    const playersToAdd = [
      ...(pollOptions.find((option) => option.name === optionName)?.players ||
        []),
    ];
    if (playersToAdd.length === 0) {
      return;
    }
    playersToAdd.sort(
      (a, b) => Number(a.handicap || 0) - Number(b.handicap || 0)
    );
    const newIds = playersToAdd.map((player) => String(player._id));
    setSelectedPlayers((prev) => {
      const set = new Set(prev);
      newIds.forEach((id) => set.add(id));
      return Array.from(set);
    });
    autoAssignGroups(newIds);
    applyPollOptionDate(optionName);
    setPollOpen(false);
  };

  const openNewBet = () => {
    setBetDraft(createEmptyBet());
    setBetModalOpen(true);
  };

  const editBet = (bet) => {
    setBetDraft({
      ...bet,
      accumulateOnTie: Boolean(bet.accumulateOnTie),
      amounts: { ...bet.amounts },
    });
    setBetModalOpen(true);
  };

  const removeBet = (betId) => {
    setIndividualBets((prev) => prev.filter((bet) => bet.id !== betId));
  };

  const saveBet = () => {
    if (!betDraft?.playerA || !betDraft?.playerB) {
      notifications.show({
        title: "Faltan jugadores",
        message: "Selecciona ambos jugadores.",
        color: "clay",
      });
      return;
    }
    if (betDraft.playerA === betDraft.playerB) {
      notifications.show({
        title: "Jugadores invalidos",
        message: "Selecciona jugadores distintos.",
        color: "clay",
      });
      return;
    }
    setIndividualBets((prev) => {
      const exists = prev.find((bet) => bet.id === betDraft.id);
      if (exists) {
        return prev.map((bet) => (bet.id === betDraft.id ? betDraft : bet));
      }
      return [...prev, betDraft];
    });
    setBetModalOpen(false);
    setBetDraft(null);
  };

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
    const groupedPlayerIds = Object.keys(playerGroups);
    if (
      selectedPlayers.length > 0 &&
      groupedPlayerIds.length !== selectedPlayers.length
    ) {
      notifications.show({
        title: "Faltan grupos",
        message: "Selecciona el grupo de salida de todos los jugadores.",
        color: "clay",
      });
      return;
    }
    const effectivePlayers =
      groupedPlayerIds.length > 0 ? groupedPlayerIds : selectedPlayers;
    setLoading(true);
    try {
      const me = await fetch("/api/me").then((res) => res.json());
      const startedAtValue =
        startedAt && !Number.isNaN(new Date(startedAt).getTime())
          ? new Date(startedAt).toISOString()
          : null;
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: Number(selectedCourseId),
          holes: Number(holes),
          nineType: holes === "9" ? nineType : "front",
          createdBy: me.user?._id,
          supervisor: me.user?._id,
          players: effectivePlayers,
          playerTees: effectivePlayers.map((playerId) => ({
            player: playerId,
            teeName: playerTees[playerId],
          })),
          playerGroups: effectivePlayers.map((playerId) => ({
            player: playerId,
            group: playerGroups[playerId],
          })),
          groupMarshals: Object.entries(groupMarshals).map(([group, player]) => ({
            group: Number(group),
            player,
          })),
          individualBets,
          culebra: {
            enabled: culebraEnabled,
            players: culebraPlayers,
            amount: Number(culebraAmount) || 0,
          },
          description: description.trim(),
          startedAt: startedAtValue,
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
        <Modal
          opened={playersModalOpen}
          onClose={() => setPlayersModalOpen(false)}
          title="Selecciona jugadores"
          centered
        >
          {!selectedCourseId ? (
            <Text size="sm" c="dusk.6" mb="sm">
              Selecciona un campo para habilitar los tees de salida.
            </Text>
          ) : null}
          <div className="gml-players-compact">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Jugador</Table.Th>
                <Table.Th>HC</Table.Th>
                <Table.Th>Tee</Table.Th>
                <Table.Th>HC Tee</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playerOptions.map((player) => {
                const selected = selectedPlayers.includes(player.value);
                const preferred = String(player.defaultTeeName || "").toUpperCase();
                const preferredValid =
                  preferred &&
                  allTees.find((option) => option.tee_name === preferred);
                const teeName =
                  playerTees[player.value] ||
                  preferredValid?.tee_name ||
                  defaultTeeName;
                const tee = allTees.find((option) => option.tee_name === teeName);
                const courseHandicap = getCourseHandicapForRound(
                  tee,
                  roundMeta,
                  player.handicap
                );
                const isEditing = Boolean(editingTeeByPlayer[player.value]);
                const currentGroupRaw = playerGroups[player.value];
                const currentGroup = Number.isFinite(
                  Number(String(currentGroupRaw || "").replace(/^G/i, ""))
                )
                  ? Number(String(currentGroupRaw || "").replace(/^G/i, ""))
                  : null;
                const isMarshal =
                  currentGroup &&
                  groupMarshals[currentGroup] === player.value;
                return (
                  <Fragment key={player.value}>
                    <Table.Tr>
                      <Table.Td>{player.name}</Table.Td>
                      <Table.Td>{player.handicap}</Table.Td>
                      <Table.Td>
                        {isEditing && selectedCourseId ? (
                          <Select
                            data={teeOptions}
                            value={teeName}
                            onChange={(value) => {
                              updatePlayerTee(player.value, value || "");
                              setEditingTee(player.value, false);
                            }}
                            placeholder="Sin tee"
                            size="xs"
                          />
                        ) : (
                          <Button
                            variant="subtle"
                            size="xs"
                            className="gml-link-text"
                            onClick={() => setEditingTee(player.value, true)}
                            disabled={!selectedCourseId}
                          >
                            {teeName || "Sin tee"}
                          </Button>
                        )}
                      </Table.Td>
                      <Table.Td>{courseHandicap}</Table.Td>
                      <Table.Td />
                    </Table.Tr>
                    <Table.Tr key={`${player.value}-group`}>
                      <Table.Td colSpan={5}>
                        <Group gap="xs">
                          {[1, 2, 3, 4].map((group) => (
                            <Button
                              key={`${player.value}-g${group}`}
                              size="xs"
                              variant={currentGroup === group ? "filled" : "light"}
                              color={currentGroup === group ? "club" : "dusk"}
                              onClick={() => setPlayerGroup(player.value, group)}
                            >
                              G{group}
                            </Button>
                          ))}
                          <Button
                            size="xs"
                            variant={isMarshal ? "filled" : "light"}
                            color={isMarshal ? "orange" : "dusk"}
                            onClick={() => toggleMarshal(player.value)}
                            disabled={!currentGroup}
                          >
                            M
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
          </div>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setPlayersModalOpen(false)}>
              Listo
            </Button>
          </Group>
        </Modal>
        <Modal
          opened={betModalOpen}
          onClose={() => setBetModalOpen(false)}
          title="Raya individual"
          centered
        >
          {selectedPlayers.length < 2 ? (
            <Text size="sm" c="dusk.6">
              Selecciona al menos 2 jugadores para crear una raya individual.
            </Text>
          ) : (
            <>
              <Select
                label="Jugador A"
                data={playerSelectionOptions.map((player) => ({
                  value: player.value,
                  label: player.label,
                }))}
                value={betDraft?.playerA || ""}
                onChange={(value) =>
                  setBetDraft((prev) => ({ ...prev, playerA: value || "" }))
                }
              />
              <Select
                label="Jugador B"
                data={playerSelectionOptions.map((player) => ({
                  value: player.value,
                  label: player.label,
                }))}
                value={betDraft?.playerB || ""}
                onChange={(value) =>
                  setBetDraft((prev) => ({ ...prev, playerB: value || "" }))
                }
              />
              <Group grow mt="md">
                <TextInput
                  label="Vuelta 1"
                  type="number"
                  value={betDraft?.amounts?.front ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        front:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Vuelta 2"
                  type="number"
                  value={betDraft?.amounts?.back ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        back: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Ronda 18"
                  type="number"
                  value={betDraft?.amounts?.round ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        round:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Hoyo ganado"
                  type="number"
                  value={betDraft?.amounts?.hole ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        hole: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
              </Group>
              <Group grow mt="md">
                <TextInput
                  label="Birdie o menor"
                  type="number"
                  value={betDraft?.amounts?.birdie ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        birdie:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Sandy"
                  type="number"
                  value={betDraft?.amounts?.sandy ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        sandy:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Wet"
                  type="number"
                  value={betDraft?.amounts?.wet ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        wet: Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Oh yes"
                  type="number"
                  value={betDraft?.amounts?.ohYes ?? 0}
                  onChange={(event) =>
                    setBetDraft((prev) => ({
                      ...prev,
                      amounts: {
                        ...prev.amounts,
                        ohYes:
                          Number(event?.currentTarget?.value ?? "") || 0,
                      },
                    }))
                  }
                />
              </Group>
              <Switch
                mt="xs"
                label="Acumular en empate / sin ganador (solo por hoyo)"
                checked={Boolean(betDraft?.accumulateOnTie)}
                onChange={(event) =>
                  setBetDraft((prev) => ({
                    ...prev,
                    accumulateOnTie: event.currentTarget.checked,
                  }))
                }
              />
              <Group mt="md">
                <Text size="xs" c="dusk.6">
                  Predefinir montos:
                </Text>
                {[10, 20, 50, 100].map((preset) => (
                  <Button
                    key={preset}
                    size="xs"
                    variant="light"
                    onClick={() =>
                      setBetDraft((prev) => ({
                        ...prev,
                        amounts: {
                          ...prev.amounts,
                          front: preset,
                          back: preset,
                          round: preset,
                          hole: preset,
                          birdie: preset,
                          sandy: preset,
                          wet: preset,
                          ohYes: preset,
                        },
                      }))
                    }
                  >
                    ${preset}
                  </Button>
                ))}
              </Group>
              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={() => setBetModalOpen(false)}>
                  Cancelar
                </Button>
                <Button color="club" onClick={saveBet}>
                  Guardar
                </Button>
              </Group>
            </>
          )}
        </Modal>
        <Modal
          opened={pollOpen}
          onClose={() => setPollOpen(false)}
          title={
            <Text fw={700} size="sm">
              {pollData?.pollName || "Encuesta"}
            </Text>
          }
          centered
        >
          {pollLoading ? (
            <Text size="sm" c="dusk.6">
              Cargando encuesta...
            </Text>
          ) : pollOptions.length === 0 ? (
            <Text size="sm" c="dusk.6">
              No hay opciones disponibles.
            </Text>
          ) : (
            pollOptions.map((option) => {
              const name = option?.name;
              const matched = option?.players || [];
              return (
                <Accordion
                  key={name}
                  variant="contained"
                  radius="md"
                  chevronPosition="right"
                  mb="sm"
                >
                  <Accordion.Item value={`poll-${name}`}>
                    <Accordion.Control>
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <div>
                          <Text fw={600}>{name}</Text>
                          <Text size="xs" c="dusk.6">
                            {matched.length} jugador
                            {matched.length === 1 ? "" : "es"}
                          </Text>
                        </div>
                        <Button
                          component="div"
                          role="button"
                          tabIndex={0}
                          size="xs"
                          variant="light"
                          onClick={(event) => {
                            event.stopPropagation();
                            addPlayersFromOption(name);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              addPlayersFromOption(name);
                            }
                          }}
                          disabled={matched.length === 0}
                        >
                          Agregar
                        </Button>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {matched.length === 0 ? (
                        <Text size="sm" c="dusk.6">
                          No hay jugadores para esta opción.
                        </Text>
                      ) : (
                        <Stack gap={6}>
                          {matched.map((player) => {
                            const votedAt = player.votedAt
                              ? new Date(player.votedAt)
                              : null;
                            const formatted = votedAt
                              ? votedAt.toLocaleString()
                              : "Sin fecha";
                            return (
                              <Text key={player._id} size="sm">
                                {player.name} · {formatted}
                              </Text>
                            );
                          })}
                        </Stack>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              );
            })
          )}
        </Modal>
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
            <div>
              <Text size="sm" fw={600} mb={6}>
                Jugadores
              </Text>
            <Group>
              <Button
                variant="light"
                onClick={() => setPlayersModalOpen(true)}
                disabled={!selectedCourseId}
              >
                {selectedPlayers.length > 0
                  ? `Editar jugadores (${selectedPlayers.length})`
                  : "Seleccionar jugadores"}
              </Button>
              <Button
                variant="light"
                onClick={openPoll}
                disabled={!selectedCourseId}
              >
                Ver encuesta
              </Button>
            </Group>
              {selectedPlayerRows.length > 0 ? (
                <Table
                  mt="xs"
                  striped
                  highlightOnHover
                  className="gml-group-table gml-players-compact"
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Grupo</Table.Th>
                      <Table.Th>Jugador</Table.Th>
                      <Table.Th>Salida</Table.Th>
                      <Table.Th>HC Tee</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedPlayerRows.map((row) => (
                      <Table.Tr
                        key={row.id}
                        data-group={row.group || ""}
                      >
                        <Table.Td>{row.groupLabel}</Table.Td>
                        <Table.Td>{row.name}</Table.Td>
                        <Table.Td>{row.teeName}</Table.Td>
                        <Table.Td>{row.courseHandicap}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : null}
            </div>
            <TextInput
              label="Inicio de la jugada"
              type="datetime-local"
              value={startedAt}
              onChange={(event) => setStartedAt(event.currentTarget.value)}
            />
            <Textarea
              label="Descripcion (opcional)"
              placeholder=""
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <div>
              <Text size="sm" fw={600} mb={6}>
                Apuestas
              </Text>
              <Text size="xs" c="dusk.6" mb="sm">
                Sistema base: Rayas grupales (default)
              </Text>
              <Group justify="space-between" mb="sm">
                <Button
                  variant="light"
                  onClick={openNewBet}
                  disabled={selectedPlayers.length < 2}
                >
                  Agregar raya individual
                </Button>
                <Text size="xs" c="dusk.6">
                  {individualBets.length} configuradas
                </Text>
              </Group>
              {individualBets.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jugadores</Table.Th>
                      <Table.Th>V1</Table.Th>
                      <Table.Th>V2</Table.Th>
                      <Table.Th>R18</Table.Th>
                      <Table.Th>Hoyo</Table.Th>
                      <Table.Th>Birdie+</Table.Th>
                      <Table.Th>Sandy</Table.Th>
                      <Table.Th>Wet</Table.Th>
                      <Table.Th>Oh yes</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {individualBets.map((bet) => {
                      const playerA = playerOptions.find(
                        (option) => option.value === bet.playerA
                      );
                      const playerB = playerOptions.find(
                        (option) => option.value === bet.playerB
                      );
                      return (
                        <Table.Tr key={bet.id}>
                          <Table.Td>
                            {playerA?.name || "Jugador"} vs{" "}
                            {playerB?.name || "Jugador"}
                          </Table.Td>
                          <Table.Td>{bet.amounts.front}</Table.Td>
                          <Table.Td>{bet.amounts.back}</Table.Td>
                          <Table.Td>{bet.amounts.round}</Table.Td>
                          <Table.Td>{bet.amounts.hole}</Table.Td>
                          <Table.Td>{bet.amounts.birdie}</Table.Td>
                          <Table.Td>{bet.amounts.sandy}</Table.Td>
                          <Table.Td>{bet.amounts.wet}</Table.Td>
                          <Table.Td>{bet.amounts.ohYes}</Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => editBet(bet)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                color="clay"
                                onClick={() => removeBet(bet.id)}
                              >
                                Quitar
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="xs" c="dusk.6">
                  No hay rayas individuales configuradas.
                </Text>
              )}
            </div>
            <div>
              <Text size="sm" fw={600} mb={6}>
                Culebra
              </Text>
              <Group align="center" mb="sm">
                <Button
                  variant={culebraEnabled ? "filled" : "light"}
                  color={culebraEnabled ? "club" : "dusk"}
                  onClick={() => setCulebraEnabled((prev) => !prev)}
                  disabled={selectedPlayers.length === 0}
                >
                  {culebraEnabled ? "Activada" : "Activar culebra"}
                </Button>
                <TextInput
                  label="Monto"
                  type="number"
                  value={culebraAmount}
                  onChange={(event) =>
                    setCulebraAmount(
                      Number(event?.currentTarget?.value ?? "") || 0
                    )
                  }
                  size="xs"
                />
                <Button
                  variant="light"
                  size="xs"
                  onClick={() =>
                    setCulebraPlayers((prev) =>
                      prev.length === selectedPlayers.length
                        ? []
                        : [...selectedPlayers]
                    )
                  }
                  disabled={!culebraEnabled}
                >
                  {culebraPlayers.length === selectedPlayers.length
                    ? "Limpiar todos"
                    : "Seleccionar todos"}
                </Button>
              </Group>
              {culebraEnabled ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jugador</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {playerSelectionOptions.map((player) => {
                      const selected = culebraPlayers.includes(player.value);
                      return (
                        <Table.Tr key={`culebra-${player.value}`}>
                          <Table.Td>{player.name}</Table.Td>
                          <Table.Td>
                            <Button
                              size="xs"
                              variant={selected ? "filled" : "light"}
                              color={selected ? "club" : "dusk"}
                              onClick={() =>
                                setCulebraPlayers((prev) =>
                                  prev.includes(player.value)
                                    ? prev.filter((id) => id !== player.value)
                                    : [...prev, player.value]
                                )
                              }
                            >
                              {selected ? "Quitar" : "Agregar"}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="xs" c="dusk.6">
                  Activa la culebra para seleccionar participantes.
                </Text>
              )}
            </div>
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
