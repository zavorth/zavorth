import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export function normalizeComparisonValue(rawValue: string | null | undefined): string {
  return String(rawValue || '')
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase();
}

export function isLocalDirectoryInspectionPrompt(prompt: string): boolean {
  const normalized = String(prompt || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const mentionsDirectory = [/\bpasta\b/, /\bfolder\b/, /\bdiretorio\b/, /\bdirectory\b/].some((pattern) =>
    pattern.test(normalized),
  );
  const asksToInspect = [
    /\bo que tem\b/,
    /\bverifique\b/,
    /\bveja\b/,
    /\bacess[ea]\b/,
    /\bmostr[ea]\b/,
    /\bdiga\b/,
    /\blist[ea]\b/,
    /\bconteudo\b/,
    /\bdentro\b/,
    /\bshow\b/,
    /\blist\b/,
    /\bwhat is inside\b/,
    /\bwhat's inside\b/,
  ].some((pattern) => pattern.test(normalized));

  return mentionsDirectory && asksToInspect;
}

export function resolveDirectoryListingTarget(prompt: string, workspace: string): string | null {
  const workspacePath = path.resolve(workspace || process.cwd());
  const hints = extractDirectoryHints(prompt);

  for (const hint of hints) {
    const resolved = resolveDirectoryHint(hint, workspacePath);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export function extractDirectoryHints(prompt: string): string[] {
  const hints = new Set<string>();
  const source = String(prompt || '');

  for (const match of source.matchAll(/["'`]{1}([^"'`\r\n]{1,260})["'`]{1}/g)) {
    const candidate = String(match[1] || '').trim();
    if (candidate) {
      hints.add(candidate);
    }
  }

  for (const match of source.matchAll(/\b[A-Za-z]:[\\/][^\r\n"'`]+/g)) {
    const candidate = String(match[0] || '').trim();
    if (candidate) {
      hints.add(candidate);
    }
  }

  const namedPatterns = [
    /\b(?:pasta|folder|diretorio|directory)\s+(?:chamada|chamado|named)\s+(.+?)(?=$|[?.!,]|\s+(?:e|para|pra)\s+)/i,
    /\b(?:na|minha)\s+(?:pasta|folder|diretorio|directory)\s+(.+?)(?=$|[?.!,]|\s+(?:e|para|pra)\s+)/i,
    /\b(?:pasta|folder|diretorio|directory)\s+(.+?)(?=$|[?.!,]|\s+(?:e|para|pra)\s+)/i,
  ];

  for (const pattern of namedPatterns) {
    const match = source.match(pattern);
    const candidate = String(match?.[1] || '')
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '');
    if (candidate) {
      hints.add(candidate);
    }
  }

  return Array.from(hints)
    .map((hint) => hint.trim())
    .filter(Boolean);
}

export function resolveDirectoryHint(hint: string, workspacePath: string): string | null {
  const trimmedHint = String(hint || '').trim().replace(/^['"`]+|['"`]+$/g, '');
  if (!trimmedHint) {
    return null;
  }

  const directCandidates = new Set<string>();
  if (path.isAbsolute(trimmedHint)) {
    directCandidates.add(path.resolve(trimmedHint));
  } else {
    directCandidates.add(path.resolve(workspacePath, trimmedHint));
    directCandidates.add(path.resolve(path.dirname(workspacePath), trimmedHint));
    directCandidates.add(path.resolve(path.dirname(path.dirname(workspacePath)), trimmedHint));
    directCandidates.add(path.resolve(process.cwd(), trimmedHint));
  }

  for (const candidate of directCandidates) {
    if (isExistingDirectory(candidate)) {
      return candidate;
    }
  }

  const normalizedHint = normalizePathToken(trimmedHint);
  if (!normalizedHint) {
    return null;
  }

  const ancestors = listAncestorDirectories(workspacePath);
  for (const ancestor of ancestors) {
    if (pathTokensRoughlyMatch(path.basename(ancestor), normalizedHint) && isExistingDirectory(ancestor)) {
      return ancestor;
    }
  }

  const searchRoots = [
    workspacePath,
    path.dirname(workspacePath),
    path.dirname(path.dirname(workspacePath)),
    process.cwd(),
  ];
  for (const root of searchRoots) {
    if (!isExistingDirectory(root)) {
      continue;
    }

    const directChild = path.join(root, trimmedHint);
    if (isExistingDirectory(directChild)) {
      return directChild;
    }

    const entries = safeReadDirectory(root);
    const matchedEntry = entries.find(
      (entry) =>
        entry.isDirectory() &&
        pathTokensRoughlyMatch(entry.name, normalizedHint),
    );
    if (matchedEntry) {
      return path.join(root, matchedEntry.name);
    }
  }

  return null;
}

export function listAncestorDirectories(startPath: string): string[] {
  const ancestors: string[] = [];
  let current = path.resolve(startPath);
  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return ancestors;
}

export function normalizePathToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/]+/g, '/')
    .replace(/[^a-z0-9._ -]/g, '')
    .replace(/\s+/g, ' ');
}

export function pathTokensRoughlyMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizePathToken(left);
  const normalizedRight = normalizePathToken(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const singularize = (value: string): string =>
    value
      .split(' ')
      .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
      .join(' ');

  return singularize(normalizedLeft) === singularize(normalizedRight);
}

export function isExistingDirectory(candidate: string): boolean {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
  } catch (error) { logger.warn('[Real Zavorth Bridge Watcher Directory Helpers] filesystem operation failed', error); return false; }
}

export function safeReadDirectory(candidate: string): fs.Dirent[] {
  try {
    return fs.readdirSync(candidate, { withFileTypes: true });
  } catch (error) { logger.warn('[Real Zavorth Bridge Watcher Directory Helpers] filesystem operation failed', error); return []; }
}
