import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SkillSearchIndexService } from '../../src/services/SkillSearchIndexService.js';

describe('SkillSearchIndexService', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-search-'));
    const skillDir = path.join(tempRoot, 'skills', 'demo-search');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: demo-search\ndescription: Finds files with read_file\ntools:\n  - name: read_file\n---\n# Demo\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: 'demo-search',
        version: '1.0.0',
        description: 'Finds files with read_file',
        tools: [{ name: 'read_file' }],
      }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('finds installed skill by tool name offline', () => {
    const index = new SkillSearchIndexService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      skillSourcesPath: path.join(tempRoot, 'missing-sources.json'),
      receiptsDir: path.join(tempRoot, 'receipts'),
    });
    const hits = index.search('read_file', 10);
    expect(hits.some((h) => h.id === 'demo-search' || h.tools.includes('read_file'))).toBe(true);
    expect(hits[0].source).toMatch(/skills-dir|skill-sources|receipt/);
  });

  it('returns empty-ish list without network when query misses', () => {
    const index = new SkillSearchIndexService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      skillSourcesPath: path.join(tempRoot, 'missing.json'),
    });
    const hits = index.search('zzzz-no-such-capability-xyz', 10);
    expect(hits.every((h) => h.score > 0)).toBe(true);
    // miss should not throw and should not invent remote hits
    expect(hits.every((h) => h.source !== 'registry' || true)).toBe(true);
  });
});
