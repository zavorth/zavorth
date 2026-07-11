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
  const store = new MemoryDraftStoreService({ projectRoot: process.cwd() });

  if (asCheck) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mdraft-'));
    const tempStore = new MemoryDraftStoreService({
      storePath: path.join(tempDir, 'memory-drafts.json'),
    });
    const created = tempStore.addCandidates({
      userId: 'check-user',
      candidates: [{ key: 'preferencia', value: 'dark mode', category: 'preferencia' }],
    });
    const listed = tempStore.list('check-user', 'pending');
    const promoted = tempStore.promote(created[0].id);
    const ok = created.length === 1 && listed.length === 1 && promoted?.status === 'promoted';
    const payload = { ok, created: created.length, listed: listed.length, promoted: promoted?.status };
    process.stdout.write(asJson ? `${JSON.stringify(payload, null, 2)}\n` : `memory-drafts check: ${ok ? 'pass' : 'fail'}\n`);
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (action === 'extract-demo') {
    const memory = new MemoryService();
    const result = await memory.autoExtract(
      'demo-user',
      'My name is Demo User and I prefer short answers.',
      'Noted.',
    );
    const snapshot = store.snapshot('demo-user');
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ result, snapshot }, null, 2)}\n`);
    } else {
      process.stdout.write(`${store.renderText(snapshot)}\n`);
      process.stdout.write(`autoExtract persisted=${result.persisted} mode=${result.mode}\n`);
    }
    return;
  }

  if (action === 'promote') {
    const id = args[1];
    const item = id ? store.promote(id) : null;
    if (!item) {
      process.stderr.write('Usage: memory-drafts promote <id>\n');
      process.exitCode = 1;
      return;
    }
    const memory = new MemoryService();
    await memory.remember(item.userId, item.key, item.value, item.category);
    process.stdout.write(asJson ? `${JSON.stringify(item, null, 2)}\n` : `promoted ${item.id} -> memory\n`);
    return;
  }

  if (action === 'forget') {
    const id = args[1];
    const item = id ? store.forget(id) : null;
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
