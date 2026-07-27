import path from 'node:path';
import type {
  ZavorthSkillEcosystemPackSnapshot,
  ZavorthSkillEcosystemStatus,
} from '../contracts/ZavorthSkillEcosystemPackContract.js';
import { ZAVORTH_SKILL_ECOSYSTEM_PACK_CONTRACT_VERSION } from '../contracts/ZavorthSkillEcosystemPackContract.js';

import { ZavorthSkillEcosystemImporterService } from './ZavorthSkillEcosystemImporterService.js';
import { ZavorthSkillPackReceiptEmitterService } from './ZavorthSkillPackReceiptEmitterService.js';
import { ZavorthSkillPermissionProfileService } from './ZavorthSkillPermissionProfileService.js';
import { ZavorthSkillSmokeRunnerService } from './ZavorthSkillSmokeRunnerService.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  importer?: ZavorthSkillEcosystemImporterService;
  permissionProfileService?: ZavorthSkillPermissionProfileService;
  smokeRunner?: ZavorthSkillSmokeRunnerService;
  receiptEmitter?: ZavorthSkillPackReceiptEmitterService;
};

export class ZavorthSkillEcosystemPackService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly importer: ZavorthSkillEcosystemImporterService;
  private readonly permissionProfileService: ZavorthSkillPermissionProfileService;
  private readonly smokeRunner: ZavorthSkillSmokeRunnerService;
  private readonly receiptEmitter: ZavorthSkillPackReceiptEmitterService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.permissionProfileService = runtime.permissionProfileService || new ZavorthSkillPermissionProfileService({
      now: this.now,
    });
    this.importer = runtime.importer || new ZavorthSkillEcosystemImporterService({
      now: this.now,
    });
    this.smokeRunner = runtime.smokeRunner || new ZavorthSkillSmokeRunnerService({
      now: this.now,
      permissionProfileService: this.permissionProfileService,
    });
    this.receiptEmitter = runtime.receiptEmitter || new ZavorthSkillPackReceiptEmitterService({
      now: this.now,
    });
  }

  public buildSnapshot(): ZavorthSkillEcosystemPackSnapshot {
    const importer = this.importer.buildSnapshot();
    const permissions = this.permissionProfileService.buildSnapshot(importer.manifests);
    const smokeRunner = this.smokeRunner.buildSnapshot(importer.manifests);
    const receipts = this.receiptEmitter.buildSnapshot({
      manifests: importer.manifests,
      evaluations: permissions.evaluations,
      smokeResults: smokeRunner.results,
    });
    const statuses = [importer.status, permissions.status, smokeRunner.status, receipts.status];
    const status: ZavorthSkillEcosystemStatus = statuses.includes('fail') ? 'failed' : 'passed';
    const liveManifests = importer.manifests.filter((manifest) =>
      manifest.permissionProfileId === 'connector-live-secretref'
        || manifest.requiredSecretRefs.length > 0);
    const capabilityTags = new Set(importer.manifests.flatMap((manifest) => manifest.capabilityTags));

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SKILL_ECOSYSTEM_PACK_CONTRACT_VERSION,
      status,
      phase: 8,
      statement: 'Zavorth skill ecosystem capacity is optional, manifest-driven, policy-aware and receipt-first.',
      runtime: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: normalizePath(this.rootDir),
      },
      importer,
      permissions,
      smokeRunner,
      receipts,
      summary: {
        manifests: importer.manifests.length,
        connectorConcepts: importer.connectorConcepts,
        capabilityTags: capabilityTags.size,
        permissionProfiles: permissions.profiles.length,
        smokeTests: smokeRunner.smokeTests,
        receipts: receipts.receipts.length,
        optionalSkills: importer.manifests.filter((manifest) => manifest.optional).length,
        inspectableBeforeEnablement: importer.manifests
          .filter((manifest) => manifest.inspectableBeforeEnablement)
          .length,
        enabledByDefault: false,
        liveSkillsRequireOwnerApproval: liveManifests.every((manifest) => manifest.ownerApprovalRequiredForEnablement),
        liveSkillsRequireSecretRef: liveManifests.every((manifest) => manifest.requiredSecretRefs.length > 0),
        nonDestructiveSmokeOnly: true,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
      },
      policy: {
        optionalEcosystemCapacity: true,
        inspectBeforeEnablement: true,
        nonDestructiveSmokeOnly: true,
        liveSkillsRequireOwnerApproval: true,
        liveSkillsRequireSecretRef: true,
        noSecretsInReceipts: true,
        noCoreBloat: true,
        mcpAcpBridgeOptional: true,
      },
      commands: {
        inspect: 'npm run zavorth-skill-ecosystem-pack --silent',
        inspectJson: 'npm run zavorth-skill-ecosystem-pack:json --silent',
        check: 'npm run zavorth-skill-ecosystem-pack:check --silent',
        qa: 'npm run qa:zavorth-skill-ecosystem-pack --silent',
        nextAction: 'Certification matrix - Full Functional Closure',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSkillEcosystemPackSnapshot): string {
    const lines = [
      'Zavorth Skill Ecosystem Pack - ZavorthControl controls',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Manifests: ${snapshot.summary.manifests}`,
      `Connector concepts: ${snapshot.summary.connectorConcepts}`,
      `Capability tags: ${snapshot.summary.capabilityTags}`,
      `Permission profiles: ${snapshot.summary.permissionProfiles}`,
      `Smoke tests: ${snapshot.summary.smokeTests}`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Optional skills: ${snapshot.summary.optionalSkills}`,
      `Inspectable before enablement: ${snapshot.summary.inspectableBeforeEnablement}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Live skills require owner approval: ${snapshot.summary.liveSkillsRequireOwnerApproval}`,
      `Live skills require SecretRef: ${snapshot.summary.liveSkillsRequireSecretRef}`,
      `Non-destructive smoke only: ${snapshot.summary.nonDestructiveSmokeOnly}`,
      `Live external IO performed: ${snapshot.summary.liveExternalIoPerformed}`,
      'Manifests:',
      ...snapshot.importer.manifests.slice(0, 12).map((manifest) => (
        `- ${manifest.id}: profile=${manifest.permissionProfileId}, tags=${manifest.capabilityTags.join(',')}`
      )),
      `Next: ${snapshot.commands.nextAction}`,
    ];
    return lines.join('\n');
  }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
