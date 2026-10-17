import test from "node:test";
import assert from "node:assert/strict";
import { decreaseStrokes } from "../lib/strokeControls.mjs";

test("blocks reducing strokes to equal or fewer than recorded putts", () => {
  assert.throws(() => decreaseStrokes(4, 3), /Reduce primero los putts/);
  assert.throws(() => decreaseStrokes(4, 4), /Reduce primero los putts/);
  assert.throws(() => decreaseStrokes("3", "2"), /Reduce primero los putts/);
});

test("allows a valid reduction, including zero or missing putts", () => {
  assert.equal(decreaseStrokes(4, 2), 3);
  assert.equal(decreaseStrokes(2, 0), 1);
  for (const putts of [null, undefined, ""]) assert.equal(decreaseStrokes(4, putts), 3);
});

test("keeps minimum one stroke and does not invent an uncaptured score", () => {
  assert.equal(decreaseStrokes(1, 0), 1);
  for (const strokes of [null, undefined, ""]) assert.equal(decreaseStrokes(strokes, 0), strokes);
});
