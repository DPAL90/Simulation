const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const coverageArgs = [
  "--test",
  "--experimental-test-coverage",
  "model.happy.test.js",
  "model.corner.test.js",
  "model.component.test.js",
  "model.integration.test.js",
];

const result = spawnSync(process.execPath, coverageArgs, {
  cwd: process.cwd(),
  encoding: "utf8",
});

const rawOutput = `${result.stdout || ""}${result.stderr || ""}`;
const cleanOutput = rawOutput
  .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
  .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

const coverageDir = path.join(process.cwd(), "coverage");
fs.mkdirSync(coverageDir, { recursive: true });

const reportPath = path.join(coverageDir, "coverage-report.txt");
const cleanReportPath = path.join(coverageDir, "coverage-report-clean.txt");
const summaryPath = path.join(coverageDir, "coverage-summary.txt");

fs.writeFileSync(reportPath, cleanOutput, "utf8");
fs.writeFileSync(cleanReportPath, cleanOutput, "utf8");

const lines = cleanOutput.split(/\r?\n/);
const stats = lines.filter((line) => /^\s*(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/.test(line));
const start = lines.findIndex((line) => line.includes("start of coverage report"));
const end = lines.findIndex((line) => line.includes("end of coverage report"));
const table = start >= 0 && end >= start ? lines.slice(start, end + 1) : [];

const summary = [
  "Coverage Summary",
  "================",
  "",
  ...stats,
  "",
  "Coverage Table",
  "--------------",
  ...table,
  "",
].join("\n");

fs.writeFileSync(summaryPath, summary, "utf8");

process.stdout.write(cleanOutput);

if (result.status !== 0) {
  process.exit(result.status || 1);
}
