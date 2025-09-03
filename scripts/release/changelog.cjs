#!/usr/bin/env node
/* Generate/append CHANGELOG using conventional-changelog. */
const fs = require('fs');
let cc;
try { cc = require('conventional-changelog'); } catch { console.error('Missing devDependency: conventional-changelog'); process.exit(1); }
const stream = cc({ preset: 'conventionalcommits', releaseCount: 1 });
const chunks = [];
stream.on('data', (buf) => chunks.push(buf));
stream.on('end', () => {
  const newLog = Buffer.concat(chunks).toString('utf8');
  let prev = '';
  try { prev = fs.readFileSync('CHANGELOG.md', 'utf8'); } catch {}
  fs.writeFileSync('CHANGELOG.md', newLog + (prev ? '\n' + prev : ''));
  console.log('CHANGELOG updated');
});
