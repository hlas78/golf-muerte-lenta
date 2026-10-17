import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { simulatePoolRound } from "../lib/poolSimulation.mjs";

const source = await readFile(new URL("../app/api/rounds/[id]/pool/route.js", import.meta.url), "utf8");

async function request({ token = "valid", role = "admin", status = "closed", exists = true } = {}) {
  const calls = [];
  const metadata = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, handicap: i + 1, par: i === 2 ? 3 : 4 }));
  const round = { _id: "r", status, holes: 18, players: ["a", "b"], teeName: "BLANCAS", courseSnapshot: { tees: { male: [{ tee_name: "BLANCAS", holes: metadata }] } } };
  const cards = round.players.map((playerId, i) => ({ player: { _id: playerId, name: playerId }, accepted: true, courseHandicap: 18, holes: metadata.map((hole) => ({ ...hole, strokes: 5 + i, ohYes: false })) }));
  const query = (value) => ({ select() { return this; }, populate() { return this; }, async lean() { return value; } });
  // Only read methods exist on these doubles. Any persistence call fails the test.
  const modules = {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200, headers: options.headers }) } },
    "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    mongoose: { default: { isObjectIdOrHexString: () => true } },
    "@/lib/db": { default: async () => { calls.push("connect"); } },
    "@/lib/auth": { verifyToken: (value) => { if (value !== "valid") throw new Error("Invalid token"); return { id: "user" }; } },
    "@/lib/models/User": { default: { findById: () => { calls.push("user"); return query({ role }); } } },
    "@/lib/models/Round": { default: { findById: () => { calls.push("round"); return query(exists ? round : null); } } },
    "@/lib/models/Scorecard": { default: { find: () => { calls.push("cards"); return query(cards); } } },
    "@/lib/models/Payment": { default: { find: () => { calls.push("payments"); return query([]); } } },
    "@/lib/poolSimulation.mjs": { simulatePoolRound },
  };
  const route = new SourceTextModule(source);
  await route.link((specifier) => {
    assert.ok(modules[specifier], `Unexpected dependency: ${specifier}`);
    const exports = modules[specifier];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await route.evaluate();
  return { response: await route.namespace.GET({}, { params: Promise.resolve({ id: "r" }) }), calls };
}

test("missing and invalid sessions cannot read the simulation", async () => {
  for (const token of [null, "invalid"]) {
    const { response, calls } = await request({ token });
    assert.equal(response.status, 401);
    assert.deepEqual(calls, []);
  }
});

test("players and supervisors cannot read the simulation", async () => {
  for (const role of ["player", "supervisor"]) {
    const { response, calls } = await request({ role });
    assert.equal(response.status, 403);
    assert.deepEqual(calls, ["connect", "user"]);
  }
});

test("open and missing rounds do not load payments or cards", async () => {
  for (const [options, status] of [[{ status: "open" }, 409], [{ exists: false }, 404]]) {
    const { response, calls } = await request(options);
    assert.equal(response.status, status);
    assert.deepEqual(calls, ["connect", "user", "round"]);
  }
});

test("closed round produces an admin-only read-only simulation at $250", async () => {
  const { response, calls } = await request();
  assert.equal(response.status, 200);
  assert.equal(response.data.eligible, true);
  assert.equal(response.data.feeCents, 25000);
  assert.equal(response.data.poolCents, 50000);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(calls, ["connect", "user", "round", "cards", "payments"]);
});
