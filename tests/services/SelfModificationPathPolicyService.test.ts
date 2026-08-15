import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';


import {
  SelfModificationPathPolicyService,
  matchGlob,
} from '../../src/services/selfmod-command/SelfModificationPathPolicyService.js';

describe('SelfModificationPathPolicyService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-selfmod-policy-'));
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.copyFileSync(
      path.join(__dirname, 'config', 'selfmod-path-policy.json'),
      path.join(root, 'config', 'selfmod-path-policy.json'),
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('allows skills/plugins/docs/config sources and blocks node_modules', () => {
    const policy = new SelfModificationPathPolicyService({ projectRoot: root });
    expect(policy.check('skills/demo/SKILL.md').allowed).toBe(true);
    expect(policy.check('plugins/my-tool/index.js').allowed).toBe(true);
    expect(policy.check('docs/self-modification.md').allowed).toBe(true);
    expect(policy.check('config/skill-sources.json').allowed).toBe(true);
    expect(policy.check('node_modules/x/index.js').allowed).toBe(false);
    expect(policy.check('.env').allowed).toBe(false);
  });

  it('marks src/** as core requiring BUILD + owner when context false', () => {
    const policy = new SelfModificationPathPolicyService({ projectRoot: root });
    const blockedBuild = policy.check('src/services/Foo.ts', {
      buildMode: false,
      ownerOrTrusted: true,
    });
    expect(blockedBuild.allowed).toBe(false);
    expect(blockedBuild.reason).toMatch(/BUILD/i);

    const blockedOwner = policy.check('src/services/Foo.ts', {
      buildMode: true,
      ownerOrTrusted: false,
    });
    expect(blockedOwner.allowed).toBe(false);
    expect(blockedOwner.reason).toMatch(/owner|trusted/i);

    const ok = policy.check('src/services/Foo.ts', {
      buildMode: true,
      ownerOrTrusted: true,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.tier).toBe('core');
  });

  it('matchGlob supports ** and *', () => {
    expect(matchGlob('skills/a/SKILL.md', 'skills/**')).toBe(true);
    expect(matchGlob('config/skill-sources.json', 'config/*sources*')).toBe(true);
    expect(matchGlob('config/other.json', 'config/*sources*')).toBe(false);
  });
});
