import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertSafeLocalStatePath,
  isPathInsideRoot,
  resolveZavorthLocalPath,
  safeWriteLocalTextFile,
} from '../../../src/services/security/LocalStatePathGuard.js';
import { assertPathUnderProjectRoot } from '../../../src/services/UniversalWorkspaceImportService.js';

describe('LocalStatePathGuard + project root pin (S2/S9)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-local-state-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('isPathInsideRoot rejects .. escape and absolute siblings', () => {
    const root = path.join(dir, 'proj');
    fs.mkdirSync(root, { recursive: true });
    expect(isPathInsideRoot(root, path.join(root, '.zavorth', 'a.json'))).toBe(true);
    expect(isPathInsideRoot(root, path.join(root, '..', 'outside'))).toBe(false);
    expect(isPathInsideRoot(root, path.join(dir, 'sibling'))).toBe(false);
  });

  test('resolveZavorthLocalPath pins under project/.zavorth', () => {
    const root = path.join(dir, 'proj');
    fs.mkdirSync(root, { recursive: true });
    const ledger = resolveZavorthLocalPath(root, 'proof-ledger.jsonl');
    expect(ledger).toBe(path.join(root, '.zavorth', 'proof-ledger.jsonl'));
    expect(() => resolveZavorthLocalPath(root, '..', 'escape.json')).toThrow(/escapes/);
  });

  test('assertPathUnderProjectRoot (S2) rejects target outside project', () => {
    const root = path.join(dir, 'proj');
    fs.mkdirSync(root, { recursive: true });
    expect(assertPathUnderProjectRoot(root, path.join(root, 'ok'), 'targetRoot')).toBe(
      path.resolve(root, 'ok'),
    );
    expect(() =>
      assertPathUnderProjectRoot(root, path.join(dir, 'escape'), 'targetRoot'),
    ).toThrow(/must stay under project root/);
    expect(() =>
      assertPathUnderProjectRoot(root, path.join(root, '..', 'escape'), 'quarantineRoot'),
    ).toThrow(/must stay under project root/);
  });

  test('safeWriteLocalTextFile writes content and refuses symlink overwrite', () => {
    const file = path.join(dir, 'state.json');
    safeWriteLocalTextFile(file, '{"ok":true}\n');
    expect(fs.readFileSync(file, 'utf8')).toContain('"ok":true');

    // On Windows, creating symlinks may require privileges — skip if link fails.
    const link = path.join(dir, 'link.json');
    const target = path.join(dir, 'target-outside.txt');
    fs.writeFileSync(target, 'x', 'utf8');
    try {
      fs.symlinkSync(target, link);
    } catch {
      return;
    }
    expect(() => safeWriteLocalTextFile(link, 'nope')).toThrow(/symlink/i);
  });

  test('assertSafeLocalStatePath detects realpath escape when possible', () => {
    const root = path.join(dir, 'root');
    fs.mkdirSync(root, { recursive: true });
    const inside = path.join(root, 'ok.json');
    fs.writeFileSync(inside, '{}', 'utf8');
    expect(assertSafeLocalStatePath(root, inside, 'store')).toBeTruthy();
  });
});
