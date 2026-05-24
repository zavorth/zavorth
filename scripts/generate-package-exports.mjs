#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const sourceSdkRoot = path.join(root, 'src', 'sdk');
const args = new Set(process.argv.slice(2));
const mode = args.has('--write') ? 'write' : 'check';

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const generated = {
  '.': {
    types: './dist/index.d.ts',
    default: './dist/index.js',
  },
};

for (const entry of discoverSdkEntries()) {
  generated[`./sdk/${entry.exportName}`] = {
    types: `./dist/sdk/${entry.distName}.d.ts`,
    default: `./dist/sdk/${entry.distName}.js`,
  };
}

if (fs.existsSync(path.join(sourceSdkRoot, 'index.ts'))) {
  generated['./sdk'] = {
    types: './dist/sdk/index.d.ts',
    default: './dist/sdk/index.js',
  };
}

generated['./package.json'] = './package.json';

const next = {
  ...pkg,
  exports: sortExports(generated),
};

const nextText = `${JSON.stringify(next, null, 2)}\n`;
const currentText = fs.readFileSync(packagePath, 'utf8');

if (mode === 'write') {
  fs.writeFileSync(packagePath, nextText, 'utf8');
  console.log(`Generated ${Object.keys(next.exports).length} package exports.`);
  process.exit(0);
}

if (normalizeJsonText(currentText) !== normalizeJsonText(nextText)) {
  console.error('package.json exports are out of date. Run npm run sdk:exports.');
  process.exit(1);
}

console.log(`package.json exports are current (${Object.keys(next.exports).length} entries).`);

function discoverSdkEntries() {
  if (!fs.existsSync(sourceSdkRoot)) {
    return [];
  }
  const entries = [];
  walk(sourceSdkRoot, (file) => {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) return;
    const rel = path.relative(sourceSdkRoot, file).replace(/\\/g, '/');
    if (rel === 'index.ts') return;
    const distName = rel.replace(/\.ts$/, '');
    entries.push({
      exportName: toPublicExportName(distName),
      distName,
    });
  });
  return entries.sort((a, b) => a.exportName.localeCompare(b.exportName));
}

function toPublicExportName(distName) {
  if (distName === 'runtime-codex') return 'runtime/codex';
  if (distName === 'runtime-openshell') return 'runtime/openshell';
  return distName.replace(/\/index$/, '');
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}

function sortExports(exportsObject) {
  const result = {};
  for (const key of Object.keys(exportsObject).sort((a, b) => {
    if (a === '.') return -1;
    if (b === '.') return 1;
    if (a === './package.json') return 1;
    if (b === './package.json') return -1;
    if (a === './sdk') return -1;
    if (b === './sdk') return 1;
    return a.localeCompare(b);
  })) {
    result[key] = exportsObject[key];
  }
  return result;
}

function normalizeJsonText(text) {
  return JSON.stringify(JSON.parse(text));
}
