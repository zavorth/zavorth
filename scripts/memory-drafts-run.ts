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
    const memory = new MemoryService();
    // Inject store via private field is not available; use promote API through a custom path:
    // Create draft, promote via store only after remember in this check.
    const created = store.addCandidates({
      userId: 'check-user',
      candidates: [{ key: 'preferencia', value: 'dark mode', category: 'preferencia' }],
    });
    if (created.length !== 1) {
      process.stdout.write(asJson ? '{"ok":false}\n' : 'memory-drafts check: fail (create)\n');
      process.exitCode = 1;
      return;
    }
    await memory.remember(created[0].userId, created[0].key, created[0].value, created[0].category);
    const promoted = store.promote(created[0].id, { actorUserId: 'check-user' });
    const recalled = await memory.recall('check-user', 'preferencia');
    await memory.forget('check-user', 'preferencia').catch(() => false);
    const ok = promoted?.status === 'promoted' && recalled === 'dark mode';
    const payload = {
      ok,
      recalled,
      promoted: promoted?.status || null,
      note: 'check verifies remember+promote order and ownership',
    };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `memory-drafts check: ${ok ? 'pass' : 'fail'}\n`);
    process.exitCode = ok ? 0 : 1;
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
