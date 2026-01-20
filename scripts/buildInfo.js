const fs = require("fs");
const path = require("path");

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const buildInfo = {
  version: pkg.version,
  builtAt: new Date().toISOString(),
};

const outPath = path.join(__dirname, "..", "app", "buildInfo.js");
const content = `export const buildInfo = ${JSON.stringify(buildInfo, null, 2)};\n`;

fs.writeFileSync(outPath, content, "utf8");
console.log("buildInfo written", buildInfo);
