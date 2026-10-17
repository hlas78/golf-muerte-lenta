import test from "node:test";
import assert from "node:assert/strict";
import { simulatePoolRound, buildPoolReport, duplicateOhYesHoles } from "../lib/poolSimulation.mjs";
import { serializeRoundSave } from "../lib/roundSaveQueue.mjs";

function fixture(count = 3) {
  const metadata = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, handicap: i + 1, par: [2, 6, 11, 14].includes(i) ? 3 : 4 }));
  const round = { _id: "r", status: "closed", holes: 18, players: Array.from({ length: count }, (_, i) => `p${i}`), courseSnapshot: { tees: { male: [{ tee_name: "BLANCAS", holes: metadata }] } }, teeName: "BLANCAS" };
  const scorecards = round.players.map((player, i) => ({ round: "r", player: { _id: player, name: player }, courseHandicap: 0, accepted: true, holes: metadata.map((hole) => ({ hole: hole.hole, par: hole.par, strokes: 4 + i, ohYes: false })) }));
  return { round, scorecards, payments: [], feeCents: 25000 };
}

test("equal awards, accumulated wins, historical payments and exact cents", () => {
  const input = fixture();
  input.scorecards[1].holes[2].ohYes = true;
  input.scorecards[2].holes[6].ohYes = true;
  input.payments = [{ from: "p0", to: "p1", amount: 30, round: "r" }];
  const result = simulatePoolRound(input);
  assert.equal(result.eligible, true);
  assert.equal(result.shares, 5);
  assert.deepEqual(result.rows.map((row) => row.prizeCents), [45000, 15000, 15000]);
  assert.deepEqual(result.rows.map((row) => row.netCents), [20000, -10000, -10000]);
  assert.equal(result.rows[0].differenceCents, 23000);
  assert.equal(result.rows.reduce((sum, row) => sum + row.prizeCents, 0), result.poolCents);
});

test("full stored HC above 28 is used, without a current user index or cap", () => {
  const input = fixture(2);
  input.scorecards[1].courseHandicap = 36;
  const result = simulatePoolRound(input);
  assert.equal(result.rows[1].frontNet, 27);
  assert.equal(result.rows[1].backNet, 27);
  assert.ok(result.awards.every((award) => award.winners[0] === "p1"));
});

test("tie-break uses advantage order, includes handicap, and stays within the medal nine", () => {
  const input = fixture(2);
  const [a, b] = input.scorecards;
  b.courseHandicap = 18;
  // Both players have net 4 per hole, except balanced changes on each nine.
  a.holes[0].strokes = 5; a.holes[1].strokes = 3;
  b.holes[9].strokes = 6; b.holes[10].strokes = 4;
  const result = simulatePoolRound(input);
  assert.deepEqual(result.awards.find((award) => award.key === "front").winners, ["p1"]);
  assert.deepEqual(result.awards.find((award) => award.key === "back").winners, ["p0"]);
  const match = result.awards.find((award) => award.key === "match");
  assert.deepEqual(match.winners, ["p1"]);
  assert.equal(match.steps[0].hole, 1);
  assert.deepEqual(match.steps[0].scores.map((score) => score.net), [5, 4]);
});

test("persistent ties share a single participation and rounding preserves the pool", () => {
  const input = fixture();
  input.scorecards.forEach((card) => card.holes.forEach((hole) => { hole.strokes = 4; }));
  input.scorecards[0].holes[2].ohYes = true;
  input.feeCents = 25001;
  const result = simulatePoolRound(input);
  assert.equal(result.shares, 4);
  assert.deepEqual(result.rows.map((row) => row.shares), [2, 1, 1]);
  assert.equal(result.rows.reduce((sum, row) => sum + row.prizeCents, 0), 75003);
  assert.equal(result.rows.reduce((sum, row) => sum + row.netCents, 0), 0);
  assert.deepEqual(result.rows.map((row) => row.prizeCents), [37501, 18751, 18751]);
});

test("negative HC gives back strokes at the appropriate advantage", () => {
  const input = fixture(2);
  input.scorecards[0].courseHandicap = -1;
  const result = simulatePoolRound(input);
  assert.equal(result.rows[0].frontNet, 36);
  assert.equal(result.rows[0].backNet, 37);
});

test("incomplete, unaccepted, missing HC, incompatible tees and duplicate Oh yes exclude whole round", () => {
  const mutations = [
    (input) => { input.scorecards[0].holes[0].strokes = null; },
    (input) => { delete input.scorecards[0].courseHandicap; },
    (input) => { input.scorecards[0].accepted = false; },
    (input) => { input.scorecards[0].holes[2].ohYes = true; input.scorecards[1].holes[2].ohYes = true; },
    (input) => { input.scorecards[0].holes[0].ohYes = true; },
    (input) => { input.scorecards[0].teeName = "NO EXISTE"; },
    (input) => { input.scorecards[0].holes[0].par = 5; },
    (input) => { input.round.holes = 9; },
    (input) => { input.scorecards.pop(); },
  ];
  for (const mutate of mutations) {
    const input = fixture(); mutate(input);
    const result = simulatePoolRound(input);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.length > 0);
    assert.equal(result.rows, undefined);
  }
});

test("report excludes whole invalid rounds from both sides of the comparison and leaves inputs unchanged", () => {
  const input = fixture();
  const before = JSON.stringify(input);
  const report = buildPoolReport({ rounds: [input.round, { ...input.round, _id: "invalid" }], ...input });
  assert.equal(report.rounds.length, 1);
  assert.equal(report.excluded.length, 1);
  assert.ok(report.rows.every((row) => row.roundsCount === 1));
  assert.equal(JSON.stringify(input), before);
});

test("Oh yes duplicate detection only compares the same hole", () => {
  assert.deepEqual(duplicateOhYesHoles([{ holes: [{ hole: 3, ohYes: true }] }, { holes: [{ hole: 7, ohYes: true }] }]), []);
  assert.deepEqual(duplicateOhYesHoles([{ holes: [{ hole: 3, ohYes: true }] }, { holes: [{ hole: 3, ohYes: true }] }]), [3]);
});

test("one completed nine contributes $150 and only competes for its medal and Oh yes", () => {
  for (const nine of ["front", "back"]) {
    const input = fixture();
    const card = input.scorecards[0];
    card.courseHandicap = 18;
    card.holes.forEach((hole) => {
      if (nine === "front" ? hole.hole > 9 : hole.hole <= 9) hole.strokes = null;
    });
    card.holes[nine === "front" ? 2 : 11].ohYes = true;
    const result = simulatePoolRound(input);
    assert.equal(result.eligible, true);
    assert.equal(result.poolCents, 65000);
    assert.equal(result.rows[0].holesPlayed, 9);
    assert.equal(result.rows[0].feeCents, 15000);
    assert.equal(result.rows[0][nine === "front" ? "frontNet" : "backNet"], 27);
    assert.equal(result.rows[0][nine === "front" ? "backNet" : "frontNet"], null);
    assert.deepEqual(result.awards.find((award) => award.key === nine).winners, ["p0"]);
    assert.equal(result.awards.find((award) => award.key === "match").winners.includes("p0"), false);
    assert.equal(result.rows[0].netCents, 17500);
    assert.equal(result.rows.reduce((sum, row) => sum + row.netCents, 0), 0);
    assert.equal(result.rows.reduce((sum, row) => sum + row.prizeCents, 0), 65000);
  }
});

test("nine-hole fee stays at $150 when the full-round fee changes, including aggregate totals", () => {
  const input = fixture(2);
  input.feeCents = 30000;
  input.scorecards[1].holes = input.scorecards[1].holes.slice(0, 9);
  const report = buildPoolReport({ rounds: [input.round], ...input });
  assert.equal(report.rounds.length, 1);
  assert.equal(report.rounds[0].poolCents, 45000);
  assert.equal(report.rows.find((row) => row.playerId === "p1").feeCents, 15000);
  assert.equal(report.rows.find((row) => row.playerId === "p0").feeCents, 30000);
});

test("empty second nine is allowed, but partial nines and Oh yes in unplayed holes are not", () => {
  const mutations = [
    (card) => { card.holes[9].strokes = 5; },
    (card) => { card.holes[0].strokes = null; },
    (card) => { card.holes[11].ohYes = true; },
    (card) => { card.holes[9].strokes = 0; },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    input.scorecards[0].holes.slice(9).forEach((hole) => { hole.strokes = null; });
    mutate(input.scorecards[0]);
    assert.equal(simulatePoolRound(input).eligible, false);
  }
});

test("no match award when no player completed 18, and no medal for an unplayed nine", () => {
  const input = fixture(2);
  input.scorecards.forEach((card) => { card.holes = card.holes.slice(9); });
  const result = simulatePoolRound(input);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.awards.map((award) => award.key), ["back"]);
  assert.equal(result.poolCents, 30000);
  assert.equal(result.rows.reduce((sum, row) => sum + row.netCents, 0), 0);
});

test("concurrent round saves transfer Oh yes sequentially; failed saves do not block the queue", async () => {
  const state = new Set();
  const save = (player) => serializeRoundSave("r", async () => {
    state.clear();
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.add(player);
  });
  await Promise.all([save("p0"), save("p1"), save("p2")]);
  assert.deepEqual([...state], ["p2"]);
  await assert.rejects(serializeRoundSave("r", async () => { throw new Error("failed"); }));
  await save("p0");
  assert.deepEqual([...state], ["p0"]);
});
