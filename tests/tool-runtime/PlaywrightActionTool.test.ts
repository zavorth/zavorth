import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PlaywrightActionTool } from '../../src/tool-runtime/tools/browser/PlaywrightActionTool';

describe('PlaywrightActionTool', () => {
  it('blocks external URLs inside the tool before launching the browser', async () => {
    const tool = new PlaywrightActionTool();
    const result = await tool.execute({
      action: 'navigate',
      url: 'https://example.com',
    }, {
      sessionId: 'playwright-block-test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ZAVORTH_PLAYWRIGHT_ALLOWED_HOSTS/);
  });

  it('blocks blocked file paths inside the tool before navigation', async () => {
    const tool = new PlaywrightActionTool();
    const blockedUrl = pathToFileURL(path.join(os.homedir(), '.ssh', 'id_rsa')).toString();

    const result = await tool.execute({
      action: 'navigate',
      url: blockedUrl,
    }, {
      sessionId: 'playwright-file-block-test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/file policy|politica de arquivo/i);
  });

  it('self-heals a broken browser selector using local heuristics', async () => {
    const tool = new PlaywrightActionTool();
    const page = {
      click: jest.fn(async (selector: string) => {
        if (selector === '[data-testid="submit-order"]') {
          throw new Error('selector changed');
        }
      }),
      fill: jest.fn(),
      locator: jest.fn(() => ({
        innerText: jest.fn(async () => 'clicked'),
      })),
      screenshot: jest.fn(async () => Buffer.from('fake-image')),
      title: jest.fn(async () => 'Repair fixture'),
      url: jest.fn(() => 'file:///repair-fixture.html'),
      waitForTimeout: jest.fn(async () => undefined),
      evaluate: jest.fn(async () => ([
        {
          selector: '#finalize-order',
          textHint: 'Submit order',
          reason: 'finalize-order | submit order | submit order',
          score: 10,
        },
      ])),
    };
    jest.spyOn(tool as unknown as { getSession: jest.Mock }, 'getSession').mockResolvedValue({
      browser: {},
      page,
      createdAt: '2026-04-18T12:00:00.000Z',
      lastActionAt: '2026-04-18T12:00:00.000Z',
      actionCount: 0,
      lastKnownUrl: 'file:///repair-fixture.html',
      lastTargetPolicy: null,
      lastSelfHealing: null,
    });

    const clicked = await tool.execute({
      action: 'click',
      selector: '[data-testid="submit-order"]',
    }, {
      sessionId: 'playwright-heal-test',
    });

    expect(clicked.success).toBe(true);
    expect(page.click).toHaveBeenNthCalledWith(1, '[data-testid="submit-order"]', { timeout: 10000 });
    expect(page.click).toHaveBeenNthCalledWith(2, '#finalize-order', { timeout: 10000 });
    expect(clicked.data?.selfHealing).toEqual(expect.objectContaining({
      healed: true,
      strategy: 'heuristic',
      originalSelector: '[data-testid="submit-order"]',
      resolvedSelector: '#finalize-order',
    }));
  });

  it('validates schema with useRealProfile and allowedDomains', () => {
    const tool = new PlaywrightActionTool();
    const parsed = tool.schema.safeParse({
      action: 'navigate',
      url: 'https://github.com',
      useRealProfile: true,
      allowedDomains: ['*.github.com'],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.useRealProfile).toBe(true);
      expect(parsed.data.allowedDomains).toEqual(['*.github.com']);
    }
  });

  it('disposes ephemeral snapshot directory when browser session is closed', async () => {
    const tool = new PlaywrightActionTool();
    const mockSnapshotDir = path.join(os.tmpdir(), `zavorth-vault-test-close-${Date.now()}`);
    fs.mkdirSync(mockSnapshotDir, { recursive: true });
    fs.writeFileSync(path.join(mockSnapshotDir, 'test.txt'), 'ephemeral');

    const sessionsMap = (PlaywrightActionTool as unknown as { sessions: Map<string, unknown> }).sessions;
    sessionsMap.set('test-dispose-session', {
      browser: { close: jest.fn(async () => undefined) },
      page: { close: jest.fn(async () => undefined) },
      createdAt: new Date().toISOString(),
      lastActionAt: new Date().toISOString(),
      actionCount: 1,
      lastKnownUrl: null,
      lastTargetPolicy: null,
      lastSelfHealing: null,
      snapshotDir: mockSnapshotDir,
    });

    expect(fs.existsSync(mockSnapshotDir)).toBe(true);

    const closeResult = await tool.execute({
      action: 'close',
    }, {
      sessionId: 'test-dispose-session',
    });

    expect(closeResult.success).toBe(true);
    expect(fs.existsSync(mockSnapshotDir)).toBe(false);
  });
});
