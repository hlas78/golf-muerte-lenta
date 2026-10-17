import test from "node:test";
import assert from "node:assert/strict";
import { buildQuickHoleUpdate } from "../lib/quickHoleEdit.mjs";

const input = (draft = {}, strokes = 4, par = 3) => ({
  entry: { hole: 3, notes: "Conservar nota", bunker: true },
  hole: 3, par, strokes,
  draft: { putts: 2, sandy: false, water: false, ohYes: false, holeOut: false, penalties: [], ...draft },
});

test("quick edit preserves unrelated hole data and includes events and manual penalties", () => {
  const result = buildQuickHoleUpdate(input({ sandy: true, water: true, ohYes: true, penalties: ["pinkies", "paloma", "saltapatras", "whiskeys", "berrinche"] }));
  assert.equal(result.notes, "Conservar nota");
  assert.equal(result.bunker, true);
  assert.equal(result.sandy, true);
  assert.equal(result.water, true);
  assert.equal(result.ohYes, true);
  assert.deepEqual(result.penalties, ["pinkies", "paloma", "saltapatras", "whiskeys", "berrinche"]);
});

test("automatic penalties are added and removed after correcting strokes and putts", () => {
  assert.deepEqual(buildQuickHoleUpdate(input({ putts: 4, penalties: ["paloma"] }, 10)).penalties,
    ["paloma", "cuatriputt", "nerdina"]);
  assert.deepEqual(buildQuickHoleUpdate(input({ putts: 2, penalties: ["paloma", "cuatriputt", "nerdina"] }, 5)).penalties,
    ["paloma"]);
});

test("Oh yes is limited to par 3 and hole out requires zero putts", () => {
  assert.equal(buildQuickHoleUpdate(input({ ohYes: true }, 4, 4)).ohYes, false);
  assert.equal(buildQuickHoleUpdate(input({ holeOut: true, putts: 0 })).holeOut, true);
  assert.equal(buildQuickHoleUpdate(input({ holeOut: true, putts: 1 })).holeOut, false);
  assert.equal(buildQuickHoleUpdate(input({ holeOut: false, putts: 0 }, 3)).holeOut, true);
  assert.equal(buildQuickHoleUpdate(input({ holeOut: false, putts: "" }, 3)).holeOut, false);
});

test("invalid numeric inputs are rejected before any save, and missing putts remain null", () => {
  for (const strokes of ["", 0, -1, 2.5, 31]) assert.throws(() => buildQuickHoleUpdate(input({}, strokes)));
  for (const putts of [-1, 2.5, 4, 5]) assert.throws(() => buildQuickHoleUpdate(input({ putts }, 4)));
  assert.equal(buildQuickHoleUpdate(input({ putts: "" })).putts, null);
});
