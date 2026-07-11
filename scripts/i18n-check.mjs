#!/usr/bin/env node
/**
 * i18n completeness check for product-critical locales (en-US + pt-BR).
 *
 * - Loads YAML namespaces under src/i18n/locales
 * - Flattens nested keys
 * - Requires en-US keys present in pt-BR for required namespaces
 * - Requires Proof OS product keys in en-US proof-os namespace
 *
 * Usage:
 *   node scripts/i18n-check.mjs
 *   node scripts/i18n-check.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');

const REQUIRED_LOCALES = ['en-US', 'pt-BR'];
const REQUIRED_NAMESPACES = ['common', 'cli', 'desktop', 'proof-os'];

/** Product language keys that must exist under en-US/proof-os.yaml (flattened). */
const REQUIRED_PROOF_OS_KEYS = [
  'proof.title',
  'proof.ledger',
  'proof.empty',
  'approval.title',
  'approval.decide',
  'riskBudget.title',
  'riskBudget.observer',
  'riskBudget.operator',
  'riskBudget.autopilot',
  'changePreview.title',
  'changePreview.limited',
  'memoryPrivacy.title',
  'memoryPrivacy.why',
  'memoryPrivacy.forget',
  'honesty.live',
  'honesty.catalogOnly',
  'honesty.needsSetup',
  'absorb.riskReport',
  'absorb.quarantine',
  'migration.title',
  'migration.profile',
];

const wantJson = process.argv.includes('--json');

function flattenKeys(obj, prefix = '') {
  const keys = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return keys;
  }
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      keys.push(full);
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    }
  }
  return keys;
}

function loadNamespace(locale, ns) {
  const fp = path.join(LOCALES_DIR, locale, `${ns}.yaml`);
  if (!fs.existsSync(fp)) {
    return { path: fp, exists: false, keys: [], error: null };
  }
  try {
    const content = fs.readFileSync(fp, 'utf8');
    const data = yaml.load(content) || {};
    const keys = flattenKeys(typeof data === 'object' && data !== null ? data : {});
    return { path: fp, exists: true, keys, error: null };
  } catch (err) {
    return {
      path: fp,
      exists: true,
      keys: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function main() {
  const namespaces = {};
  const missingInPtBr = [];
  const missingProofOs = [];
  const missingFiles = [];
  const parseErrors = [];
  let enKeyCount = 0;
  let ptKeyCount = 0;
  let okPairs = 0;

  for (const ns of REQUIRED_NAMESPACES) {
    const en = loadNamespace('en-US', ns);
    const pt = loadNamespace('pt-BR', ns);

    namespaces[ns] = {
      enUS: {
        path: en.path,
        exists: en.exists,
        keyCount: en.keys.length,
        error: en.error,
      },
      ptBR: {
        path: pt.path,
        exists: pt.exists,
        keyCount: pt.keys.length,
        error: pt.error,
      },
      missingInPtBr: [],
    };

    if (!en.exists) missingFiles.push(en.path);
    if (!pt.exists) missingFiles.push(pt.path);
    if (en.error) parseErrors.push({ path: en.path, error: en.error });
    if (pt.error) parseErrors.push({ path: pt.path, error: pt.error });

    enKeyCount += en.keys.length;
    ptKeyCount += pt.keys.length;

    const ptSet = new Set(pt.keys);
    for (const key of en.keys) {
      if (!ptSet.has(key)) {
        const entry = `${ns}.${key}`;
        missingInPtBr.push(entry);
        namespaces[ns].missingInPtBr.push(key);
      } else {
        okPairs += 1;
      }
    }

    if (ns === 'proof-os') {
      const enSet = new Set(en.keys);
      for (const key of REQUIRED_PROOF_OS_KEYS) {
        if (!enSet.has(key)) {
          missingProofOs.push(key);
        }
      }
    }
  }

  const failed =
    missingFiles.length > 0
    || parseErrors.length > 0
    || missingInPtBr.length > 0
    || missingProofOs.length > 0;

  const summary = {
    ok: !failed,
    locales: REQUIRED_LOCALES,
    namespaces: REQUIRED_NAMESPACES,
    enKeyCount,
    ptKeyCount,
    okPairs,
    missingInPtBrCount: missingInPtBr.length,
    missingProofOsCount: missingProofOs.length,
    missingFilesCount: missingFiles.length,
    parseErrorsCount: parseErrors.length,
    missingInPtBr: missingInPtBr.slice(0, 200),
    missingProofOs,
    missingFiles,
    parseErrors,
    byNamespace: namespaces,
  };

  if (wantJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('i18n:check — en-US / pt-BR completeness');
    console.log(`  namespaces: ${REQUIRED_NAMESPACES.join(', ')}`);
    console.log(`  en-US keys: ${enKeyCount}`);
    console.log(`  pt-BR keys: ${ptKeyCount}`);
    console.log(`  matched en→pt pairs: ${okPairs}`);
    console.log(`  missing in pt-BR: ${missingInPtBr.length}`);
    console.log(`  missing required proof-os (en-US): ${missingProofOs.length}`);
    console.log(`  missing files: ${missingFiles.length}`);
    console.log(`  parse errors: ${parseErrors.length}`);

    if (missingFiles.length) {
      console.log('\nMissing files:');
      for (const f of missingFiles) console.log(`  - ${f}`);
    }
    if (parseErrors.length) {
      console.log('\nParse errors:');
      for (const e of parseErrors) console.log(`  - ${e.path}: ${e.error}`);
    }
    if (missingProofOs.length) {
      console.log('\nRequired Proof OS keys missing from en-US/proof-os.yaml:');
      for (const k of missingProofOs) console.log(`  - ${k}`);
    }
    if (missingInPtBr.length) {
      console.log('\nKeys present in en-US but missing in pt-BR:');
      for (const k of missingInPtBr.slice(0, 50)) console.log(`  - ${k}`);
      if (missingInPtBr.length > 50) {
        console.log(`  ... and ${missingInPtBr.length - 50} more`);
      }
    }

    console.log(failed ? '\nResult: FAIL' : '\nResult: OK');
  }

  process.exit(failed ? 1 : 0);
}

main();
