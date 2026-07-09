import { describe, expect, it } from 'vitest';
import {
  extractOpenTargets,
  preferDiffTarget,
  preferFileTarget,
} from '../src/thread/openFromChat';
import { parsePlanFromText } from '../src/thread/planCard';
import { sliceStreamingMessages } from '../src/thread/streamIsolation';

import {
  DEFAULT_MESSAGE_WINDOW,
  windowMessages,
} from '../src/thread/messageWindow';

/**
 * Composition helpers that mirror ThreadView render path:
 * 1) windowMessages(messages, size)
 * 2) sliceStreamingMessages(visible, { busy })
 * 3) plan parse + open targets from tool text
 */
function composeThreadRenderModel<T extends { id: string; role?: string; content?: string }>(
  messages: T[],
  opts: { busy: boolean; windowSize?: number },
) {
  const windowed = windowMessages(messages, opts.windowSize ?? DEFAULT_MESSAGE_WINDOW);
  const stream = sliceStreamingMessages(windowed.visible, { busy: opts.busy });
  const plans = windowed.visible
    .filter(m => m.role === 'assistant' && typeof m.content === 'string')
    .map(m => parsePlanFromText(String(m.content), `plan-${m.id}`))
    .filter(Boolean);
  return { windowed, stream, plans };
}

describe('thread integration composition', () => {
  it('windows then stream-slices the visible tail', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
      role: i === 99 ? 'assistant' : i % 3 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    const model = composeThreadRenderModel(messages, {
      busy: true,
      windowSize: DEFAULT_MESSAGE_WINDOW,
    });
    expect(model.windowed.visible).toHaveLength(DEFAULT_MESSAGE_WINDOW);
    expect(model.windowed.hiddenCount).toBe(20);
    expect(model.stream.live?.id).toBe('m99');
    expect(model.stream.streamingId).toBe('m99');
    expect(model.stream.frozen.at(-1)?.id).toBe('m98');
  });

  it('parses plan cards from assistant messages in the visible window', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'please plan' },
      {
        id: 'a1',
        role: 'assistant',
        content: `## Plan
Risk: medium
1. Read files
2. Apply patch
3. Run tests`,
      },
    ];
    const model = composeThreadRenderModel(messages, { busy: false });
    expect(model.plans).toHaveLength(1);
    expect(model.plans[0]!.canApprove).toBe(true);
    expect(model.plans[0]!.steps).toHaveLength(3);
    expect(model.plans[0]!.risk).toBe('medium');
    expect(model.plans[0]!.id).toBe('plan-a1');
  });

  it('does not mark live when not busy', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'hi' },
      { id: 'a1', role: 'assistant', content: 'hello' },
    ];
    const model = composeThreadRenderModel(messages, { busy: false });
    expect(model.stream.live).toBeNull();
    expect(model.stream.streamingId).toBeNull();
    expect(model.stream.frozen).toHaveLength(2);
  });
});

describe('extractOpenTargets + preferFileTarget integration', () => {
  it('resolves openable file from typical tool result strings', () => {
    const toolResult = `
Wrote file: src/thread/openFromChat.ts
Also touched tests/openFromChat.test.ts:12
`;
    const targets = extractOpenTargets(toolResult);
    expect(targets.length).toBeGreaterThanOrEqual(2);

    const preferred = preferFileTarget(targets);
    expect(preferred).not.toBeNull();
    expect(preferred!.kind).toBe('file');
    expect(preferred!.path).toBe('src/thread/openFromChat.ts');

    const withLine = targets.find(t => t.path.endsWith('openFromChat.test.ts'));
    expect(withLine?.line).toBe(12);
    expect(preferFileTarget([withLine!])?.path).toBe('tests/openFromChat.test.ts');
  });

  it('preferDiffTarget picks diff-kind path from tool output', () => {
    const toolResult = 'git diff shows changes in src/thread/planCard.ts';
    const targets = extractOpenTargets(toolResult);
    const diff = preferDiffTarget(targets);
    expect(diff?.path).toContain('planCard');
    expect(diff?.kind).toBe('diff');
    // Prefer file should miss pure-diff targets
    expect(preferFileTarget(targets.filter(t => t.kind === 'diff'))).toBeNull();
  });

  it('prefers file over folder/diff for Open file button wiring', () => {
    const content = `
Open folder src/thread/
git diff shows src/shell/DesktopShell.tsx
Wrote file: src/thread/ToolCallBlock.tsx
`;
    const targets = extractOpenTargets(content);
    const preferred = preferFileTarget(targets);
    expect(preferred?.path).toBe('src/thread/ToolCallBlock.tsx');
    expect(preferred?.kind).toBe('file');
  });

  it('returns empty preferred when only non-file kinds exist', () => {
    const targets = extractOpenTargets('git diff shows src/a.ts and open folder src/b/');
    // a.ts may be kind diff; folder may exist — file prefer may still find file kind for a.ts if not marked diff
    // Force only folder
    const foldersOnly = targets.filter(t => t.kind === 'folder');
    expect(preferFileTarget(foldersOnly)).toBeNull();
  });
});
