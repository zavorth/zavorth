#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { describeExternalSurfaceRoots, projectRoot } from './lib/external-surface-roots.mjs';

const legacySourceRoots = {
  site: path.join(projectRoot, 'site'),
  vercelWeb: path.join(projectRoot, 'vercel-web'),
  zavorthUi: path.join(projectRoot, 'zavorth-ui'),
};

function shouldExclude(relativePath, entryName, isDirectory, surfaceId) {
  const normalized = relativePath.replace(/\\/g, '/');
  const leaf = String(entryName || '').trim();

  if (leaf === '.git' || leaf === '.vercel') {
    return true;
  }

  if (surfaceId === 'site') {
    if (isDirectory && (leaf === 'node_modules' || leaf === '.docusaurus')) {
      return true;
    }
    if (isDirectory && /^build/i.test(leaf)) {
      return true;
    }
    if (!isDirectory && /^serve-local.*\.log$/i.test(leaf)) {
      return true;
    }
  }

  if (surfaceId === 'zavorth-ui') {
    if (isDirectory && (leaf === 'node_modules' || leaf === 'dist')) {
      return true;
    }
  }

  if (surfaceId === 'vercel-web') {
    if (isDirectory && leaf === '.vercel') {
      return true;
    }
  }

  if (normalized.includes('/node_modules/') || normalized.includes('/.docusaurus/') || normalized.includes('/dist/')) {
    return true;
  }

  return false;
}

function ensureCleanDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
}

function syncSurfaceIfPresent(sourceDir, targetDir, surfaceId) {
  if (!fs.existsSync(sourceDir)) {
    return {
      applied: false,
      reason: `source-missing:${sourceDir}`,
    };
  }

  ensureCleanDir(targetDir);
  copyTree(sourceDir, targetDir, surfaceId);
  return {
    applied: true,
    reason: `synced:${sourceDir}`,
  };
}

function copyTree(sourceDir, targetDir, surfaceId, relativeBase = '') {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const nextRelative = path.join(relativeBase, entry.name);
    if (shouldExclude(nextRelative, entry.name, entry.isDirectory(), surfaceId)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath, surfaceId, nextRelative);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function removeSourceDir(sourceDir) {
  fs.rmSync(sourceDir, { recursive: true, force: true });
}

function writeWebRepoReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  const current = fs.existsSync(readmePath) ? String(fs.readFileSync(readmePath, 'utf8') || '') : '';
  const banner = [
    '# Zavorth Web',
    '',
    'Cliente externo do runtime Zavorth.',
    '',
    '- repo runtime oficial: `../Zavorth`',
    '- este repo hospeda a superficie web extraida no core gateway',
    '- `legacy/zavorth-ui` fica mantido apenas como sandbox React/arquivo historico',
    '',
  ].join('\n');

  fs.writeFileSync(readmePath, `${banner}${current.replace(/^# .*?\n+/, '')}`.trimEnd() + '\n', 'utf8');
}

function writeDocsRepoReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  const current = fs.existsSync(readmePath) ? String(fs.readFileSync(readmePath, 'utf8') || '') : '';
  const banner = [
    '# Zavorth Docs',
    '',
    'Site publico e docs publicados do runtime Zavorth.',
    '',
    '- repo runtime oficial: `../Zavorth`',
    '- a documentacao canonica continua em `../Zavorth/docs`',
    '- este repo so constroi e publica a superficie de documentacao',
    '',
  ].join('\n');

  fs.writeFileSync(readmePath, `${banner}${current.replace(/^# .*?\n+/, '')}`.trimEnd() + '\n', 'utf8');
}

function writeUiSandboxReadme(targetRoot) {
  const readmePath = path.join(targetRoot, 'README.md');
  const current = fs.existsSync(readmePath) ? String(fs.readFileSync(readmePath, 'utf8') || '') : '';
  const banner = [
    '# Zavorth UI Sandbox',
    '',
    'Sandbox React/Vite extraido do repo oficial do runtime Zavorth.',
    '',
    '- repo runtime oficial: `../Zavorth`',
    '- este repo nao define a superficie principal do produto',
    '- mantenha aqui apenas prototipos, comparacoes ou experimentos de cliente',
    '',
  ].join('\n');

  fs.writeFileSync(readmePath, `${banner}${current.replace(/^# .*?\n+/, '')}`.trimEnd() + '\n', 'utf8');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const roots = describeExternalSurfaceRoots();

  if (!apply) {
    process.stdout.write(JSON.stringify({
      ok: true,
      dryRun: true,
      mode: 'reconcile-external-surfaces',
      projectRoot,
      docsRoot: roots.docsRoot,
      webRoot: roots.webRoot,
      planned: {
        docs: {
          from: legacySourceRoots.site,
          to: roots.docsRoot,
        },
      web: {
        from: legacySourceRoots.vercelWeb,
        to: roots.webRoot,
      },
      uiSandbox: {
        from: legacySourceRoots.zavorthUi,
        to: roots.uiSandboxRoot,
      },
      },
    }, null, 2) + '\n');
    return;
  }

  const syncReport = {
    docs: syncSurfaceIfPresent(legacySourceRoots.site, roots.docsRoot, 'site'),
    web: syncSurfaceIfPresent(legacySourceRoots.vercelWeb, roots.webRoot, 'vercel-web'),
    uiSandbox: syncSurfaceIfPresent(legacySourceRoots.zavorthUi, roots.uiSandboxRoot, 'zavorth-ui'),
  };

  writeDocsRepoReadme(roots.docsRoot);
  writeWebRepoReadme(roots.webRoot);
  writeUiSandboxReadme(roots.uiSandboxRoot);

  if (fs.existsSync(legacySourceRoots.site)) {
    removeSourceDir(legacySourceRoots.site);
  }
  if (fs.existsSync(legacySourceRoots.vercelWeb)) {
    removeSourceDir(legacySourceRoots.vercelWeb);
  }
  if (fs.existsSync(legacySourceRoots.zavorthUi)) {
    removeSourceDir(legacySourceRoots.zavorthUi);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    dryRun: false,
    mode: 'reconcile-external-surfaces',
    syncReport,
    reconciled: {
      docs: roots.docsRoot,
      web: roots.webRoot,
      uiSandbox: roots.uiSandboxRoot,
    },
    cleanedLegacySourceTrees: Object.values(legacySourceRoots),
  }, null, 2) + '\n');
}

main();
