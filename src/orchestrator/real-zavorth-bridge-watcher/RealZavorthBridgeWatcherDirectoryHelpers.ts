import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export function normalizeComparisonValue(rawValue: string | null | undefined): string {
  return replaceChar(String(rawValue || '').trim(), '\\', '/').toLowerCase();
}

export function isLocalDirectoryInspectionPrompt(prompt: string): boolean {
  return extractDirectoryHints(prompt).length > 0;
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

  for (const candidate of extractQuotedSegments(source, 260)) {
    if (candidate) {
      hints.add(candidate);
    }
  }
  for (const candidate of extractAbsoluteWindowsPathSegments(source)) {
    if (candidate) {
      hints.add(candidate);
    }
  }

  return Array.from(hints).map((hint) => hint.trim()).filter(Boolean);
}

export function resolveDirectoryHint(hint: string, workspacePath: string): string | null {
  const trimmedHint = stripOuterQuotes(String(hint || '').trim());
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

  for (const ancestor of listAncestorDirectories(workspacePath)) {
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

    const matchedEntry = safeReadDirectory(root).find(
      (entry) => entry.isDirectory() && pathTokensRoughlyMatch(entry.name, normalizedHint),
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
  const source = removeCombiningMarks(String(value || '').trim().toLowerCase().normalize('NFD'));
  let output = '';
  let previousWasSlash = false;
  let previousWasSpace = false;
  for (const char of source) {
    const normalizedChar = char === '\\' ? '/' : char;
    if (normalizedChar === '/') {
      if (!previousWasSlash) {
        output += normalizedChar;
      }
      previousWasSlash = true;
      previousWasSpace = false;
      continue;
    }
    previousWasSlash = false;
    if (normalizedChar.trim().length === 0) {
      if (!previousWasSpace) {
        output += ' ';
      }
      previousWasSpace = true;
      continue;
    }
    previousWasSpace = false;
    if (isPathTokenChar(normalizedChar)) {
      output += normalizedChar;
    }
  }
  return output.trim();
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
  return singularizePathToken(normalizedLeft) === singularizePathToken(normalizedRight);
}

export function isExistingDirectory(candidate: string): boolean {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
  } catch (error: unknown) {
    logger.warn('[Real Zavorth Bridge Watcher Directory Helpers] filesystem operation failed', error);
    return false;
  }
}

export function safeReadDirectory(candidate: string): fs.Dirent[] {
  try {
    return fs.readdirSync(candidate, { withFileTypes: true });
  } catch (error: unknown) {
    logger.warn('[Real Zavorth Bridge Watcher Directory Helpers] filesystem operation failed', error);
    return [];
  }
}

function extractQuotedSegments(source: string, maxLength: number): string[] {
  const quoteChars = new Set(['"', "'", '`']);
  const segments: string[] = [];
  let quote: string | null = null;
  let current = '';
  for (const char of source) {
    if (!quote && quoteChars.has(char)) {
      quote = char;
      current = '';
      continue;
    }
    if (quote && char === quote) {
      const candidate = current.trim();
      if (candidate && candidate.length <= maxLength) {
        segments.push(candidate);
      }
      quote = null;
      current = '';
      continue;
    }
    if (quote) {
      if (char === '\r' || char === '\n') {
        quote = null;
        current = '';
        continue;
      }
      current += char;
    }
  }
  return segments;
}

function extractAbsoluteWindowsPathSegments(source: string): string[] {
  const segments: string[] = [];
  for (let index = 0; index < source.length - 2; index += 1) {
    const drive = source[index] || '';
    const colon = source[index + 1] || '';
    const slash = source[index + 2] || '';
    if (!isAsciiLetter(drive) || colon !== ':' || (slash !== '\\' && slash !== '/')) {
      continue;
    }
    let cursor = index;
    let segment = '';
    while (cursor < source.length) {
      const char = source[cursor] || '';
      if (char === '\r' || char === '\n' || char === '"' || char === "'" || char === '`') {
        break;
      }
      segment += char;
      cursor += 1;
    }
    const candidate = segment.trim();
    if (candidate) {
      segments.push(candidate);
    }
    index = Math.max(index, cursor - 1);
  }
  return segments;
}

function stripOuterQuotes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isQuoteChar(value[start] || '')) {
    start += 1;
  }
  while (end > start && isQuoteChar(value[end - 1] || '')) {
    end -= 1;
  }
  return value.slice(start, end).trim();
}

function isQuoteChar(char: string): boolean {
  return char === '"' || char === "'" || char === '`';
}

function removeCombiningMarks(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join('');
}

function replaceChar(value: string, from: string, to: string): string {
  let output = '';
  for (const char of value) {
    output += char === from ? to : char;
  }
  return output;
}

function singularizePathToken(value: string): string {
  return value
    .split(' ')
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
    .join(' ');
}

function isAsciiLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isPathTokenChar(char: string): boolean {
  return (char >= 'a' && char <= 'z') ||
    (char >= '0' && char <= '9') ||
    char === '.' ||
    char === '_' ||
    char === '-' ||
    char === '/' ||
    char === ' ';
}
