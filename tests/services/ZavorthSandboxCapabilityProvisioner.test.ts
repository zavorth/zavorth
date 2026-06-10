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

    const capabilitiesDir = path.join(sandboxDir, '.zavorth', 'capabilities');
    const [provisionedDir] = fs.readdirSync(capabilitiesDir);
    expect(provisionedDir).toMatch(/^my-skill-[a-f0-9]{8}$/);
    const destSkillDir = path.join(capabilitiesDir, provisionedDir);
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
    expect(provisionedDirs).toHaveLength(1);
    expect(provisionedDirs[0]).toMatch(/^unsafe-skill-[a-f0-9]{8}$/);
    expect(fs.existsSync(path.join(capabilitiesDir, provisionedDirs[0], 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(sandboxDir, '.zavorth', 'unsafe:skill'))).toBe(false);
  });

  it('keeps colliding sanitized names in distinct capability directories', () => {
    const firstDir = path.join(tempTestDir, 'unsafe-one');
    const secondDir = path.join(tempTestDir, 'unsafe-two');
    fs.mkdirSync(firstDir, { recursive: true });
    fs.mkdirSync(secondDir, { recursive: true });
    fs.writeFileSync(path.join(firstDir, 'SKILL.md'), '# First skill', 'utf8');
    fs.writeFileSync(path.join(secondDir, 'SKILL.md'), '# Second skill', 'utf8');

    const firstSkill: SkillMetadata = {
      name: '../unsafe:skill',
      description: 'First',
      dirPath: firstDir,
      skillFilePath: path.join(firstDir, 'SKILL.md'),
      supportFilePaths: [],
      supportFiles: [],
    } as any;
    const secondSkill: SkillMetadata = {
      name: '../unsafe:skill',
      description: 'Second',
      dirPath: secondDir,
      skillFilePath: path.join(secondDir, 'SKILL.md'),
      supportFilePaths: [],
      supportFiles: [],
    } as any;

    ZavorthSandboxCapabilityProvisioner.provision([firstSkill, secondSkill], sandboxDir);

    const capabilitiesDir = path.join(sandboxDir, '.zavorth', 'capabilities');
    const provisionedDirs = fs.readdirSync(capabilitiesDir).sort();
    expect(provisionedDirs).toHaveLength(2);
    expect(new Set(provisionedDirs).size).toBe(2);
    for (const dirName of provisionedDirs) {
      expect(dirName).toMatch(/^unsafe-skill-[a-f0-9]{8}$/);
      expect(fs.existsSync(path.join(capabilitiesDir, dirName, 'SKILL.md'))).toBe(true);
    }
  });
});
