import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handleZavorthCliRegistrySkillsCommand } from '../../src/cli/ZavorthCliRegistrySkills';
import type { ZavorthCliRuntime, ZavorthCliFlags, CliWriter } from '../../src/cli/ZavorthCliContract';


function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-skills-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'skills-test' }));
  return root;
}

describe('ZavorthCliRegistrySkills command handler', () => {
  let projectRoot: string;
  let lines: string[];
  let errors: string[];
  let mockWriter: CliWriter;

  beforeEach(() => {
    projectRoot = makeRoot();
    lines = [];
    errors = [];
    mockWriter = {
      line: (text: string) => {
        lines.push(text);
      },
      error: (text: string) => {
        errors.push(text);
      },
    };
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('ignores other commands', async () => {
    const result = await handleZavorthCliRegistrySkillsCommand({
      runtime: {} as ZavorthCliRuntime,
      effectiveFlags: {} as ZavorthCliFlags,
      commandName: 'not-skills',
      args: '',
      writer: mockWriter,
    });
    expect(result).toBeNull();
  });

  it('lists workspace skills', async () => {
    // Create local skill
    const skillsDir = path.join(projectRoot, 'skills');
    fs.mkdirSync(path.join(skillsDir, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: A simple test skill\n---\n# Test\n',
      'utf8'
    );

    // Temporarily change __dirname for the test
    const originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    try {
      const result = await handleZavorthCliRegistrySkillsCommand({
        runtime: {} as ZavorthCliRuntime,
        effectiveFlags: {} as ZavorthCliFlags,
        commandName: 'skill',
        args: 'list',
        writer: mockWriter,
      });

      expect(result?.ok).toBe(true);
      expect(lines.join('\n')).toMatch(/Installed Skills|Installed Workspace Skills/i);
      expect(lines.join('\n')).toContain('test-skill: A simple test skill');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('searches remote community catalog', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    try {
      const result = await handleZavorthCliRegistrySkillsCommand({
        runtime: {} as ZavorthCliRuntime,
        effectiveFlags: {} as ZavorthCliFlags,
        commandName: 'skill',
        args: 'search git',
        writer: mockWriter,
      });

      expect(result?.ok).toBe(true);
      expect(lines.join('\n')).toMatch(/Remote Community Skills|No skills found|Community Skills/i);
      expect(lines.join('\n')).toContain('git-helper');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('installs community skill', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    try {
      const result = await handleZavorthCliRegistrySkillsCommand({
        runtime: {} as ZavorthCliRuntime,
        effectiveFlags: {} as ZavorthCliFlags,
        commandName: 'skill',
        args: 'install git-helper',
        writer: mockWriter,
      });

      expect(result?.ok).toBe(true);
      const skillFile = path.join(projectRoot, 'skills', 'git-helper', 'SKILL.md');
      expect(fs.existsSync(skillFile)).toBe(true);
      expect(fs.readFileSync(skillFile, 'utf8')).toContain('name: git-helper');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('publishes local skill', async () => {
    const skillsDir = path.join(projectRoot, 'skills');
    fs.mkdirSync(path.join(skillsDir, 'my-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, 'my-skill', 'SKILL.md'),
      '---\nname: my-skill\ndescription: Mine\n---\n',
      'utf8'
    );

    const originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    try {
      const result = await handleZavorthCliRegistrySkillsCommand({
        runtime: {} as ZavorthCliRuntime,
        effectiveFlags: {} as ZavorthCliFlags,
        commandName: 'skill',
        args: 'publish my-skill',
        writer: mockWriter,
      });

      expect(result?.ok).toBe(true);
      expect(lines.join('\n')).toContain('Published');
      expect(lines.join('\n')).toContain('successfully published');
    } finally {
      process.cwd = originalCwd;
    }
  });
});
