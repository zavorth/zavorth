import fs from 'node:fs';
import path from 'node:path';
import { redact } from './ExperienceSkillLearningModel.js';

export function readDraftSkillBodyRedacted(draftPath: string): string {
  try {
    const root = path.resolve(draftPath);
    const skillPath = path.resolve(root, 'SKILL.md');
    const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (!skillPath.startsWith(prefix) || !fs.existsSync(skillPath)) return '';
    return redact(fs.readFileSync(skillPath, 'utf8'));
  } catch {
    return '';
  }
}

export function buildSearchSnippet(source: string, tokens: string[]): string {
  const cleaned = redact(String(source || '').replace(/\s+/g, ' ').trim());
  if (!cleaned) return '';
  const max = 200;
  if (tokens.length === 0) return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
  const lower = cleaned.toLowerCase();
  let idx = -1;
  let matchLen = 0;
  for (const token of tokens) {
    const at = lower.indexOf(token.toLowerCase());
    if (at >= 0 && (idx < 0 || at < idx)) { idx = at; matchLen = token.length; }
  }
  if (idx < 0) return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
  const pad = Math.max(0, Math.floor((max - matchLen) / 2));
  let start = Math.max(0, idx - pad);
  const end = Math.min(cleaned.length, start + max);
  if (end - start < max) start = Math.max(0, end - max);
  let snippet = cleaned.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < cleaned.length) snippet = `${snippet}…`;
  return snippet.slice(0, max + 2);
}
