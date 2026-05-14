#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

type Rule = {
  id: string;
  description: string;
  pattern: RegExp;
};

type Finding = {
  ruleId: string;
  description: string;
  file: string;
  line: number;
  preview: string;
};

const RULES: Rule[] = [
  {
    id: 'personal-workspace-path',
    description: 'Caminho pessoal de workspace ainda versionado.',
    pattern: /C:(?:\/|\\)TESTES DEV/i,
  },
  {
    id: 'personal-user-profile',
    description: 'Perfil de usuario pessoal ainda versionado.',
    pattern: /C:\\Users\\ermys/i,
  },
  {
    id: 'personal-handle',
    description: 'Handle pessoal ainda exposto em arquivo rastreado.',
    pattern: /greyveritrakkj|site-greyveritrakkjs-projects|ermys\.zavorth-zavorthBridge|"publisher"\s*:\s*"ermys"/i,
  },
  {
    id: 'query-token-auth',
    description: 'Token ainda aparece em query string.',
    pattern: /[?&]token=/i,
  },
  {
    id: 'wildcard-cors',
    description: 'CORS permissivo por wildcard ainda presente.',
    pattern: /origin\s*\|\|\s*['"]\*['"]/i,
  },
  {
    id: 'predictable-remote-password',
    description: 'Default previsivel de senha remota ainda presente.',
    pattern: /['"]zavorth-remote['"]/i,
  },
];

const BINARY_EXTENSIONS = new Set([
  '.db',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.mp4',
  '.pdf',
  '.zip',
  '.woff',
  '.woff2',
  '.ttf',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
]);

function listTrackedFiles(repoRoot: string): string[] {
  const raw = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return raw
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function shouldSkipFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  return (
    normalized.startsWith('data/') ||
    normalized.startsWith('tmp/') ||
    normalized.startsWith('dist/') ||
    normalized === 'scripts/release-hygiene-scan.ts' ||
    normalized === '.env' ||
    normalized.endsWith('.lock-hash')
  );
}

function readTextFile(fullPath: string): string | null {
  try {
    const buffer = fs.readFileSync(fullPath);
    if (buffer.includes(0)) {
      return null;
    }

    return buffer.toString('utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function scanFile(relativePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (!rule.pattern.test(line)) {
        continue;
      }

      findings.push({
        ruleId: rule.id,
        description: rule.description,
        file: relativePath,
        line: index + 1,
        preview: line.trim(),
      });
    }
  });

  return findings;
}

function runPublicIdentityGate(repoRoot: string): string | null {
  try {
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'zavorth-public-identity-scan.mjs')], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return null;
  } catch (error) {
    const typed = error as Error & { stdout?: string; stderr?: string };
    return `${typed.stdout || ''}${typed.stderr || ''}`.trim() || typed.message;
  }
}

function main() {
  const repoRoot = process.cwd();
  const identityFailure = runPublicIdentityGate(repoRoot);
  const trackedFiles = listTrackedFiles(repoRoot);
  const findings: Finding[] = [];

  for (const relativePath of trackedFiles) {
    if (shouldSkipFile(relativePath)) {
      continue;
    }

    const fullPath = path.join(repoRoot, relativePath);
    const content = readTextFile(fullPath);
    if (content === null) {
      continue;
    }

    findings.push(...scanFile(relativePath, content));
  }

  if (!identityFailure && findings.length === 0) {
    console.log('[release-scan] OK: nenhum marcador critico de release hygiene encontrado em arquivos rastreados.');
    return;
  }

  if (identityFailure) {
    console.error('[release-scan] Falha no gate de identidade publica Zavorth.');
    console.error(identityFailure);
  }
  if (findings.length > 0) {
    console.error(`[release-scan] Falha: ${findings.length} marcador(es) critico(s) encontrados.`);
  }
  for (const finding of findings) {
    console.error(
      `- ${finding.ruleId} | ${finding.file}:${finding.line} | ${finding.description} | ${finding.preview}`,
    );
  }
  process.exitCode = 1;
}

main();
