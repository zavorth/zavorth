import fs from 'node:fs';
import path from 'node:path';

import { ZAVORTH_SKILL_IR_CONTRACT_VERSION } from '../../src/contracts/skill/ZavorthSkillIrContract.js';
import { SkillIrNormalizerService } from '../../src/skills/SkillIrNormalizerService.js';

const FIXTURES = path.resolve(__dirname, '../fixtures/skill-ir');

describe('SkillIrNormalizerService', () => {
  const service = new SkillIrNormalizerService();

  it('parses skill-md-v1 with declared tools and aliases', () => {
    const dir = path.join(FIXTURES, 'skill-md-v1');
    const result = service.normalizeFromDir({
      skillDir: dir,
      sourceUri: dir,
      sourceKind: 'local-path',
      now: () => new Date('2026-07-14T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.skillIr.contractVersion).toBe(ZAVORTH_SKILL_IR_CONTRACT_VERSION);
    expect(result.skillIr.parserId).toBe('skill-md-v1');
    expect(result.skillIrDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.skillIr.declaredTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['search_query', 'unknown_widget']),
    );
    expect(result.skillIr.guidanceOnly).toBe(false);
    expect(result.skillIr.procedureMarkdown.length).toBeGreaterThan(0);
    // Brand-agnostic: no third-party product product names required in IR
    expect(JSON.stringify(result.skillIr).toLowerCase()).not.toMatch(/openclaw|hermes-agent/);
  });

  it('yields opaque-guidance-v1 without SKILL.md', () => {
    const dir = path.join(FIXTURES, 'opaque-guidance-v1');
    const result = service.normalizeFromDir({
      skillDir: dir,
      sourceUri: dir,
      sourceKind: 'local-path',
    });
    expect(result.skillIr.parserId).toBe('opaque-guidance-v1');
    expect(result.skillIr.guidanceOnly).toBe(true);
    expect(result.skillIr.declaredTools).toEqual([]);
    expect(result.skillIr.files.length).toBeGreaterThan(0);
  });

  it('parses readme-tools-v1 tool markers', () => {
    const dir = path.join(FIXTURES, 'readme-tools-v1');
    const result = service.normalizeFromDir({ skillDir: dir, sourceUri: dir });
    expect(result.skillIr.parserId).toBe('readme-tools-v1');
    expect(result.skillIr.declaredTools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['read_file', 'list_directory', 'web_search']),
    );
  });

  it('parses package-json-skill-v1', () => {
    const dir = path.join(FIXTURES, 'package-json-skill-v1');
    const result = service.normalizeFromDir({ skillDir: dir, sourceUri: dir });
    expect(result.skillIr.parserId).toBe('package-json-skill-v1');
    expect(result.skillIr.declaredTools.map((t) => t.name)).toContain('read_file');
  });

  it('is stable digest for same content', () => {
    const dir = path.join(FIXTURES, 'skill-md-v1');
    const a = service.normalizeFromDir({ skillDir: dir, sourceUri: dir });
    const b = service.normalizeFromDir({ skillDir: dir, sourceUri: dir });
    expect(a.skillIrDigest).toBe(b.skillIrDigest);
  });
});
