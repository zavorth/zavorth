/**
 * Dream consolidate preview last-run receipt (Package A).
 * Preview metadata only — never a durable promote.
 * Isolated module to avoid circular imports with KnowledgeFactsRecall.
 */

import fs from 'node:fs';
import path from 'node:path';

const DREAM_LAST_PREVIEW_REL = path.join('data', 'runtime', 'learned-knowledge', 'dream-last-preview.json');

export type DreamLastPreviewReceipt = {
  version: 'dream-last-preview/1';
  generatedAt: string;
  mode: 'preview';
  candidateCount: number;
  quarantineCount: number;
  actionCount: number;
  dreamStatus: string;
  durableMutation: false;
};

function isPathInside(child: string, parent: string): boolean {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  if (c === p) return true;
  const prefix = p.endsWith(path.sep) ? p : `${p}${path.sep}`;
  return c.startsWith(prefix);
}

export function dreamLastPreviewPath(projectRoot: string): string {
  const root = path.resolve(projectRoot);
  const file = path.join(root, DREAM_LAST_PREVIEW_REL);
  if (!isPathInside(file, root)) {
    throw new Error('dream receipt path escaped project root');
  }
  return file;
}

export function readDreamLastPreview(projectRoot: string): DreamLastPreviewReceipt | null {
  try {
    const file = dreamLastPreviewPath(projectRoot);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<DreamLastPreviewReceipt>;
    if (!raw || typeof raw.generatedAt !== 'string') return null;
    // Drop free-form fields that could carry untrusted session text.
    return {
      version: 'dream-last-preview/1',
      generatedAt: raw.generatedAt,
      mode: 'preview',
      candidateCount: Number(raw.candidateCount || 0),
      quarantineCount: Number(raw.quarantineCount || 0),
      actionCount: Number(raw.actionCount || 0),
      dreamStatus: String(raw.dreamStatus || 'unknown').slice(0, 64),
      durableMutation: false,
    };
  } catch {
    return null;
  }
}

export function writeDreamLastPreview(
  projectRoot: string,
  receipt: Omit<DreamLastPreviewReceipt, 'version' | 'mode' | 'durableMutation'>,
): void {
  try {
    const file = dreamLastPreviewPath(projectRoot);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body: DreamLastPreviewReceipt = {
      version: 'dream-last-preview/1',
      mode: 'preview',
      durableMutation: false,
      generatedAt: String(receipt.generatedAt || new Date().toISOString()).slice(0, 40),
      candidateCount: Math.max(0, Math.floor(Number(receipt.candidateCount || 0) || 0)),
      quarantineCount: Math.max(0, Math.floor(Number(receipt.quarantineCount || 0) || 0)),
      actionCount: Math.max(0, Math.floor(Number(receipt.actionCount || 0) || 0)),
      dreamStatus: String(receipt.dreamStatus || 'unknown').slice(0, 64),
    };
    fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  } catch {
    // best-effort only
  }
}
