import type { IntelligenceCapabilityManifest, IntelligenceFabricSnapshot } from '../contracts/native/IntelligenceFabricContract.js';
import type { CapabilityBuilderProposal, CapabilityBuilderScaffold } from '../contracts/PracticalAgencyContract.js';

export class ZavorthCapabilityBuilderService {
  public buildProposal(input: { fabric: IntelligenceFabricSnapshot; requestedCapability?: string | null }): CapabilityBuilderProposal {
    const draft = input.fabric.capabilityBuilder;
    const requestedCapability = input.requestedCapability || draft.requestedCapability;
    if (draft.status === 'existing_capability') {
      return {
        source: 'ZavorthCapabilityBuilderService',
        status: 'use_existing',
        requestedCapability,
        matchedCapabilityId: draft.matchedCapabilityId,
        manifest: null,
        scaffold: null,
        activation: this.disabledActivation(),
        receipts: ['capability-exists-use-setup-flow'],
      };
    }
    if (draft.status !== 'draft_ready' || !draft.manifest) {
      return {
        source: 'ZavorthCapabilityBuilderService',
        status: 'not_needed',
        requestedCapability: null,
        matchedCapabilityId: null,
        manifest: null,
        scaffold: null,
        activation: this.disabledActivation(),
        receipts: ['capability-builder-not-needed'],
      };
    }

    const manifest = this.hardenManifest(draft.manifest);
    return {
      source: 'ZavorthCapabilityBuilderService',
      status: 'draft_ready',
      requestedCapability,
      matchedCapabilityId: null,
      manifest,
      scaffold: this.scaffoldFor(manifest),
      activation: this.disabledActivation(),
      receipts: [
        'capability-draft-created',
        'capability-starts-disabled',
        'capability-live-activation-requires-owner-approval',
      ],
    };
  }

  private hardenManifest(manifest: IntelligenceCapabilityManifest): IntelligenceCapabilityManifest {
    return {
      ...manifest,
      id: safeId(manifest.id),
      name: redact(manifest.name),
      description: redact(manifest.description),
      defaultEnabled: false,
      liveAllowedByDefault: false,
      approvalRequiredFor: Array.from(new Set([
        ...manifest.approvalRequiredFor,
        'activate-live',
        'install',
        'secret-use',
      ])),
      tests: manifest.tests.length > 0 ? manifest.tests : [
        'manifest validates',
        'capability lab simulation passes',
        'risk gate blocks live activation without approval',
      ],
    };
  }

  private scaffoldFor(manifest: IntelligenceCapabilityManifest): CapabilityBuilderScaffold {
    const safeId = manifest.id.replace(/[^a-z0-9_.-]+/gi, '-');
    return {
      manifestPath: `capabilities/drafts/${safeId}/manifest.json`,
      testPath: `capabilities/drafts/${safeId}/${safeId}.test.ts`,
      readmePath: `capabilities/drafts/${safeId}/README.md`,
      filesWritten: false,
    };
  }

  private disabledActivation(): CapabilityBuilderProposal['activation'] {
    return {
      defaultEnabled: false,
      liveAllowed: false,
      requiresOwnerApproval: true,
    };
  }
}

function safeId(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96) || 'capability-draft';
}

function redact(value: string): string {
  return String(value || '')
    .replace(/\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi, '[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]')
    .slice(0, 240);
}
