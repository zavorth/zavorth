import { SharedSurfaceSlashEnhancementCommandPack } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceSlashEnhancementCommandPack.js';
import { SessionModelRouteService } from '../../../src/services/SessionModelRouteService.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('SharedSurfaceSlashEnhancementCommandPack', () => {
  let storageDir: string;
  let replies: string[];
  let ctx: any;

  beforeEach(() => {
    storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slash-'));
    // Isolate session model storage
    (SessionModelRouteService as any).instance = new SessionModelRouteService({ storageDir });
    replies = [];
    ctx = {
      platform: 'web',
      chatId: 'chat-1',
      userId: 'user-1',
      sessionId: 'sess-slash-1',
      reply: async (text: string) => {
        replies.push(text);
      },
    };
  });

  afterEach(() => {
    (SessionModelRouteService as any).instance = null;
    fs.rmSync(storageDir, { recursive: true, force: true });
  });

  it('handles /model set and status', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/model', 'gpt-4o-mini openai')).toBe(true);
    expect(replies[0]).toMatch(/Session model updated/i);

    replies = [];
    expect(await pack.maybeHandle(ctx, '/model', 'status')).toBe(true);
    expect(replies[0]).toContain('gpt-4o-mini');
  });

  it('handles /export help when empty transcript', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/export', 'markdown')).toBe(true);
    expect(replies[0]).toMatch(/Session export|Nenhuma mensagem/i);
  });

  it('handles /learn-skill usage without source', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/learn-skill', '')).toBe(true);
    expect(replies[0]).toMatch(/Learn skill/i);
  });

  it('handles /consensus help and preview on shared surface', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/consensus', 'help')).toBe(true);
    expect(replies[0]).toMatch(/zavorth consensus|\/consensus/i);

    replies = [];
    expect(await pack.maybeHandle(ctx, '/consensus', 'preview')).toBe(true);
    expect(replies[0]).toMatch(/Consensus/i);
  });

  it('parses apply without consent as approval-required path', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    // inline notes source + apply without consent
    await pack.maybeHandle(ctx, '/learn-skill', 'apply my release checklist notes');
    // without --consent this should not install; status in reply
    expect(replies[0]).toMatch(/Status:|approval|preview|Apply requested/i);
  });

  it('ignores unrelated commands', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/help', '')).toBe(false);
  });

  it('/learn help prefers ordinal forms over long <id> walls', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/learn', 'help')).toBe(true);
    const text = replies[0] || '';
    expect(text).toMatch(/\/learn promote 1/);
    expect(text).toMatch(/\/learn forget 1/);
    expect(text).toMatch(/\/learn show 1/);
    expect(text).not.toMatch(/\/learn promote <id>/);
  });

  it('/learn promote with a long unknown id steers to ordinal tip', async () => {
    const pack = new SharedSurfaceSlashEnhancementCommandPack();
    expect(await pack.maybeHandle(ctx, '/learn', 'promote totally-unknown-draft-id-abcdef')).toBe(true);
    expect(replies[0]).toMatch(/Use \/learn promote 1 \(from \/learn list\), not a long id\./);
  });
});
