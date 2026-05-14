#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { describeExternalSurfaceRoots } from './lib/external-surface-roots.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'config', 'surface-extraction-manifest.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function printText(manifest) {
  const roots = describeExternalSurfaceRoots();
  console.log(`Fase: ${manifest.phase}`);
  if (manifest.status) {
    console.log(`Status: ${manifest.status}`);
  }
  if (manifest.completedAt) {
    console.log(`Concluida em: ${manifest.completedAt}`);
  }
  console.log(`Foco oficial: ${manifest.officialRepoFocus.join(', ')}`);
  console.log(`Docs extraidos: ${roots.docsExists ? roots.docsRoot : 'nao encontrado'}`);
  console.log(`Web extraido: ${roots.webExists ? roots.webRoot : 'nao encontrado'}`);
  console.log(`UI sandbox extraido: ${roots.uiSandboxExists ? roots.uiSandboxRoot : 'nao encontrado'}`);
  console.log('');

  for (const surface of manifest.surfaces) {
    console.log(`[${surface.id}]`);
    console.log(`status: ${surface.status}`);
    console.log(`destino sugerido: ${surface.recommendedTargetRepo}`);
    console.log(`disposicao: ${surface.recommendedDisposition}`);
    console.log(`runtime owner: ${surface.consumes.runtimeOwner.join(', ')}`);
    console.log(`scripts acoplados: ${surface.repoCoupling.scripts.join(', ') || 'nenhum'}`);
    console.log(`riscos:`);
    for (const risk of surface.risks) {
      console.log(`- ${risk}`);
    }
    console.log('');
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  const manifest = readManifest();
  const roots = describeExternalSurfaceRoots();

  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify({ ...manifest, externalRoots: roots }, null, 2)}\n`);
    return;
  }

  printText(manifest);
}

main();
