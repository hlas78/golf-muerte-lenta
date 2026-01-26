function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function extractInputs(html, namePrefix) {
  const results = new Map();
  const inputRegex = /<input\b[^>]*>/gi;
  let inputMatch = inputRegex.exec(html);
  while (inputMatch) {
    const tag = inputMatch[0];
    const attrs = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let attrMatch = attrRegex.exec(tag);
    while (attrMatch) {
      attrs[attrMatch[1]] = attrMatch[2];
      attrMatch = attrRegex.exec(tag);
    }
    const name = attrs.name || "";
    if (name.startsWith(namePrefix)) {
      const hole = Number.parseInt(name.slice(namePrefix.length), 10);
      if (Number.isFinite(hole)) {
        results.set(hole, toNumber(attrs.value));
      }
    }
    inputMatch = inputRegex.exec(html);
  }
  return results;
}

export function parseScorecardHtml(html, options = {}) {
  const strokesMap = extractInputs(html, "scH");
  const puttsMap = extractInputs(html, "ptH");
  const detectedMax = Math.max(
    0,
    ...Array.from(new Set([...strokesMap.keys(), ...puttsMap.keys()]))
  );
  const holesCount =
    Number.isFinite(options.holesCount) && options.holesCount > 0
      ? options.holesCount
      : detectedMax || 18;

  const holes = Array.from({ length: holesCount }, (_, idx) => {
    const holeNumber = idx + 1;
    return {
      hole: holeNumber,
      strokes: strokesMap.has(holeNumber) ? strokesMap.get(holeNumber) : null,
      putts: puttsMap.has(holeNumber) ? puttsMap.get(holeNumber) : null,
    };
  });

  return { holes };
}
