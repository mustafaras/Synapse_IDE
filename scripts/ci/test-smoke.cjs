#!/usr/bin/env node
/* Minimal CI test runner: invokes any exported run*Tests functions, emits a JUnit file. */
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const testGlobs = [
  path.join(projectRoot, 'src', '**', '*.test.*'),
  path.join(projectRoot, 'src', '**', '*.spec.*'),
];

function findFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(p));
    else results.push(p);
  }
  return results;
}

function matches(p) {
  return /\.(test|spec)\.[tj]sx?$/.test(p) && p.includes(path.sep + 'src' + path.sep);
}

const all = findFiles(path.join(projectRoot, 'src')).filter(matches);
let passed = 0, failed = 0;
const cases = [];

for (const f of all) {
  try {
    const mod = require(f);
    const keys = Object.keys(mod).filter(k => /^run.*Tests$/.test(k) && typeof mod[k] === 'function');
    if (keys.length === 0) continue;
    for (const k of keys) {
      const ok = !!mod[k]();
      if (ok) { passed++; cases.push({ name: `${path.basename(f)}:${k}`, ok: true }); }
      else { failed++; cases.push({ name: `${path.basename(f)}:${k}`, ok: false, message: 'returned false' }); }
    }
  } catch (e) {
    failed++; cases.push({ name: path.basename(f), ok: false, message: String(e && e.message || e) });
  }
}

// Write a minimal JUnit XML
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<testsuite name="ci-smoke" tests="${passed + failed}" failures="${failed}">` +
  cases.map(c => c.ok ? `<testcase name="${c.name}"/>` : `<testcase name="${c.name}"><failure>${c.message||''}</failure></testcase>`).join('') +
  `</testsuite>\n`;
fs.writeFileSync(path.join(projectRoot, 'junit.xml'), xml);

console.log(`CI Smoke: tests=${passed + failed}, passed=${passed}, failed=${failed}`);
process.exit(failed ? 1 : 0);
