#!/usr/bin/env node
'use strict';

// Runs the Jest suite N times and tallies pass/fail counts per test.
// Used by the flake-triage skill (discovery) AND by the evaluator agent
// (verification) — a single green run proves nothing for a flake, so both
// sides of the loop go through this same script instead of trusting one pass.
//
// Usage: node scripts/run-suite-n.js [N]
// N defaults to loop.config.json's suiteRunsPerCandidate.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'loop.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const n = Number(process.argv[2]) || config.suiteRunsPerCandidate || 10;

const tally = new Map(); // full test name -> { pass, fail }

function record(fullName, status) {
  const entry = tally.get(fullName) || { pass: 0, fail: 0 };
  if (status === 'passed') entry.pass += 1;
  else if (status === 'failed') entry.fail += 1;
  tally.set(fullName, entry);
}

// jest's package.json exports map blocks require.resolve('jest/bin/jest.js'),
// so point at the on-disk path directly.
const jestBin = path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');

for (let i = 1; i <= n; i += 1) {
  let raw;
  try {
    raw = execFileSync(
      process.execPath,
      [jestBin, '--json', '--silent'],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
  } catch (err) {
    // jest exits non-zero on test failure; stdout still has the JSON report.
    raw = err.stdout;
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error(`run ${i}/${n}: could not parse jest --json output, skipping`);
    continue;
  }

  for (const suite of report.testResults) {
    for (const result of suite.assertionResults) {
      const fullName = `${path.relative(process.cwd(), suite.name)} :: ${result.fullName}`;
      record(fullName, result.status);
    }
  }
  process.stderr.write(`run ${i}/${n} done\n`);
}

const rows = [...tally.entries()].map(([fullName, counts]) => {
  const total = counts.pass + counts.fail;
  const flakeCandidate = counts.pass > 0 && counts.fail > 0;
  return { fullName, ...counts, total, flakeCandidate };
});

console.log(JSON.stringify({ runs: n, results: rows }, null, 2));

const flaky = rows.filter((r) => r.flakeCandidate);
process.stderr.write(
  `\n${flaky.length} flake candidate(s) out of ${rows.length} test(s) across ${n} runs:\n`
);
for (const r of flaky) {
  process.stderr.write(`  ${r.fullName}: ${r.pass}/${r.total} pass\n`);
}
