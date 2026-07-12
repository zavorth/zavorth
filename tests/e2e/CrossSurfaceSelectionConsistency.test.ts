/**
 * Cross-Surface Selection Consistency E2E Tests
 *
 * Verifies that Zavorth's three product surfaces (Code, Control, Desktop)
 * share the same selection model — specifically that UserSelectionResolver
 * produces the same preference shape regardless of which surface wrote or
 * read the preference, and that profile manifests are internally consistent.
 *
 * Related docs: docs/product/surfaces-code-control-desktop.md
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  resolveUserProviderSelection,
  resolveUserChannelSelection,
  resolveUserSelectionBundle,
  writeProviderPreference,
  writeChannelPreference,
  readProviderPreference,
  readChannelPreference,
  type UserProviderSelection,
} from '../../src/services/UserSelectionResolver';

// ── Helpers ──────────────────────────────────────────────────

function makeTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-xsurface-'));
  // Ensure data/runtime/ exists so preference writes work
  fs.mkdirSync(path.join(dir, 'data', 'runtime'), { recursive: true });
  return dir;
}

function cleanup(root: string): void {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function loadProfile(profileId: string): Record<string, unknown> {
  const profilesDir = path.join(process.cwd(), 'config', 'profile-manifests');
  const file = path.join(profilesDir, `${profileId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Profile manifest not found: ${profileId}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

const PROFILE_IDS = ['personal', 'developer', 'business', 'creator', 'operator', 'power', 'team'] as const;

// ═════════════════════════════════════════════════════════════
// TEST 1: Provider selection — write then read consistency
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: Provider preference write/read consistency', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot();
  });

  afterEach(() => {
    cleanup(root);
  });

  it('writeProviderPreference then readProviderPreference returns the same shape', () => {
    const written = writeProviderPreference({
      providerId: 'openai',
      modelId: 'gpt-4o',
      routeId: 'chat',
      familyId: 'gpt-4',
      secondaryModelId: 'gpt-4o-mini',
      fallbackProviderIds: ['anthropic', 'openrouter'],
      projectRoot: root,
    });

    expect(written.providerId).toBe('openai');
    expect(written.modelId).toBe('gpt-4o');
    expect(written.configured).toBe(true);
    expect(written.source).toBe('preference');

    const persisted = readProviderPreference(root);
    expect(persisted).not.toBeNull();
    expect(persisted!.providerId).toBe('openai');
    expect(persisted!.modelId).toBe('gpt-4o');
    expect(persisted!.secondaryModelId).toBe('gpt-4o-mini');
    expect(persisted!.fallbackProviderIds).toEqual(['anthropic', 'openrouter']);
  });

  it('resolveUserProviderSelection reads from the same preference file that writeProviderPreference wrote', () => {
    writeProviderPreference({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4',
      projectRoot: root,
    });

    const resolved = resolveUserProviderSelection({ projectRoot: root });

    expect(resolved.providerId).toBe('anthropic');
    expect(resolved.modelId).toBe('claude-sonnet-4');
    expect(resolved.source).toBe('preference');
    expect(resolved.configured).toBe(true);
  });

  it('clearing modelId with null does not inherit previous value (unlike undefined)', () => {
    writeProviderPreference({
      providerId: 'openai',
      modelId: 'gpt-4o',
      projectRoot: root,
    });

    // Now update with modelId: null — should clear it
    writeProviderPreference({
      providerId: 'openai',
      modelId: null,
      projectRoot: root,
    });

    const persisted = readProviderPreference(root);
    expect(persisted!.modelId).toBeNull();
  });

  it('undefined modelId preserves previous value (keep semantics)', () => {
    writeProviderPreference({
      providerId: 'openai',
      modelId: 'gpt-4o',
      projectRoot: root,
    });

    writeProviderPreference({
      providerId: 'openai',
      // modelId: undefined — should keep previous
      projectRoot: root,
    });

    const persisted = readProviderPreference(root);
    expect(persisted!.modelId).toBe('gpt-4o');
  });

  it('writing the same provider from two surfaces (Code + Control) does not lose metadata', () => {
    // Surface 1 (Control) writes with metadata
    writeProviderPreference({
      providerId: 'openai',
      modelId: 'gpt-4o',
      routeId: 'chat',
      secondaryModelId: 'gpt-4o-mini',
      projectRoot: root,
    });

    // Surface 2 (Code) writes with only provider + different model
    writeProviderPreference({
      providerId: 'openai',
      modelId: 'gpt-4o-2024-08-06',
      // routeId left undefined — should preserve previous
      projectRoot: root,
    });

    const persisted = readProviderPreference(root);
    expect(persisted!.providerId).toBe('openai');
    expect(persisted!.modelId).toBe('gpt-4o-2024-08-06');
    // routeId should survive the partial write
    expect(persisted!.routeId).toBe('chat');
  });
});

// ═════════════════════════════════════════════════════════════
// TEST 2: Channel selection — same cross-surface model
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: Channel preference write/read consistency', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot();
  });

  afterEach(() => {
    cleanup(root);
  });

  it('writeChannelPreference produces the same shape that resolveUserChannelSelection reads', () => {
    const written = writeChannelPreference('telegram', root);
    expect(written.channelId).toBe('telegram');
    expect(written.configured).toBe(true);

    const resolved = resolveUserChannelSelection({ projectRoot: root });
    expect(resolved.channelId).toBe('telegram');
    expect(resolved.source).toBe('preference');
    expect(resolved.configured).toBe(true);
  });

  it('clearing channel returns unconfigured state', () => {
    writeChannelPreference('telegram', root);
    writeChannelPreference('', root);

    const resolved = resolveUserChannelSelection({ projectRoot: root });
    expect(resolved.channelId).toBeNull();
    expect(resolved.configured).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// TEST 3: Bundle resolution — provider + channel together
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: Bundle resolve is provider + channel union', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot();
  });

  afterEach(() => {
    cleanup(root);
  });

  it('resolveUserSelectionBundle returns both provider and channel from preference', () => {
    writeProviderPreference({ providerId: 'openai', modelId: 'gpt-4o', projectRoot: root });
    writeChannelPreference('telegram', root);

    const bundle = resolveUserSelectionBundle({ projectRoot: root });
    expect(bundle.provider.providerId).toBe('openai');
    expect(bundle.provider.modelId).toBe('gpt-4o');
    expect(bundle.channel.channelId).toBe('telegram');
  });

  it('bundle with no preferences configured returns none source', () => {
    const bundle = resolveUserSelectionBundle({ projectRoot: root });
    expect(bundle.provider.source).toBe('none');
    expect(bundle.channel.source).toBe('none');
    expect(bundle.provider.configured).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// TEST 4: Profile manifests — all define the same schema keys
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: Profile manifest schema consistency', () => {
  for (const profileId of PROFILE_IDS) {
    it(`profile ${profileId} has all required top-level keys`, () => {
      const manifest = loadProfile(profileId);
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('id');
      expect(manifest).toHaveProperty('label');
      expect(manifest).toHaveProperty('description');
      expect(manifest).toHaveProperty('cognitive');
      expect(manifest).toHaveProperty('runtime');
      expect(manifest).toHaveProperty('capabilities');
      expect(manifest).toHaveProperty('surfaces');
      expect(manifest).toHaveProperty('memory');
      expect(manifest).toHaveProperty('improvement');
    });

    it(`profile ${profileId} id matches filename`, () => {
      const manifest = loadProfile(profileId);
      expect(manifest.id).toBe(profileId);
    });

    it(`profile ${profileId} surfaces.default is one of allowed`, () => {
      const manifest = loadProfile(profileId) as { surfaces: { default: string; allowed: string[] } };
      expect(manifest.surfaces.allowed).toContain(manifest.surfaces.default);
    });

    it(`profile ${profileId} has approvalMode defined`, () => {
      const manifest = loadProfile(profileId) as { runtime: { approvalMode: string } };
      expect(manifest.runtime.approvalMode).toBeTruthy();
    });

    it(`profile ${profileId} cognitive has responseStyle and autonomy`, () => {
      const manifest = loadProfile(profileId) as { cognitive: { responseStyle: string; autonomy: string } };
      expect(manifest.cognitive.responseStyle).toBeTruthy();
      expect(manifest.cognitive.autonomy).toBeTruthy();
    });
  }
});

// ═════════════════════════════════════════════════════════════
// TEST 5: No-silent-invent invariant — providerId null when nothing configured
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: No silent provider invention', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot();
  });

  afterEach(() => {
    cleanup(root);
  });

  it('empty workspace returns providerId null (not gemini/aigateway)', () => {
    const resolved = resolveUserProviderSelection({ projectRoot: root });
    expect(resolved.providerId).toBeNull();
    expect(resolved.configured).toBe(false);
  });

  it('empty workspace with no env returns empty fallback list (not hidden defaults)', () => {
    const resolved = resolveUserProviderSelection({ projectRoot: root, env: {} });
    expect(resolved.fallbackProviderIds).toEqual([]);
  });

  it('unconfigured / none / null strings are treated as null', () => {
    // writeProviderPreference should reject empty provider
    const result = writeProviderPreference({
      providerId: 'unconfigured',
      projectRoot: root,
    });
    expect(result.providerId).toBeNull();
    expect(result.configured).toBe(false);
  });

  it('env provider override works for all surfaces (shared env contract)', () => {
    const resolved = resolveUserProviderSelection({
      projectRoot: root,
      env: { LLM_PROVIDER: 'ollama' },
    });
    expect(resolved.providerId).toBe('ollama');
    expect(resolved.source).toBe('env');
  });
});

// ═════════════════════════════════════════════════════════════
// TEST 6: Selection type shape is the same object structure every surface reads
// ═════════════════════════════════════════════════════════════

describe('Cross-surface: UserProviderSelection type invariants', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot();
  });

  afterEach(() => {
    cleanup(root);
  });

  it('selection always has all required keys', () => {
    writeProviderPreference({ providerId: 'openai', modelId: 'gpt-4o', projectRoot: root });
    const resolved = resolveUserProviderSelection({ projectRoot: root });

    const requiredKeys: (keyof UserProviderSelection)[] = [
      'providerId',
      'modelId',
      'routeId',
      'familyId',
      'secondaryModelId',
      'fallbackProviderIds',
      'source',
      'configured',
    ];

    for (const key of requiredKeys) {
      expect(resolved).toHaveProperty(key);
    }
  });

  it('fallbackProviderIds is always an array (even if empty)', () => {
    const resolved = resolveUserProviderSelection({ projectRoot: root });
    expect(Array.isArray(resolved.fallbackProviderIds)).toBe(true);
  });

  it('source is one of the valid union values', () => {
    const resolved = resolveUserProviderSelection({ projectRoot: root });
    expect(['request', 'env', 'preference', 'none']).toContain(resolved.source);
  });
});
