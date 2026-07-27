/**
 * Generic external harness registry.
 * Register any CLI/ACP/HTTP/stdio executor as a read-only-default adapter.
 * No third-party product brands required.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type {
  ExternalHarnessAdapter,
  ExternalHarnessKind,
} from '../../contracts/UniversalPowerFabricContract.js';

type Runtime = {
  storeFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type Store = {
  version: 1;
  adapters: ExternalHarnessAdapter[];
};

export class ExternalHarnessRegistryService {
  private readonly storeFile: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.storeFile = path.resolve(
      runtime.storeFile
        || path.join(process.cwd(), '.zavorth', 'external-harnesses.json'),
    );
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public list(): ExternalHarnessAdapter[] {
    return this.load().adapters;
  }

  public register(input: {
    id?: string;
    label: string;
    kind?: ExternalHarnessKind;
    commandOrEndpoint?: string | null;
    notes?: string[];
  }): ExternalHarnessAdapter {
    const store = this.load();
    const id = slug(input.id || input.label);
    const existing = store.adapters.findIndex((a) => a.id === id);
    const adapter: ExternalHarnessAdapter = {
      id,
      label: String(input.label || id).slice(0, 120),
      kind: input.kind || inferKind(input.commandOrEndpoint || ''),
      status: input.commandOrEndpoint ? 'ready' : 'needs-configuration',
      commandOrEndpoint: input.commandOrEndpoint || null,
      readOnlyDefault: true,
      mutationRequiresApproval: true,
      notes: [
        ...(input.notes || []),
        'Read-only by default; mutations require explicit approval and receipts.',
        `Registered at ${this.now().toISOString()}`,
      ].slice(0, 12),
    };
    if (existing >= 0) store.adapters[existing] = adapter;
    else store.adapters.unshift(adapter);
    store.adapters = store.adapters.slice(0, 100);
    this.save(store);
    return adapter;
  }

  public disable(id: string): ExternalHarnessAdapter | null {
    const store = this.load();
    const idx = store.adapters.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    store.adapters[idx] = { ...store.adapters[idx], status: 'disabled' };
    this.save(store);
    return store.adapters[idx];
  }

  public previewInvoke(input: {
    harnessId: string;
    prompt: string;
    mutation?: boolean;
  }): {
    allowed: boolean;
    reason: string;
    dryRun: true;
    harness: ExternalHarnessAdapter | null;
  } {
    const harness = this.list().find((h) => h.id === input.harnessId) || null;
    if (!harness) {
      return { allowed: false, reason: `Unknown harness: ${input.harnessId}`, dryRun: true, harness: null };
    }
    if (harness.status === 'disabled') {
      return { allowed: false, reason: 'Harness is disabled.', dryRun: true, harness };
    }
    if (harness.status === 'needs-configuration') {
      return { allowed: false, reason: 'Harness needs configuration (command/endpoint).', dryRun: true, harness };
    }
    if (input.mutation) {
      return {
        allowed: false,
        reason: 'Mutation path is preview-only here; apply requires separate approval gate.',
        dryRun: true,
        harness,
      };
    }
    return {
      allowed: true,
      reason: 'Read-only dry-run preview allowed.',
      dryRun: true,
      harness,
    };
  }

  private load(): Store {
    if (!this.existsSync(this.storeFile)) {
      return {
        version: 1,
        adapters: [
          {
            id: 'local-cli-delegate',
            label: 'local CLI delegate',
            kind: 'cli-process',
            status: 'registered',
            commandOrEndpoint: null,
            readOnlyDefault: true,
            mutationRequiresApproval: true,
            notes: ['Generic local CLI harness slot. Configure a command to activate.'],
          },
          {
            id: 'acp-compatible-session',
            label: 'ACP-compatible session',
            kind: 'acp-compatible',
            status: 'registered',
            commandOrEndpoint: null,
            readOnlyDefault: true,
            mutationRequiresApproval: true,
            notes: ['Protocol-family adapter slot for ACP-compatible sessions.'],
          },
        ],
      };
    }
    try {
      const parsed = JSON.parse(this.readFileSync(this.storeFile, 'utf8')) as Store;
      return {
        version: 1,
        adapters: Array.isArray(parsed.adapters) ? parsed.adapters : [],
      };
    } catch {
      return { version: 1, adapters: [] };
    }
  }

  private save(store: Store): void {
    this.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    this.writeFileSync(this.storeFile, JSON.stringify(store, null, 2), 'utf8');
  }
}

function slug(value: string): string {
  return String(value || 'harness')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `harness-${crypto.randomBytes(3).toString('hex')}`;
}

function inferKind(commandOrEndpoint: string): ExternalHarnessKind {
  const v = commandOrEndpoint.toLowerCase();
  if (v.startsWith('http://') || v.startsWith('https://')) return 'http-session';
  if (v.includes('acp') || v.includes('stdio')) return v.includes('stdio') ? 'stdio-rpc' : 'acp-compatible';
  if (v.trim()) return 'cli-process';
  return 'unknown';
}
