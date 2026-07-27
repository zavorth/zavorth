#!/usr/bin/env node
/**
 * Plugin Atlas generator
 *
 * Reads:
 *   config/plugin-marketplace-curated.json
 *   config/plugin-os-capability-groups.json (optional)
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
const capabilityGroupsPath = path.join(root, 'config', 'plugin-os-capability-groups.json');
const outDir = path.join(root, 'docs', 'generated');
const outJson = path.join(outDir, 'plugin-atlas.json');
const outMd = path.join(outDir, 'plugin-atlas.md');

const GROUP_TAG_RE = /^group([0-9]+)$/i;
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

function groupFromTag(tags) {
  for (const tag of tags) {
    const m = GROUP_TAG_RE.exec(tag);
    if (m) return `W${m[1]}`;
  }
  return null;
}

/**
 * Build id -> groupId from capability-groups packages lists (group-1+; baseline stays null unless tagged).
 */
function packageGroupMap(capabilityGroups) {
  const map = new Map();
  if (!capabilityGroups || !Array.isArray(capabilityGroups.groups)) return map;
  for (const group of capabilityGroups.groups) {
    const groupId = String(group.id || '').trim();
    if (!groupId) continue;
    for (const pkg of asArray(group.packages)) {
      const id = String(pkg || '').trim();
      if (id && !map.has(id)) map.set(id, groupId);
    }
  }
  return map;
}

function inferGroup(entry, byPackage) {
  const tags = normalizeTags(entry.tags);
  const fromTag = groupFromTag(tags);
  if (fromTag) return fromTag;
  const fromGroupList = byPackage.get(entry.id);
  if (fromGroupList && fromGroupList !== 'group-0') return fromGroupList;
  return null;
}

function packKeysFor(entry) {
  const tags = normalizeTags(entry.tags);
  const keys = new Set();
  // Prefer explicit groupN tags; also fold inferred entry.group (from capability-groups packages).
  const groupTag = groupFromTag(tags);
  const groupKey = groupTag
    || (entry.group ? String(entry.group).toLowerCase().replace(/^w/i, 'group') : null);
  if (groupKey) keys.add(groupKey.toLowerCase().replace(/^w(\d+)$/i, 'group$1'));
  for (const tag of tags) {
    if (GROUP_TAG_RE.test(tag)) {
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
  const capabilityGroups = readJson(capabilityGroupsPath, null);
  const byPackage = packageGroupMap(capabilityGroups);

  const plugins = curated.map((entry) => {
    const group = inferGroup(entry, byPackage);
    return {
      id: entry.id,
      name: entry.name,
      summary: entry.summary,
      moduleKind: entry.moduleKind,
      tier: entry.tier,
      tags: entry.tags,
      signed: entry.signed,
      ...(group ? { group } : {}),
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

  const groups = capabilityGroups && Array.isArray(capabilityGroups.groups)
    ? capabilityGroups.groups.map((w) => ({
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
      capabilityGroups: fs.existsSync(capabilityGroupsPath)
        ? path.relative(root, capabilityGroupsPath).replace(/\\/g, '/')
        : null,
    },
    firstPartyCount,
    exampleCount,
    total,
    groups,
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
  lines.push(`| Capability groups tracked | ${atlas.groups.length} |`);
  lines.push('');

  if (atlas.groups.length > 0) {
    lines.push('## Capability groups');
    lines.push('');
    lines.push('| Group | Name | Status | Packages |');
    lines.push('|------|------|--------|---------:|');
    for (const group of atlas.groups) {
      lines.push(
        `| ${escCell(group.id)} | ${escCell(group.name)} | ${escCell(group.status)} | ${asArray(group.packages).length} |`,
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

  // Group plugins by capability group (null -> baseline)
  const byGroup = new Map();
  for (const p of atlas.plugins) {
    const key = p.group || 'baseline';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(p);
  }
  const groupOrder = (a, b) => {
    if (a === 'baseline') return 1;
    if (b === 'baseline') return -1;
    const na = Number(String(a).replace(/\D/g, '')) || 0;
    const nb = Number(String(b).replace(/\D/g, '')) || 0;
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  };

  lines.push('## Plugins by capability group');
  lines.push('');
  for (const groupKey of [...byGroup.keys()].sort(groupOrder)) {
    const list = byGroup.get(groupKey);
    const groupMeta = atlas.groups.find((w) => w.id === groupKey);
    const title = groupMeta ? `${groupKey} - ${groupMeta.name}`
      : groupKey === 'baseline'
        ? 'Baseline / untagged'
        : groupKey;
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
    lines.push('| Id | Name | Group | Module | Tags |');
    lines.push('|----|------|------|--------|------|');
    for (const p of list) {
      lines.push(
        `| \`${escCell(p.id)}\` | ${escCell(p.name)} | ${escCell(p.group || '—')} | ${escCell(p.moduleKind)} | ${escCell(p.tags.join(', '))} |`,
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
    atlas.source.capabilityGroups ? `- Capability groups: \`${atlas.source.capabilityGroups}\``
      : '- Capability groups: _(not present)_',
  );
  lines.push('- Machine-readable: `docs/generated/plugin-atlas.json`');
  lines.push('');
  lines.push('## Related');
  lines.push('');
  lines.push('- [Plugin OS](../plugin-os.md)');
  lines.push('- [Capability groups](../plugin-os-capability-groups.md)');
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
