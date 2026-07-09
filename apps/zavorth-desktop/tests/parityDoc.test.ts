import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const desktopRoot = resolve(__dirname, '..');
const monorepoParityPath = resolve(desktopRoot, '..', '..', 'docs', 'product', 'desktop-surface-parity.md');
const localParityPath = resolve(desktopRoot, 'docs', 'product', 'desktop-surface-parity.md');

function resolveParityDocPath(): string {
  if (existsSync(monorepoParityPath)) return monorepoParityPath;
  if (existsSync(localParityPath)) return localParityPath;
  throw new Error(
    `desktop-surface-parity.md not found at ${monorepoParityPath} or ${localParityPath}`,
  );
}

describe('desktop surface parity doc', () => {
  const path = resolveParityDocPath();
  const doc = readFileSync(path, 'utf8');

  it('exists and is non-empty', () => {
    expect(existsSync(path)).toBe(true);
    expect(doc.trim().length).toBeGreaterThan(200);
  });

  it('contains key headings', () => {
    expect(doc).toMatch(/#\s*Zavorth Desktop\s*[—-]\s*Surface Parity Matrix/i);
    expect(doc).toMatch(/##\s*Feature matrix/i);
    expect(doc).toMatch(/##\s*Desktop agent surfaces/i);
    expect(doc).toMatch(/##\s*Readiness contract/i);
    expect(doc).toMatch(/##\s*Legend/i);
  });

  it('marks Chat, Approvals, and Receipts as ready on Desktop', () => {
    // Rows use | Capability | Desktop | ... with ✅ in the Desktop column.
    expect(doc).toMatch(/\|\s*Chat\s*\/\s*ask\s*\|\s*✅/i);
    expect(doc).toMatch(/\|\s*Approvals\s*\|\s*✅/i);
    expect(doc).toMatch(/\|\s*Receipts\s*\/\s*proof\s*\|\s*✅/i);
  });

  it('documents in-thread approvals and agent surface inventory', () => {
    expect(doc).toMatch(/Approvals in-thread/i);
    expect(doc).toMatch(/Status stack/i);
    expect(doc).toMatch(/Plan card/i);
    expect(doc).toMatch(/Open-from-chat/i);
    expect(doc).toMatch(/Review ship bar/i);
    expect(doc).toMatch(/Trusted operator/i);
    expect(doc).toMatch(/Hunk approval/i);
    expect(doc).toMatch(/Run timeline/i);
    expect(doc).toMatch(/Agent strip/i);
    expect(doc).toMatch(/CC wizards/i);
  });
});
