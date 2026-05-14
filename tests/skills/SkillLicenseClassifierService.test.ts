import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillLicenseClassifierService } from '../../src/skills/SkillLicenseClassifierService.js';

function writeSkill(skillDir: string, frontmatter: string): void {
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), frontmatter, 'utf8');
}

describe('SkillLicenseClassifierService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-license-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('prefers an explicit skill-level LICENSE file', () => {
    const skillDir = path.join(root, 'security-threat-model');
    writeSkill(skillDir, '---\nname: security-threat-model\ndescription: threat model\n---\n');
    fs.writeFileSync(path.join(skillDir, 'LICENSE.txt'), 'Apache License\nVersion 2.0\n', 'utf8');

    const result = new SkillLicenseClassifierService().classifySkillDirectory(skillDir, null);

    expect(result).toEqual(
      expect.objectContaining({
        license: 'Apache-2.0',
        confidence: 'high',
      }),
    );
  });

  it('falls back to EXTERNAL_SOURCE metadata when no local license file exists', () => {
    const skillDir = path.join(root, 'chrome-devtools');
    writeSkill(skillDir, '---\nname: chrome-devtools\ndescription: browser tooling\n---\n');
    fs.writeFileSync(
      path.join(skillDir, 'EXTERNAL_SOURCE.json'),
      JSON.stringify({ source_license_spdx: 'MIT' }, null, 2),
      'utf8',
    );

    const result = new SkillLicenseClassifierService().classifySkillDirectory(skillDir, null);

    expect(result).toEqual(
      expect.objectContaining({
        license: 'MIT',
        confidence: 'high',
      }),
    );
  });
});
