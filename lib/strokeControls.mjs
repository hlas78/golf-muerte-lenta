export function decreaseStrokes(strokes, putts) {
  if (strokes === "" || strokes == null) return strokes;
  const next = Math.max(1, Number(strokes) - 1);
  if (putts !== "" && putts != null && Number(putts) >= next) {
    throw new Error("Reduce primero los putts: deben ser menores que los golpes.");
  }
  return next;
}
