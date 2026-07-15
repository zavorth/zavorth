import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_URL,
  formatScaffoldCopyBlock,
  normalizePreviewUrl,
  VIBE_SCAFFOLD_HINTS,
} from '../src/vibe/vibeScaffoldHints';

describe('vibeScaffoldHints', () => {
  it('exposes non-empty scaffold catalogs', () => {
    expect(VIBE_SCAFFOLD_HINTS.length).toBeGreaterThan(0);
    for (const hint of VIBE_SCAFFOLD_HINTS) {
      expect(hint.steps.length).toBeGreaterThan(0);
      expect(hint.steps.every((step) => step.command.trim().length > 0)).toBe(true);
    }
  });

  it('normalizes localhost preview URLs', () => {
    expect(normalizePreviewUrl('localhost:5173')).toBe('http://localhost:5173');
    expect(normalizePreviewUrl('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(normalizePreviewUrl('')).toBe(DEFAULT_PREVIEW_URL);
    expect(normalizePreviewUrl('not a url')).toBe(DEFAULT_PREVIEW_URL);
  });

  it('formats copyable scaffold blocks', () => {
    const block = formatScaffoldCopyBlock(VIBE_SCAFFOLD_HINTS[0]);
    expect(block).toContain(VIBE_SCAFFOLD_HINTS[0].title);
    expect(block).toContain(VIBE_SCAFFOLD_HINTS[0].steps[0].command);
  });
});
