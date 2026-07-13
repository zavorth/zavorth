#!/usr/bin/env node
/**
 * Wave 8 — Plugin Atlas generator
 *
 * Reads:
 *   config/plugin-marketplace-curated.json
 *   config/plugin-os-gap-waves.json (optional)
 *
 * Writes:
 *   docs/generated/plugin-atlas.json
 *   docs/generated/plugin-atlas.md
 *
 * Usage:
 *   node scripts/generate-plugin-atlas.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const curatedPath = path.join(root, 'config', 'plugin-marketplace-curated.json');
const gapWavesPath = path.join(root, 'config', 'plugin-os-gap-waves.json');
const outDir = path.join(root, 'docs', 'generated');
const outJson = path.join(outDir, 'plugin-atlas.json');
const outMd = path.join(outDir, 'plugin-atlas.md');

const WAVE_TAG_RE = /^wave([0-9]+)$/i;
const PACK_TAG_HINTS = new Set([
  'daily-ops',
  'provider',
  'platform',
  'memory',
  'media',
  'browser',
  'search',
  'trust',
  'lifestyle',
  'example',
  'forge',
  'mcp',
  'bridge',
]);

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTags(tags) {
  return asArray(tags).map((t) => String(t).trim()).filter(Boolean);
}

function waveFromTag(tags) {
  for (const tag of tags) {
    const m = WAVE_TAG_RE.exec(tag);
    if (m) return `W${m[1]}`;
  }
  return null;
}

/**
 * Build id → waveId from gap-waves packages lists (W1+; baseline stays null unless tagged).
 */
function packageWaveMap(gapWaves) {
  const map = new Map();
  if (!gapWaves || !Array.isArray(gapWaves.waves)) return map;
  for (const wave of gapWaves.waves) {
    const waveId = String(wave.id || '').trim();
    if (!waveId) continue;
    for (const pkg of asArray(wave.packages)) {
      const id = String(pkg || '').trim();
      if (id && !map.has(id)) map.set(id, waveId);
    }
  }
  return map;
}

function inferWave(entry, byPackage) {
  const tags = normalizeTags(entry.tags);
  const fromTag = waveFromTag(tags);
  if (fromTag) return fromTag;
  const fromWaveList = byPackage.get(entry.id);
  if (fromWaveList && fromWaveList !== 'W0') return fromWaveList;
  return null;
}

function packKeysFor(entry) {
  const tags = normalizeTags(entry.tags);
  const keys = new Set();
  // Prefer explicit waveN tags; also fold inferred entry.wave (from gap-waves packages).
  const waveTag = waveFromTag(tags);
  const waveKey = waveTag
    || (entry.wave ? String(entry.wave).toLowerCase().replace(/^w/i, 'wave') : null);
  if (waveKey) keys.add(waveKey.toLowerCase().replace(/^w(\d+)$/i, 'wave$1'));
  for (const tag of tags) {
    if (WAVE_TAG_RE.test(tag)) {
      keys.add(tag.toLowerCase());
      continue;
    }
    if (PACK_TAG_HINTS.has(tag.toLowerCase())) {
      keys.add(tag.toLowerCase());
    }
    // Explicit pack-style tags: "*-pack" or names ending with pack
    if (/pack$/i.test(tag) || /-pack$/i.test(tag)) {
      keys.add(tag.toLowerCase());
    }
  }
  if (entry.tier === 'example') keys.add('example');
  if (keys.size === 0) {
    keys.add('baseline');
  }
  return [...keys];
}

function loadCurated() {
  const raw = readJson(curatedPath, []);
  if (!Array.isArray(raw)) {
    throw new Error(`Expected array in ${path.relative(root, curatedPath)}`);
  }
  return raw
    .filter((item) => item && typeof item === 'object' && item.id)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || item.id),
      summary: item.summary ? String(item.summary) : '',
      moduleKind: item.moduleKind ? String(item.moduleKind) : '',
      tier: item.tier ? String(item.tier) : 'first-party',
      tags: normalizeTags(item.tags),
      signed: item.signed === true,
      version: item.version ? String(item.version) : undefined,
      source: item.source ? String(item.source) : undefined,
    }));
}

function buildAtlas() {
  const curated = loadCurated();
  const gapWaves = readJson(gapWavesPath, null);
  const byPackage = packageWaveMap(gapWaves);

  const plugins = curated.map((entry) => {
    const wave = inferWave(entry, byPackage);
    return {
      id: entry.id,
      name: entry.name,
      summary: entry.summary,
      moduleKind: entry.moduleKind,
      tier: entry.tier,
      tags: entry.tags,
      signed: entry.signed,
      ...(wave ? { wave } : {}),
      ...(entry.version ? { version: entry.version } : {}),
      ...(entry.source ? { source: entry.source } : {}),
    };
  });

  const firstPartyCount = plugins.filter((p) => p.tier === 'first-party').length;
  const exampleCount = plugins.filter((p) => p.tier === 'example').length;
  const total = plugins.length;

  const packs = {};
  for (const plugin of plugins) {
    const keys = packKeysFor(plugin);
    for (const key of keys) {
      if (!packs[key]) {
        packs[key] = { id: key, pluginIds: [] };
      }
      if (!packs[key].pluginIds.includes(plugin.id)) {
        packs[key].pluginIds.push(plugin.id);
      }
    }
  }
  for (const key of Object.keys(packs)) {
    packs[key].pluginIds.sort((a, b) => a.localeCompare(b));
    packs[key].count = packs[key].pluginIds.length;
  }

  // Stable key order for packs
  const orderedPacks = Object.fromEntries(
    Object.keys(packs)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, packs[k]]),
  );

  const waves = gapWaves && Array.isArray(gapWaves.waves)
    ? gapWaves.waves.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.status,
      packages: asArray(w.packages),
      ...(Array.isArray(w.api) ? { api: w.api } : {}),
      ...(Array.isArray(w.exit) ? { exit: w.exit } : {}),
    }))
    : [];

  return {
    schemaVersion: 'zavorth.plugin-atlas.v1',
    generatedAt: new Date().toISOString(),
    source: {
      curated: path.relative(root, curatedPath).replace(/\\/g, '/'),
      gapWaves: fs.existsSync(gapWavesPath)
        ? path.relative(root, gapWavesPath).replace(/\\/g, '/')
        : null,
    },
    firstPartyCount,
    exampleCount,
    total,
    waves,
    plugins: plugins.sort((a, b) => a.id.localeCompare(b.id)),
    packs: orderedPacks,
  };
}

function escCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(atlas) {
  const lines = [];
  lines.push('# Zavorth Plugin Atlas');
  lines.push('');
  lines.push('> Generated by `scripts/generate-plugin-atlas.mjs`. Do not edit by hand.');
  lines.push(`> Generated at: \`${atlas.generatedAt}\``);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Total plugins | ${atlas.total} |`);
  lines.push(`| First-party | ${atlas.firstPartyCount} |`);
  lines.push(`| Example | ${atlas.exampleCount} |`);
  lines.push(`| Packs | ${Object.keys(atlas.packs).length} |`);
  lines.push(`| Waves tracked | ${atlas.waves.length} |`);
  lines.push('');

  if (atlas.waves.length > 0) {
    lines.push('## Gap-closure waves');
    lines.push('');
    lines.push('| Wave | Name | Status | Packages |');
    lines.push('|------|------|--------|---------:|');
    for (const wave of atlas.waves) {
      lines.push(
        `| ${escCell(wave.id)} | ${escCell(wave.name)} | ${escCell(wave.status)} | ${asArray(wave.packages).length} |`,
      );
    }
    lines.push('');
  }

  // Counts by tier
  const byTier = new Map();
  for (const p of atlas.plugins) {
    const tier = p.tier || 'unknown';
    byTier.set(tier, (byTier.get(tier) || 0) + 1);
  }
  lines.push('## By tier');
  lines.push('');
  lines.push('| Tier | Count |');
  lines.push('|------|------:|');
  for (const [tier, count] of [...byTier.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${escCell(tier)} | ${count} |`);
  }
  lines.push('');

  // Group plugins by wave (null → baseline)
  const byWave = new Map();
  for (const p of atlas.plugins) {
    const key = p.wave || 'baseline';
    if (!byWave.has(key)) byWave.set(key, []);
    byWave.get(key).push(p);
  }
  const waveOrder = (a, b) => {
    if (a === 'baseline') return 1;
    if (b === 'baseline') return -1;
    const na = Number(String(a).replace(/\D/g, '')) || 0;
    const nb = Number(String(b).replace(/\D/g, '')) || 0;
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  };

  lines.push('## Plugins by wave');
  lines.push('');
  for (const waveKey of [...byWave.keys()].sort(waveOrder)) {
    const list = byWave.get(waveKey);
    const waveMeta = atlas.waves.find((w) => w.id === waveKey);
    const title = waveMeta
      ? `${waveKey} — ${waveMeta.name}`
      : waveKey === 'baseline'
        ? 'Baseline / untagged'
        : waveKey;
    lines.push(`### ${title} (${list.length})`);
    lines.push('');
    lines.push('| Id | Name | Tier | Module | Signed | Summary |');
    lines.push('|----|------|------|--------|:------:|---------|');
    for (const p of list.sort((a, b) => a.id.localeCompare(b.id))) {
      lines.push(
        `| \`${escCell(p.id)}\` | ${escCell(p.name)} | ${escCell(p.tier)} | ${escCell(p.moduleKind)} | ${p.signed ? 'yes' : 'no'} | ${escCell(p.summary)} |`,
      );
    }
    lines.push('');
  }

  // Tier tables (compact)
  lines.push('## Plugins by tier');
  lines.push('');
  for (const tier of [...byTier.keys()].sort()) {
    const list = atlas.plugins.filter((p) => (p.tier || 'unknown') === tier);
    lines.push(`### Tier: ${tier} (${list.length})`);
    lines.push('');
    lines.push('| Id | Name | Wave | Module | Tags |');
    lines.push('|----|------|------|--------|------|');
    for (const p of list) {
      lines.push(
        `| \`${escCell(p.id)}\` | ${escCell(p.name)} | ${escCell(p.wave || '—')} | ${escCell(p.moduleKind)} | ${escCell(p.tags.join(', '))} |`,
      );
    }
    lines.push('');
  }

  // Packs summary
  lines.push('## Packs');
  lines.push('');
  lines.push('| Pack | Count | Plugin ids |');
  lines.push('|------|------:|------------|');
  for (const [key, pack] of Object.entries(atlas.packs)) {
    const ids = pack.pluginIds.map((id) => `\`${id}\``).join(', ');
    lines.push(`| ${escCell(key)} | ${pack.count} | ${ids} |`);
  }
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Curated catalog: \`${atlas.source.curated}\``);
  lines.push(
    atlas.source.gapWaves
      ? `- Gap waves: \`${atlas.source.gapWaves}\``
      : '- Gap waves: _(not present)_',
  );
  lines.push('- Machine-readable: `docs/generated/plugin-atlas.json`');
  lines.push('');
  lines.push('## Related');
  lines.push('');
  lines.push('- [Plugin OS](../plugin-os.md)');
  lines.push('- [Gap closure waves](../plugin-os-gap-closure-waves.md)');
  lines.push('- [Signed pack format](../plugin-os-signed-pack.md)');
  lines.push('');

  return `${lines.join('\n')}`;
}

function main() {
  if (!fs.existsSync(curatedPath)) {
    console.error(`Missing curated catalog: ${curatedPath}`);
    process.exit(1);
  }

  const atlas = buildAtlas();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(atlas, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMd, renderMarkdown(atlas), 'utf8');

  console.log(`Plugin atlas written:`);
  console.log(`  ${path.relative(root, outJson).replace(/\\/g, '/')} (${atlas.total} plugins)`);
  console.log(`  ${path.relative(root, outMd).replace(/\\/g, '/')}`);
  console.log(
    `  first-party=${atlas.firstPartyCount} example=${atlas.exampleCount} packs=${Object.keys(atlas.packs).length}`,
  );
}

main();
