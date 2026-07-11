import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { MemoryDraftStoreService } from '../src/services/MemoryDraftStoreService.js';
import { MemoryService } from '../src/services/MemoryService.js';

async function main(): Promise<void> {
  const asJson = process.argv.includes('--json');
  const asCheck = process.argv.includes('--check');
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const action = String(args[0] || 'list').toLowerCase();

  if (asCheck) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mdraft-'));
    const storePath = path.join(tempDir, 'memory-drafts.json');
    const store = new MemoryDraftStoreService({ storePath });
    const memory = new MemoryService({ draftStore: store });
    // Full promote path: autoExtract draft-only → MemoryService.promoteMemoryDraft → durable recall.
    const extracted = await memory.autoExtract(
      'check-user',
      'Meu nome e Check User e prefiro dark mode.',
      'Ok.',
    );
    const pending = memory.listMemoryDrafts('check-user');
    const draft = pending.find((item) => item.key === 'preferencia' || item.key === 'nome') || pending[0];
    if (!draft || extracted.persisted !== false || extracted.mode !== 'draft-only') {
      process.stdout.write(asJson ? '{"ok":false}\n' : 'memory-drafts check: fail (draft-only extract)\n');
      process.exitCode = 1;
      return;
    }
    const beforePromote = await memory.recall('check-user', draft.key);
    const promoted = await memory.promoteMemoryDraft(draft.id, { actorUserId: 'check-user' });
    const recalled = await memory.recall('check-user', draft.key);
    await memory.forget('check-user', draft.key).catch(() => false);
    const ok = beforePromote === null
      && promoted?.status === 'promoted'
      && typeof recalled === 'string'
      && recalled.length > 0;
    const payload = {
      ok,
      draftKey: draft.key,
      recalled,
      promoted: promoted?.status || null,
      extractMode: extracted.mode,
      note: 'check verifies autoExtract draft-only + MemoryService.promoteMemoryDraft',
    };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `memory-drafts check: ${ok ? 'pass' : 'fail'}\n`);
    process.exitCode = ok ? 0 : 1;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup */
    }
    return;
  }

  const store = new MemoryDraftStoreService({ projectRoot: process.cwd() });
  const memory = new MemoryService();

  if (action === 'extract-demo') {
    const result = await memory.autoExtract(
      'demo-user',
      'Meu nome e Demo User e prefiro respostas curtas.',
      'Ok.',
    );
    const snapshot = store.snapshot('demo-user');
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ result, snapshot }, null, 2)}\n`);
    } else {
      process.stdout.write(`${store.renderText(snapshot)}\n`);
      process.stdout.write(`autoExtract persisted=${result.persisted} mode=${result.mode} candidates=${result.candidates.length}\n`);
    }
    return;
  }

  if (action === 'promote') {
    const id = args[1];
    if (!id) {
      process.stderr.write('Usage: memory-drafts promote <id>\n');
      process.exitCode = 1;
      return;
    }
    const item = await memory.promoteMemoryDraft(id);
    if (!item) {
      process.stderr.write(`Promote failed for id: ${id}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(asJson ? `${JSON.stringify(item, null, 2)}\n` : `promoted ${item.id} into durable memory\n`);
    return;
  }

  if (action === 'forget') {
    const id = args[1];
    const item = id ? memory.forgetMemoryDraft(id) : null;
    if (!item) {
      process.stderr.write('Usage: memory-drafts forget <id>\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write(asJson ? `${JSON.stringify(item, null, 2)}\n` : `forgotten ${item.id}\n`);
    return;
  }

  const snapshot = store.snapshot();
  process.stdout.write(asJson ? `${JSON.stringify(snapshot, null, 2)}\n` : `${store.renderText(snapshot)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
