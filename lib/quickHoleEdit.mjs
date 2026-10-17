export function buildQuickHoleUpdate({ entry, hole, par, strokes, draft }) {
  const strokesValue = Number(strokes);
  if (!Number.isInteger(strokesValue) || strokesValue < 1 || strokesValue > 30) {
    throw new Error("Captura entre 1 y 30 golpes enteros.");
  }
  const putts = draft.putts === "" || draft.putts == null ? null : Number(draft.putts);
  if (putts != null && (!Number.isInteger(putts) || putts < 0 || putts >= strokesValue)) {
    throw new Error("Los putts deben ser enteros, no negativos y menores que los golpes.");
  }
  const penalties = (Array.isArray(draft.penalties) ? draft.penalties : [])
    .filter((penalty) => !["cuatriputt", "nerdina"].includes(penalty));
  if (putts >= 4) penalties.push("cuatriputt");
  if (strokesValue >= 10) penalties.push("nerdina");
  return {
    ...entry,
    hole,
    par,
    strokes: strokesValue,
    putts,
    sandy: Boolean(draft.sandy),
    water: Boolean(draft.water),
    ohYes: par === 3 && Boolean(draft.ohYes),
    holeOut: putts === 0 && (Boolean(draft.holeOut) || strokesValue <= par),
    penalties: [...new Set(penalties)],
  };
}
