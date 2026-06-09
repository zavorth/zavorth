import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ZavorthSandboxCapabilityProvisioner } from '../../src/services/ZavorthSandboxCapabilityProvisioner.js';
import type { SkillMetadata } from '../../src/skills/SkillLoader.js';
import { ZavorthPathCompactor } from '../../src/skills/ZavorthPathCompactor.js';

describe('ZavorthSandboxCapabilityProvisioner', () => {
  let tempTestDir: string;
  let sandboxDir: string;
  let skillDir: string;

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provisioner-test-'));
    sandboxDir = path.join(tempTestDir, 'sandbox');
    skillDir = path.join(tempTestDir, 'my-skill');

    fs.mkdirSync(sandboxDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });

    // Crate mock files and directories
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# My Skill\nInstruction body', 'utf8');
    fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'references', 'notes.md'), 'Evidence notes', 'utf8');

    // Create ignored directories
    fs.mkdirSync(path.join(skillDir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, '.git', 'config'), 'git config', 'utf8');
    fs.mkdirSync(path.join(skillDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'node_modules', 'some-pkg'), 'node package data', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  });

  it('provisions active skills into sandbox workspace while skipping .git and node_modules', () => {
    const mockSkill: SkillMetadata = {
      name: 'my-skill',
      description: 'Test Description',
      dirPath: skillDir, // Absolute path
      skillFilePath: path.join(skillDir, 'SKILL.md'),
      supportFilePaths: [],
      supportFiles: []
    } as any;

    ZavorthSandboxCapabilityProvisioner.provision([mockSkill], sandboxDir);

    const destSkillDir = path.join(sandboxDir, '.zavorth', 'capabilities', 'my-skill');
    expect(fs.existsSync(destSkillDir)).toBe(true);
    expect(fs.existsSync(path.join(destSkillDir, 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(destSkillDir, 'SKILL.md'), 'utf8')).toBe('# My Skill\nInstruction body');

    expect(fs.existsSync(path.join(destSkillDir, 'references', 'notes.md'))).toBe(true);
    expect(fs.readFileSync(path.join(destSkillDir, 'references', 'notes.md'), 'utf8')).toBe('Evidence notes');

    // Ignored paths check
    expect(fs.existsSync(path.join(destSkillDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(destSkillDir, 'node_modules'))).toBe(false);
  });

  it('expands compacted source paths and sanitizes target skill names', () => {
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(tempTestDir);
    const mockSkill: SkillMetadata = {
      name: '../unsafe:skill',
      description: 'Test Description',
      dirPath: ZavorthPathCompactor.compact(skillDir),
      skillFilePath: ZavorthPathCompactor.compact(path.join(skillDir, 'SKILL.md')),
      supportFilePaths: [],
      supportFiles: [],
    } as any;

    try {
      ZavorthSandboxCapabilityProvisioner.provision([mockSkill], sandboxDir);
    } finally {
      homedirSpy.mockRestore();
    }

    const capabilitiesDir = path.join(sandboxDir, '.zavorth', 'capabilities');
    const provisionedDirs = fs.readdirSync(capabilitiesDir);
    expect(provisionedDirs).toEqual(['unsafe-skill']);
    expect(fs.existsSync(path.join(capabilitiesDir, 'unsafe-skill', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(sandboxDir, '.zavorth', 'unsafe:skill'))).toBe(false);
  });
});
