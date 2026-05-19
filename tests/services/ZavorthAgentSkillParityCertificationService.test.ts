import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthAgentSkillParityCertificationService } from '../../src/services/ZavorthAgentSkillParityCertificationService.js';

describe('ZavorthAgentSkillParityCertificationService Certification matrix', () => {
  it('certifies subagent and skill parity through safe mocked flows', async () => {
    const fixture = createFixture();
    try {
      const snapshot = await new ZavorthAgentSkillParityCertificationService({
        now: () => new Date('2026-05-10T14:30:00.000Z'),
      }).buildSnapshot({
        sources: [{ sourcePath: fixture.source }],
      });

      expect(snapshot.status).toBe('passed');
      expect(snapshot.summary.safeMocksUsed).toBe(true);
      expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
      expect(snapshot.matrix.map((entry) => entry.id)).toEqual(expect.arrayContaining([
        'explicit_spawn',
        'natural_skills',
        'large_absorption',
        'policy_broker_everywhere',
      ]));
      expect(snapshot.matrix.every((entry) => entry.status === 'passed')).toBe(true);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-parity-test-'));
  const source = path.join(root, 'source');
  const skill = path.join(source, 'safe-parity-skill');
  fs.mkdirSync(path.join(skill, 'references'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), [
    '---',
    'name: safe-parity-skill',
    'description: Safe parity fixture skill.',
    'license: MIT',
    '---',
    '',
    '# Safe Parity Skill',
    '',
    'Summarize local notes.',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(skill, 'references', 'notes.md'), '# Notes\n\nParity fixture.\n', 'utf8');
  return { root, source };
}

