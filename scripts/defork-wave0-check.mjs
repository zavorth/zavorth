import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const aiGatewayRoot = path.join(root, 'src', 'ai-gateway');
const freezeDocPath = path.join(aiGatewayRoot, 'DE_FORK_FREEZE.md');
const legacyRouteMarker = ['Omni', 'Route'].join('');

const forbiddenPatterns = [
  { label: 'legacy route marker', pattern: new RegExp(legacyRouteMarker, 'i') },
  { label: '9router', pattern: /9router/i },
  { label: 'sk_zavorthBridge', pattern: /sk_zavorthBridge/i },
  { label: 'OMNIROUTE_BASE_URL', pattern: /OMNIROUTE_BASE_URL/i },
  { label: 'x-zavorth-bridge-source', pattern: /x-zavorth-bridge-source/i },
  { label: '.zavorthBridge', pattern: /\.zavorthBridge/i },
  { label: '@zavorthBridge', pattern: /@zavorthBridge/i },
];

const requiredFreezeSnippets = [
  'Status: active',
  'Contribution Rules',
  'Operational Inventory',
  'Wave 0 Guardrails',
  'Compatibility Boundary Register',
  'fallback-only',
  'scripts/defork-wave0-check.mjs',
];

const requiredCompatibilityBoundaries = [
  'src/ai-gateway/lib/db/storagePlane.ts',
  'src/ai-gateway/lib/db/jsonBackupAdapters.ts',
  'src/ai-gateway/lib/oauth/authPlane.ts',
  'src/ai-gateway/mitm/proxyPlane.cjs',
  'src/ai-gateway/sse/transportPlane.ts',
  'src/ai-gateway/sse/compat/openSseCompat.ts',
];

const scanExtensions = new Set([
  '.cjs',
  '.css',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
]);

const skippedDirectories = new Set([
  '.next',
  'dist',
  'node_modules',
]);

const failures = [];
const notes = [];

if (!fs.existsSync(aiGatewayRoot)) {
  failures.push('src/ai-gateway: missing');
} else {
  checkFreezeDoc();
  checkCompatibilityBoundaryFiles();
  checkForbiddenResidues();
  checkDeadResidualFiles();
}

if (failures.length > 0) {
  console.error('[defork-wave0] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[defork-wave0] ok: ai-gateway freeze, boundary register, dead residual guard, and legacy residue scan passed.');
for (const note of notes) {
  console.log(`[defork-wave0] ${note}`);
}

function checkFreezeDoc() {
  if (!fs.existsSync(freezeDocPath)) {
    failures.push('src/ai-gateway/DE_FORK_FREEZE.md: missing active freeze document');
    return;
  }

  const content = fs.readFileSync(freezeDocPath, 'utf8');
  for (const snippet of requiredFreezeSnippets) {
    if (!content.includes(snippet)) {
      failures.push(`src/ai-gateway/DE_FORK_FREEZE.md: missing "${snippet}"`);
    }
  }

  for (const relativePath of requiredCompatibilityBoundaries) {
    if (!content.includes(relativePath)) {
      failures.push(`src/ai-gateway/DE_FORK_FREEZE.md: boundary register missing ${relativePath}`);
    }
  }
}

function checkCompatibilityBoundaryFiles() {
  for (const relativePath of requiredCompatibilityBoundaries) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath}: compatibility boundary file missing`);
    }
  }
}

function checkForbiddenResidues() {
  const files = walk(aiGatewayRoot)
    .filter((absolutePath) => {
      if (path.resolve(absolutePath) === path.resolve(freezeDocPath)) {
        return false;
      }
      return scanExtensions.has(path.extname(absolutePath));
    });

  for (const absolutePath of files) {
    const content = fs.readFileSync(absolutePath, 'utf8');
    const relativePath = normalize(path.relative(root, absolutePath));
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const forbidden of forbiddenPatterns) {
        if (forbidden.pattern.test(line)) {
          failures.push(`${relativePath}:${index + 1}: forbidden legacy residue "${forbidden.label}"`);
        }
      }
    });
  }

  notes.push(`scanned ${files.length} ai-gateway text file(s) for forbidden legacy residues`);
}

function checkDeadResidualFiles() {
  const residualFiles = walk(aiGatewayRoot)
    .map((absolutePath) => normalize(path.relative(root, absolutePath)))
    .filter((relativePath) => relativePath.endsWith('.orig'));

  for (const relativePath of residualFiles) {
    failures.push(`${relativePath}: dead .orig residual file is not allowed in the frozen subtree`);
  }
}

function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        results.push(...walk(absolutePath));
      }
      continue;
    }

    if (entry.isFile()) {
      results.push(absolutePath);
    }
  }
  return results;
}

function normalize(value) {
  return value.replace(/\\/g, '/');
}
