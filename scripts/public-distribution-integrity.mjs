#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

export const PUBLIC_DISTRIBUTION_SCHEMA = 'zavorth-public-distribution/v1';
export const REQUIRED_PLATFORMS = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'windows-x64'];

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function inside(root, target) { const rel = relative(resolve(root), resolve(target)); return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..'; }
function validName(name) { return typeof name === 'string' && name === basename(name) && !name.includes('..') && !name.includes('/') && !name.includes('\\'); }
function safeFiles(root) {
  return readdirSync(root, { withFileTypes: true }).map((entry) => {
    const file = join(root, entry.name);
    if (!entry.isFile() || lstatSync(file).isSymbolicLink() || !inside(root, realpathSync(file))) throw new Error(`Unsafe or non-file artifact entry: ${entry.name}`);
    const data = readFileSync(file);
    return { name: entry.name, bytes: data.byteLength, sha256: sha256(data) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function buildPublicDistributionManifest(input) {
  const artifactDir = resolve(input.artifactDir);
  const files = safeFiles(artifactDir).filter((file) => file.name !== 'public-distribution-manifest.json');
  const artifacts = REQUIRED_PLATFORMS.map((platform) => {
    const expectedName = `zavorth-${platform}.tar.gz`;
    const matches = files.filter((file) => file.name === expectedName);
    return { platform, files: matches };
  });
  const sbom = files.filter((file) => /(?:sbom|cyclonedx|spdx)/i.test(file.name));
  const signatures = files.filter((file) => file.name.endsWith('.sig'));
  const provenance = files.filter((file) => /provenance|intoto/i.test(file.name));
  const assigned = new Set([...artifacts.flatMap((entry) => entry.files), ...sbom, ...signatures, ...provenance].map((file) => file.name));
  const auxiliary = files.filter((file) => !assigned.has(file.name));
  const signatureAvailability = new Set(input.signaturePlatforms || []);
  const signatureEvidence = REQUIRED_PLATFORMS.map((platform) => ({
    platform,
    availability: signatureAvailability.has(platform) ? 'required' : 'unavailable',
    acceptedKinds: platform.startsWith('windows') ? ['authenticode', 'detached'] : platform.startsWith('darwin') ? ['notarization', 'codesign', 'detached'] : ['detached'],
    files: signatures.filter((file) => file.name.startsWith(`zavorth-${platform}.tar.gz.`)),
  }));
  const aggregateSha256 = aggregate({ artifacts, sbom, provenance, signatures, auxiliary, signatureEvidence });
  return {
    schemaVersion: PUBLIC_DISTRIBUTION_SCHEMA,
    generatedAt: new Date().toISOString(),
    version: String(input.version || '').trim(),
    mode: input.production ? 'production' : 'rehearsal',
    artifacts,
    sbom,
    provenance,
    signatures: { external: true, files: signatures, evidence: signatureEvidence },
    auxiliary,
    rollback: {
      preservePaths: ['.zavorth', 'config', 'data', 'memory', 'workspaces'],
      removablePaths: ['bin', 'lib', 'package', 'generated-launchers'],
      destructiveUserDataRemovalAllowed: false,
    },
    aggregateSha256,
  };
}

function aggregate(value) {
  return sha256(Buffer.from(JSON.stringify(value, null, 2)));
}

export function validatePublicDistributionManifest(manifest, options = {}) {
  const failures = [];
  if (manifest.schemaVersion !== PUBLIC_DISTRIBUTION_SCHEMA) failures.push('unsupported manifest schema');
  if (!manifest.version) failures.push('release version is required');
  const entries = manifest.artifacts || [];
  for (const platform of REQUIRED_PLATFORMS) {
    const matching = entries.filter((entry) => entry.platform === platform);
    if (matching.length !== 1) failures.push(`platform entry must appear exactly once: ${platform}`);
  }
  for (const entry of entries) {
    if (!REQUIRED_PLATFORMS.includes(entry.platform)) failures.push(`unknown platform entry: ${entry.platform}`);
    if (entry.files?.length !== 1 || entry.files?.[0]?.name !== `zavorth-${entry.platform}.tar.gz`) failures.push(`missing or ambiguous artifact for ${entry.platform}`);
    for (const file of entry.files || []) if (!/^[a-f0-9]{64}$/.test(file.sha256) || file.bytes <= 0) failures.push(`invalid artifact integrity: ${file.name}`);
  }
  const inventory = [...entries.flatMap((entry) => entry.files || []), ...(manifest.sbom || []), ...(manifest.provenance || []), ...(manifest.signatures?.files || []), ...(manifest.auxiliary || [])];
  const names = inventory.map((file) => file.name);
  for (const name of names) if (!validName(name)) failures.push(`unsafe manifest filename: ${name}`);
  for (const name of new Set(names)) if (names.filter((candidate) => candidate === name).length !== 1) failures.push(`duplicate manifest filename: ${name}`);
  const expectedAggregate = aggregate({ artifacts: entries, sbom: manifest.sbom || [], provenance: manifest.provenance || [], signatures: manifest.signatures?.files || [], auxiliary: manifest.auxiliary || [], signatureEvidence: manifest.signatures?.evidence || [] });
  if (manifest.aggregateSha256 !== expectedAggregate) failures.push('aggregateSha256 does not match manifest contents');
  if (!manifest.rollback?.preservePaths?.includes('.zavorth') || manifest.rollback?.destructiveUserDataRemovalAllowed !== false) {
    failures.push('rollback must preserve user data');
  }
  if (options.production) {
    if (!(manifest.sbom || []).length) failures.push('production release requires an SBOM');
    if (!(manifest.provenance || []).length) failures.push('production release requires provenance evidence');
    for (const evidence of manifest.signatures?.evidence || []) {
      if (evidence.availability === 'required' && !evidence.files?.length) failures.push(`production release requires signing evidence for ${evidence.platform}`);
    }
    if (options.requireExternalSignatures && !(manifest.signatures?.files || []).length) failures.push('production release requires externally generated signatures');
  }
  return failures;
}

export function verifyManifestFiles(manifest, artifactDir) {
  const failures = [];
  const root = resolve(artifactDir);
  const referenced = [...(manifest.artifacts || []).flatMap((entry) => entry.files || []), ...(manifest.sbom || []), ...(manifest.provenance || []), ...(manifest.signatures?.files || []), ...(manifest.auxiliary || [])];
  for (const expected of referenced) {
    if (!validName(expected.name)) { failures.push(`unsafe manifest filename: ${expected.name}`); continue; }
    const target = resolve(root, expected.name);
    if (!inside(root, target) || !existsSync(target)) { failures.push(`missing or unsafe file: ${expected.name}`); continue; }
    const data = readFileSync(target);
    if (data.byteLength !== expected.bytes || sha256(data) !== expected.sha256) failures.push(`artifact changed after manifest: ${expected.name}`);
  }
  const diskNames = safeFiles(root).filter((file) => file.name !== 'public-distribution-manifest.json').map((file) => file.name).sort();
  const referencedNames = [...new Set(referenced.map((file) => file.name))].sort();
  for (const orphan of diskNames.filter((name) => !referencedNames.includes(name))) failures.push(`unreferenced artifact file: ${orphan}`);
  return failures;
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const artifactDir = resolve(value('--artifact-dir') || join(process.cwd(), '.qa', 'public-distribution'));
  const production = args.includes('--production');
  const requireExternalSignatures = args.includes('--require-external-signatures');
  const manifestPath = resolve(value('--manifest') || join(artifactDir, 'public-distribution-manifest.json'));
  if (!inside(artifactDir, manifestPath)) throw new Error('Manifest must remain inside the artifact directory.');
  let manifest;
  if (args.includes('--verify')) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  else {
    const signaturePlatforms = String(value('--signature-platforms') || '').split(',').map((item) => item.trim()).filter(Boolean);
    manifest = buildPublicDistributionManifest({ artifactDir, version: value('--version'), production, signaturePlatforms });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  const failures = [...validatePublicDistributionManifest(manifest, { production, requireExternalSignatures }), ...verifyManifestFiles(manifest, artifactDir)];
  process.stdout.write(`${JSON.stringify({ ok: failures.length === 0, manifest: basename(manifestPath), failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

if (resolve(process.argv[1] || '') === resolve(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
