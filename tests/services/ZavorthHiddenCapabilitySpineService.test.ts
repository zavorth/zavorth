import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthHiddenCapabilitySpineService } from '../../src/services/ZavorthHiddenCapabilitySpineService';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hidden-spine-'));
  fs.mkdirSync(path.join(root, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config', 'capability-manifests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: {
      'zavorth:capability-atlas:json': 'npx tsx scripts/zavorth-capability-atlas.ts --json',
      'qa:zavorth-natural-action-harness': 'npx jest tests/runtime/actions/ZavorthActionHarness.test.ts --runInBand',
    },
  }));
  return root;
}

function touch(root: string, file: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '// test fixture\n');
}

function writeManifest(root: string, id: string, actions: string[]): void {
  fs.writeFileSync(path.join(root, 'config', 'capability-manifests', `${id}.json`), JSON.stringify({
    id,
    actions: actions.map((actionId) => ({ id: actionId, status: 'verified' })),
  }));
}

describe('ZavorthHiddenCapabilitySpineService', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds internal capabilities that have implementation files but no Action Harness actions', () => {
    const root = makeRoot();
    roots.push(root);
    touch(root, 'src/services/UniversalSkillExpansionService.ts');
    touch(root, 'src/services/ZavorthSkillAbsorptionMaterializationService.ts');
    touch(root, 'src/services/ZavorthExternalAgentGatewayService.ts');
    writeManifest(root, 'workspace-files', ['workspace.read_file']);

    const snapshot = new ZavorthHiddenCapabilitySpineService({ projectRoot: root }).buildSnapshot();
    const skills = snapshot.candidates.find((candidate) => candidate.id === 'skills.absorption');
    const agents = snapshot.candidates.find((candidate) => candidate.id === 'agents.external-arms');

    expect(snapshot.summary.hidden).toBeGreaterThan(0);
    expect(skills).toEqual(expect.objectContaining({
      status: 'hidden',
      desiredActionIds: expect.arrayContaining(['skills.absorb', 'skills.catalog.list']),
      missingActionIds: expect.arrayContaining(['skills.absorb']),
    }));
    expect(agents).toEqual(expect.objectContaining({
      status: 'hidden',
      desiredActionIds: expect.arrayContaining(['agents.external.invoke']),
    }));
  });

  it('marks a capability partial when only some desired actions are already manifested', () => {
    const root = makeRoot();
    roots.push(root);
    touch(root, 'src/services/UniversalSkillExpansionService.ts');
    touch(root, 'src/services/ZavorthSkillAbsorptionMaterializationService.ts');
    writeManifest(root, 'capability-spine', ['skills.catalog.list']);

    const snapshot = new ZavorthHiddenCapabilitySpineService({ projectRoot: root }).buildSnapshot();
    const skills = snapshot.candidates.find((candidate) => candidate.id === 'skills.absorption');

    expect(skills?.status).toBe('partial');
    expect(skills?.exposedActionIds).toEqual(['skills.catalog.list']);
    expect(skills?.missingActionIds).toContain('skills.absorb');
  });

  it('builds a materialization plan and parity packs for Hermes and OpenClaw', () => {
    const root = makeRoot();
    roots.push(root);
    touch(root, 'src/services/UniversalSkillExpansionService.ts');
    touch(root, 'src/services/ZavorthSkillAbsorptionMaterializationService.ts');
    writeManifest(root, 'web-browser', ['web.search', 'browser.click']);

    const service = new ZavorthHiddenCapabilitySpineService({ projectRoot: root });
    const plan = service.buildMaterializationPlan('skills.absorption');
    const hermes = service.buildParityPack('hermes');
    const openclaw = service.buildParityPack('openclaw');

    expect(plan?.actionIds).toEqual(expect.arrayContaining(['skills.catalog.list', 'skills.absorb']));
    expect(plan?.manifestId).toBe('capability-spine');
    expect(hermes.tools.find((tool) => tool.sourceToolId === 'web_search')).toEqual(expect.objectContaining({
      zavorthActionId: 'web.search',
      status: 'native',
    }));
    expect(hermes.tools.find((tool) => tool.sourceToolId === 'delegate_task')).toEqual(expect.objectContaining({
      zavorthActionId: 'agents.external.invoke',
    }));
    expect(openclaw.tools.find((tool) => tool.sourceToolId === 'file_fetch')).toEqual(expect.objectContaining({
      zavorthActionId: 'workspace.read_file',
    }));
  });
});
