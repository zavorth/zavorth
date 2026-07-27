#!/usr/bin/env node
/**
 * P3 — Export curated first-party catalog as a hostable remote marketplace JSON.
 *
 * Usage:
 *   node scripts/export-plugin-marketplace-remote.mjs
 *   node scripts/export-plugin-marketplace-remote.mjs --out docs/generated/plugin-marketplace-remote.json
 *   node scripts/export-plugin-marketplace-remote.mjs --base-url https://cdn.example.com/plugins
 *
 * Does NOT publish. Writes a file you can host over HTTPS and point to with:
 *   ZAVORTH_PLUGIN_MARKETPLACE_URL=https://cdn.example.com/plugins/catalog.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function readFlag(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1];
  return v && !v.startsWith('-') ? v : null;
}

const outPath = path.resolve(
  root,
  readFlag('--out') || 'docs/generated/plugin-marketplace-remote.json',
);
const baseUrl = String(readFlag('--base-url') || '').replace(/\/+$/u, '');
const includeExamples = args.includes('--examples');

const curatedPath = path.join(root, 'config', 'plugin-marketplace-curated.json');
const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));
const list = Array.isArray(curated) ? curated : [];

const entries = list
  .filter((entry) => {
    const tier = String(entry.tier || '').toLowerCase();
    if (includeExamples) return true;
    return tier === 'first-party' || tier === 'curated' || !tier;
  })
  .map((entry) => {
    const id = String(entry.id || '').trim();
    const sourceBundled = String(entry.source || `bundled://${id}`);
    const remoteSource = baseUrl ? `${baseUrl}/${encodeURIComponent(id)}.tgz`
      : sourceBundled.startsWith('http')
        ? sourceBundled
        : `bundled://${id}`;
    return {
      id,
      name: entry.name || id,
      summary: entry.summary || '',
      description: entry.description || entry.summary || '',
      moduleKind: entry.moduleKind || 'tool',
      version: entry.version || '1.0.0',
      tier: entry.tier || 'first-party',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      permissions: Array.isArray(entry.permissions) ? entry.permissions : [],
      source: remoteSource,
      sourceLocator: remoteSource,
      signed: entry.signed === true,
      curated: true,
      digest: entry.digest || null,
      signature: entry.signature || null,
    };
  });

const payload = {
  schemaVersion: 'zavorth.plugin-marketplace-remote.v1',
  generatedAt: new Date().toISOString(),
  count: entries.length,
  notes: [
    'Host this JSON over HTTPS (public host).',
    'Set ZAVORTH_PLUGIN_MARKETPLACE_URL to the hosted catalog URL.',
    'If source is bundled://, installers prefer local plugins/ copy when present.',
    'Replace source with https://…/*.tgz for true remote package delivery.',
  ],
  entries,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

// Also write a flat array form some clients expect
const flatPath = outPath.replace(/\.json$/iu, '.entries.json');
fs.writeFileSync(flatPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');

console.log('Remote marketplace export written:');
console.log(`  ${path.relative(root, outPath)} (${entries.length} entries)`);
console.log(`  ${path.relative(root, flatPath)} (flat array)`);
if (baseUrl) {
  console.log(`  package base URL: ${baseUrl}/<id>.tgz`);
} else {
  console.log('  tip: pass --base-url https://cdn.example.com/plugins for package URLs');
}
console.log('');
console.log('Host example:');
console.log('  # upload catalog to CDN, then:');
console.log(`  export ZAVORTH_PLUGIN_MARKETPLACE_URL=https://your.cdn/plugin-catalog.json`);
console.log('  zavorth plugins marketplace refresh-remote');
