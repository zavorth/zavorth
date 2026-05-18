import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthSkillExpansionPackService } from '../../src/services/ZavorthSkillExpansionPackService.js';

describe('ZavorthSkillExpansionPackService', () => {
  let root: string;
  let referenceRoot: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-expansion-pack-'));
    referenceRoot = path.join(root, 'reference-skills');
    writeReferenceSkill('skills/research/research-pack', [
      '---',
      'name: research-pack',
      'description: Research local documents and produce concise evidence notes.',
      'tags: [research, evidence]',
      'related_skills: [writing-pack]',
      'license: MIT',
      '---',
      '',
      '# Research Pack',
      '',
      'DO NOT COPY THIS BODY',
      '```bash',
      'echo should-never-be-copied',
      '```',
    ].join('\n'));
    writeReferenceSkill('optional-skills/finance/trading-desk', [
      '---',
      'name: trading-desk',
      'description: Analyze trading opportunities and account risk.',
      'tags: [finance, trading]',
      'license: MIT',
      '---',
      '',
      '# Trading Desk',
      '',
      'Handle payment, wallet and trading workflows only with approval.',
    ].join('\n'));
    fs.writeFileSync(path.join(referenceRoot, 'LICENSE'), 'MIT License\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews a local reference skill library as generated Zavorth-native stubs', () => {
    const service = serviceForTest();
    const snapshot = service.buildSnapshot({ sourceRoot: referenceRoot });
    const text = service.renderText(snapshot);

    expect(snapshot.contractVersion).toBe('zavorth-skill-expansion-pack/1');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.mode).toBe('preview');
    expect(snapshot.source.exists).toBe(true);
    expect(snapshot.source.license).toBe('MIT');
    expect(snapshot.summary.candidates).toBe(2);
    expect(snapshot.summary.core).toBe(1);
    expect(snapshot.summary.optional).toBe(1);
    expect(snapshot.summary.highRisk).toBe(1);
    expect(snapshot.summary.copiedUpstreamSkillBodies).toBe(0);
    expect(snapshot.summary.copiedUpstreamScripts).toBe(0);
    expect(snapshot.safety.generatedZavorthNativeStubsOnly).toBe(true);
    expect(snapshot.safety.noExecutionPerformed).toBe(true);
    expect(snapshot.safety.importedSkillsRemainReviewTrust).toBe(true);
    expect(text).toContain('Zavorth Skill Expansion Pack');
    expect(fs.existsSync(path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack'))).toBe(false);
  });

  it('blocks materialization until an approval id is provided', () => {
    const service = serviceForTest();
    const blocked = service.buildSnapshot({
      sourceRoot: referenceRoot,
      apply: true,
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.apply.applied).toBe(false);
    expect(blocked.apply.approvalSatisfied).toBe(false);
    expect(fs.existsSync(path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack'))).toBe(false);
  });

  it('materializes generated stubs without copying upstream body or scripts', () => {
    const service = serviceForTest();
    const applied = service.buildSnapshot({
      sourceRoot: referenceRoot,
      apply: true,
      approvalId: 'appr-skill-expansion-pack',
    });

    const skillPath = path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack', 'research', 'research-pack', 'SKILL.md');
    const originPath = path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack', 'research', 'research-pack', 'ORIGIN.json');
    const registryPath = path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack', 'registry.json');
    const noticePath = path.join(root, 'skill-library', 'imported', 'zavorth-expansion-pack', 'THIRD_PARTY_NOTICES.md');
    const statePath = path.join(root, 'data', 'skill-expansion-pack', 'skill-expansion-state.json');

    expect(applied.status).toBe('applied');
    expect(applied.apply.applied).toBe(true);
    expect(applied.summary.materializedCandidates).toBe(2);
    expect(applied.summary.filesWritten).toBeGreaterThanOrEqual(6);
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.existsSync(originPath)).toBe(true);
    expect(fs.existsSync(registryPath)).toBe(true);
    expect(fs.existsSync(noticePath)).toBe(true);
    expect(fs.existsSync(statePath)).toBe(true);

    const generatedSkill = fs.readFileSync(skillPath, 'utf8');
    expect(generatedSkill).toContain('ZAVORTH_EXPANSION_GENERATED: true');
    expect(generatedSkill).toContain('Do not run upstream scripts directly');
    expect(generatedSkill).not.toContain('DO NOT COPY THIS BODY');
    expect(generatedSkill).not.toContain('echo should-never-be-copied');

    const origin = JSON.parse(fs.readFileSync(originPath, 'utf8'));
    expect(origin.source.id).toBe('zavorth-native-skill-library');
    expect(origin.source.trust).toBe('review');
    expect(origin.originalRelativePath).toBe('skills/research/research-pack');
    expect(origin.copiedFiles).toEqual([]);
    expect(origin.governance.noUpstreamSkillBodyCopy).toBe(true);
    expect(origin.governance.noScriptCopy).toBe(true);
  });

  function serviceForTest() {
    return new ZavorthSkillExpansionPackService({
      projectRoot: root,
      now: () => new Date('2026-05-18T10:00:00.000Z'),
    });
  }

  function writeReferenceSkill(relativeDir: string, content: string): void {
    const dir = path.join(referenceRoot, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
  }
});
