import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID,
  createZavorthBlueprintApplicationPlanningPackFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC_282 = 'docs/282-zavorth-blueprint-application-planning-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthBlueprintApplicationPlanningPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

const legacyLower = 'bas' + 'ilisk';
const legacyTitle = 'Bas' + 'ilisk';
const legacyUpper = 'BAS' + 'ILISK';
const legacyIdentityPattern = new RegExp(`${legacyTitle}|${legacyLower}|${legacyUpper}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(/sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('_auth' + 'Token');
}

describe('Zavorth blueprint application planning pack', () => {
  const pack = createZavorthBlueprintApplicationPlanningPackFixture();

  it('exports the pack 282 boundary and records the historical blueprint source', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthBlueprintApplicationPlanningPack/v1');
    expect(index).toContain("from './ZavorthBlueprintApplicationPlanningPack.js'");
    expect(pack.normalization.packId).toBe('282');
    expect(pack.normalization.runtimeId).toBe(ZAVORTH_BLUEPRINT_APPLICATION_PLANNING_PACK_RUNTIME_ID);
    expect(pack.normalization.decision).toBe('zavorth-blueprint-application-plan-ready');
    expect(pack.normalization.blueprintSource).toEqual(expect.objectContaining({
      treatedAs: 'historical-runtime-blueprint',
      publicDocsReference: 'universal agent runtime blueprint',
      productRenameApplied: false,
    }));
    expect(pack.normalization.blueprintSource.path).toContain('universal_agent_runtime_blueprint.md');
  });

  it('does not apply the blueprint or change runtime behavior', () => {
    expect(pack.normalization.finalState).toEqual(expect.objectContaining({
      runtimeBehaviorChanged: false,
      blueprintApplied: false,
      npmPublishActuallyPerformed: false,
      providerToolCommandExecuted: false,
      runtimePersistentStartPerformed: false,
      rawHistoryImported: false,
      legacyPublicIdentityReintroduced: false,
    }));
    expect(pack.blockedActionPerformed()).toBe(false);
  });

  it('contains a parity matrix with every required planning status', () => {
    expect(pack.parityStatuses()).toEqual(expect.arrayContaining([
      'implemented',
      'partially-implemented',
      'not-started',
      'obsolete',
      'blocked',
      'needs-design',
    ]));
    expect(pack.normalization.parityMatrix).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'workspace-bootstrap', status: 'partially-implemented' }),
      expect.objectContaining({ id: 'context-compaction-plugin-interface', status: 'not-started' }),
      expect.objectContaining({ id: 'legacy-named-gateway-paths', status: 'obsolete' }),
      expect.objectContaining({ id: 'hosted-installer-flow', status: 'blocked' }),
    ]));
  });

  it('lists unnecessary work and prioritized recommended work', () => {
    expect(pack.normalization.unnecessaryWork).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recreate-agent-gateway', reason: 'already-implemented' }),
      expect.objectContaining({ id: 'apply-legacy-product-names', reason: 'would-reintroduce-legacy-identity' }),
      expect.objectContaining({ id: 'first-run-swarm-mesh-hardware', reason: 'overengineering-now' }),
    ]));
    expect(pack.normalization.recommendedWork).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'canonical-workspace-bootstrap', priority: 'P0' }),
      expect.objectContaining({ id: 'failure-explanation-ux', priority: 'P0' }),
      expect.objectContaining({ id: 'run-observatory-orphan-cleanup', priority: 'P1' }),
      expect.objectContaining({ id: 'hosted-installer-release', priority: 'P3' }),
    ]));
  });

  it('records the roadmap from 283 through 290 and details pack 283', () => {
    expect(pack.normalization.packRoadmap.map((roadmapPack) => roadmapPack.packId)).toEqual([
      '283',
      '284',
      '285',
      '286',
      '287',
      '288',
      '289',
      '290',
    ]);
    expect(pack.normalization.nextPackBrief).toEqual(expect.objectContaining({
      packId: '283',
      slug: '283-canonical-workspace-bootstrap',
    }));
    expect(pack.normalization.nextPackBrief.likelyFiles).toEqual(expect.arrayContaining([
      'src/services/CanonicalWorkspaceBootstrapService.ts',
      'scripts/setup-v3.ts',
      'scripts/ops-go.ts',
      'scripts/ops-doctor.ts',
    ]));
    expect(pack.normalization.nextPackBrief.successCriteria.join('\n')).toContain('read-only by default');
  });

  it('documents the plan without reintroducing legacy identity into public docs', () => {
    const doc = read(DOC_282);

    expect(doc).toContain('Zavorth Blueprint Application Planning Pack');
    expect(doc).toContain('universal agent runtime blueprint');
    expect(doc).toContain('283 - Canonical Workspace Bootstrap Pack');
    expect(doc).toContain('blueprintApplied=false');
    expect(doc).not.toMatch(legacyIdentityPattern);
    assertNoRawSecret(doc);
    assertNoRawSecret(JSON.stringify(pack.normalization));
  });
});
