import { ZavorthAgentCapabilityAssimilationService } from '../../../src/services/ZavorthAgentCapabilityAssimilationService.js';

describe('ZavorthAgentCapabilityAssimilationService', () => {
  it('builds a governed Zavorth-native assimilation matrix', () => {
    const service = new ZavorthAgentCapabilityAssimilationService({
      now: () => new Date('2026-05-11T18:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-11.agent-capability-assimilation-checkpoint-1');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.categoriesCovered).toBe(9);
    expect(snapshot.guarantees.zavorthNativeIdentity).toBe(true);
    expect(snapshot.guarantees.noExternalSourceCodeCopied).toBe(true);
    expect(snapshot.guarantees.noExternalPromptsCopied).toBe(true);
    expect(snapshot.guarantees.noRawChainOfThoughtPolicy).toBe(true);
    expect(snapshot.matrix.map((item) => item.publicNaming.zavorthNativeName)).toEqual(expect.arrayContaining([
      'Compact Governed Plan',
      'Natural Tool Router',
      'Governed Subagent Runtime',
      'Universal Skill Intake',
      'Perception Control Plane',
      'Trust Plane Governance',
    ]));
    expect(snapshot.matrix.every((item) =>
      item.implementationBoundary.copyExternalCode === false
      && item.implementationBoundary.copyExternalPrompts === false
      && item.implementationBoundary.absorbPatternOnly === true,
    )).toBe(true);
  });

  it('rejects raw reasoning exposure while preserving concise evidence summaries', () => {
    const snapshot = new ZavorthAgentCapabilityAssimilationService().buildSnapshot();
    const rejection = snapshot.matrix.find((item) => item.id === 'raw-reasoning-copy');

    expect(rejection).toEqual(expect.objectContaining({
      status: 'rejected',
      category: 'security_governance',
      risk: expect.objectContaining({ level: 'forbidden' }),
    }));
    expect(rejection?.policyRequirements).toContain('no-raw-chain-of-thought');
    expect(rejection?.zavorthNativeEquivalent).toContain('plan/evidence/inference/receipt');
  });

  it('marks visual UX assimilation as owner-approved only', () => {
    const snapshot = new ZavorthAgentCapabilityAssimilationService().buildSnapshot();
    const ux = snapshot.matrix.find((item) => item.id === 'rich-cross-surface-commands');

    expect(ux?.implementationBoundary.requiresOwnerApprovalForVisualChange).toBe(true);
    expect(ux?.policyRequirements).toEqual(expect.arrayContaining([
      'policy-broker',
      'approval',
      'receipt',
    ]));
  });
});
