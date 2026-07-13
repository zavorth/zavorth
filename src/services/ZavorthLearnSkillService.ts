/**
 * Learn-skill facade.
 *
 * Composes UniversalCapabilityFabric absorb (path / HTTPS / git / inline text)
 * into a skill-first UX with quarantine + consent. Does not invent a parallel
 * scrape pipeline — fabric + optional SourceSearchFetch extract own the work.
 */

import path from 'node:path';

import {
  ZAVORTH_LEARN_SKILL_CONTRACT_VERSION,
  type ZavorthLearnSkillExtract,
  type ZavorthLearnSkillInput,
  type ZavorthLearnSkillSnapshot,
  type ZavorthLearnSkillSourceKind,
  type ZavorthLearnSkillStatus,
} from '../contracts/native/ZavorthLearnSkillContract.js';
import { UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION } from '../contracts/UniversalCapabilityFabricContract.js';
import {
  UniversalCapabilityFabricService,
  type UniversalCapabilityFabricInput,
} from './UniversalCapabilityFabricService.js';
import { SourceSearchFetchService } from './SourceSearchFetchService.js';
import { redactSensitiveText } from '../security/SensitiveDataGuard.js';

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  fabric?: Pick<UniversalCapabilityFabricService, 'buildSnapshot'>;
  searchFetch?: Pick<SourceSearchFetchService, 'fetchAndExtract'>;
};

export class ZavorthLearnSkillService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly fabric: Pick<UniversalCapabilityFabricService, 'buildSnapshot'>;
  private readonly searchFetch: Pick<SourceSearchFetchService, 'fetchAndExtract'>;

  public constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.fabric = runtime.fabric || new UniversalCapabilityFabricService({ projectRoot: this.projectRoot });
    this.searchFetch = runtime.searchFetch || new SourceSearchFetchService();
  }

  public async learn(input: ZavorthLearnSkillInput): Promise<ZavorthLearnSkillSnapshot> {
    const source = String(input.source || '').trim();
    const applyRequested = input.apply === true;
    const consentGranted = input.consent === true || Boolean(String(input.approvalId || '').trim());
    const approvalId = String(input.approvalId || '').trim() || null;
    const label = String(input.label || path.basename(source) || 'learn-skill').trim();

    if (!source) {
      return this.blockedEmpty(applyRequested, consentGranted, approvalId);
    }

    const extract = await this.maybeExtract(source, input.confirmLiveNetwork === true);
    const fabricInput: UniversalCapabilityFabricInput = {
      source,
      kind: 'skill',
      apply: applyRequested && consentGranted,
      allowExecutable: input.allowExecutable === true,
      allowAllCandidates: input.allowAllCandidates === true,
      overwrite: input.overwrite === true,
      label,
      projectRoot: input.projectRoot || this.projectRoot,
    };

    const fabric = await this.fabric.buildSnapshot(fabricInput);
    const status = this.mapStatus(fabric.status, applyRequested, consentGranted);
    const sourceKind = (fabric.source.kind || 'auto') as ZavorthLearnSkillSourceKind;

    return {
      contractVersion: ZAVORTH_LEARN_SKILL_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthLearnSkillService',
      status,
      sourceKind,
      sourceLabel: redactSensitiveText(fabric.source.label || label).slice(0, 200),
      applyRequested,
      consentGranted,
      approvalId,
      extract,
      fabric,
      safety: {
        quarantineRequired: true,
        previewBeforeInstall: true,
        applyRequiresConsentOrApproval: true,
        rawSecretsSerialized: false,
        liveNetworkRequiresConfirm: true,
      },
      commands: {
        preview: `zavorth learn-skill ${shellQuote(source)}`,
        apply: `zavorth learn-skill ${shellQuote(source)} --apply --consent${approvalId ? ` --approval-id ${shellQuote(approvalId)}` : ''}`,
      },
      narrative: this.narrative(
        status,
        Number(fabric.summary.candidates || fabric.summary.skills || 0),
        applyRequested,
        consentGranted,
      ),
    };
  }

  private async maybeExtract(source: string, confirmLiveNetwork: boolean): Promise<ZavorthLearnSkillExtract> {
    if (!/^https?:\/\//i.test(source)) {
      return {
        performed: false,
        title: null,
        contentChars: 0,
        liveNetworkPerformed: false,
        reason: 'Extract runs only for http(s) sources; path/text use fabric intake directly.',
      };
    }
    if (!confirmLiveNetwork) {
      return {
        performed: false,
        title: null,
        contentChars: 0,
        liveNetworkPerformed: false,
        reason: 'Live extract requires --confirm-live-network (fabric still stages via governed scrape when available).',
      };
    }

    try {
      const extracted = await this.searchFetch.fetchAndExtract({
        url: source,
        confirmLiveNetwork: true,
      });
      return {
        performed: extracted.receipt.status === 'fetched',
        title: extracted.title,
        contentChars: extracted.contentChars,
        liveNetworkPerformed: extracted.receipt.liveNetworkPerformed,
        reason: extracted.receipt.reason,
      };
    } catch (error: unknown) {
      return {
        performed: false,
        title: null,
        contentChars: 0,
        liveNetworkPerformed: true,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private mapStatus(
    fabricStatus: string,
    applyRequested: boolean,
    consentGranted: boolean,
  ): ZavorthLearnSkillStatus {
    if (fabricStatus === 'blocked') return 'blocked';
    if (applyRequested && !consentGranted) return 'approval-required';
    if (fabricStatus === 'preview-only' || !applyRequested) return 'preview';
    if (fabricStatus === 'partial') return 'partial';
    if (fabricStatus === 'passed') return 'installed';
    return 'quarantined';
  }

  private narrative(
    status: ZavorthLearnSkillStatus,
    candidateCount: number,
    applyRequested: boolean,
    consentGranted: boolean,
  ): ZavorthLearnSkillSnapshot['narrative'] {
    if (status === 'blocked') {
      return {
        headline: 'Learn skill blocked',
        operatorSummary: 'Source could not be staged for governed skill intake.',
        nextStep: 'Check the source path/URL and re-run preview.',
      };
    }
    if (status === 'approval-required') {
      return {
        headline: 'Learn skill ready for approval',
        operatorSummary: `Preview found ${candidateCount} skill candidate(s). Apply needs --consent or --approval-id.`,
        nextStep: 'Re-run with --apply --consent after reviewing the risk report.',
      };
    }
    if (status === 'preview') {
      return {
        headline: 'Learn skill preview',
        operatorSummary: `Staged ${candidateCount} skill candidate(s) in quarantine for review.`,
        nextStep: 'Review candidates, then install with --apply --consent.',
      };
    }
    if (status === 'installed') {
      return {
        headline: 'Learn skill installed under quarantine policy',
        operatorSummary: 'Materialization completed with governed receipts (executable packs may remain held).',
        nextStep: 'Enable or promote via skills quarantine / trust upgrade if still held.',
      };
    }
    return {
      headline: 'Learn skill partial',
      operatorSummary: applyRequested && consentGranted
        ? 'Some candidates staged or held; see fabric receipts.'
        : 'Preview completed with partial results.',
      nextStep: 'Inspect receipts and re-run with elevated flags only if you accept the risk.',
    };
  }

  private blockedEmpty(
    applyRequested: boolean,
    consentGranted: boolean,
    approvalId: string | null,
  ): ZavorthLearnSkillSnapshot {
    return {
      contractVersion: ZAVORTH_LEARN_SKILL_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthLearnSkillService',
      status: 'blocked',
      sourceKind: 'auto',
      sourceLabel: '',
      applyRequested,
      consentGranted,
      approvalId,
      extract: {
        performed: false,
        title: null,
        contentChars: 0,
        liveNetworkPerformed: false,
        reason: 'No source provided.',
      },
      fabric: {
        contractVersion: UNIVERSAL_CAPABILITY_FABRIC_CONTRACT_VERSION,
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        apply: false,
        source: {
          raw: '',
          kind: 'auto',
          label: '',
          resolvedLocalPath: null,
          remoteUrl: null,
          contentHash: null,
        },
        candidates: [],
        issues: [{ severity: 'blocked', code: 'source.missing', message: 'No source provided.' }],
        receipts: [],
        summary: {
          sources: 0,
          candidates: 0,
          skills: 0,
          plugins: 0,
          mcp: 0,
          unknown: 0,
          highRisk: 0,
          executableCode: 0,
          materialized: 0,
          denied: 0,
          heldForApproval: 0,
        },
        policy: {
          previewBeforeMutate: true,
          approvalRequiredForEnable: true,
          executablePluginsHigherTrust: true,
          mcpStartsDisabled: true,
          instructionSkillsDefault: true,
          catalogIsNotLive: true,
          rawSecretsSerialized: false,
          brandAgnostic: true,
        },
        quarantineRoot: path.join(this.projectRoot, '.zavorth', 'capability-quarantine'),
        narrative: {
          headline: 'Blocked',
          operatorSummary: 'No source provided.',
          nextSafeAction: 'Provide a URL, path, or notes to learn a skill.',
        },
      },
      safety: {
        quarantineRequired: true,
        previewBeforeInstall: true,
        applyRequiresConsentOrApproval: true,
        rawSecretsSerialized: false,
        liveNetworkRequiresConfirm: true,
      },
      commands: {
        preview: 'zavorth learn-skill <url|path|notes>',
        apply: 'zavorth learn-skill <url|path|notes> --apply --consent',
      },
      narrative: {
        headline: 'Learn skill blocked',
        operatorSummary: 'No source provided.',
        nextStep: 'Pass a URL, local path, or pasted notes.',
      },
    };
  }
}

function shellQuote(value: string): string {
  if (!/[\s"']/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
