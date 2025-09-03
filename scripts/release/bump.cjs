#!/usr/bin/env node
/* Bump version in package.json using semver: major|minor|patch (default patch). */
const fs = require('fs');
const path = require('path');
let semver;
try { semver = require('semver'); } catch { console.error('Missing devDependency: semver'); process.exit(1); }
const bump = process.argv[2] || 'patch';
const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = semver.inc(pkg.version, bump);
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Version:', pkg.version);
