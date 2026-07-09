import fs from 'node:fs';
import path from 'node:path';
import { SlackChannelPack } from '../adapters/channels/SlackChannelPack.js';
import { WhatsAppChannelPack } from '../adapters/channels/WhatsAppChannelPack.js';
import type {
  ChannelPackageEvidence,
  ChannelPackEntry,
  ChannelPackStatus,
  ChannelRuntimeContract,
  ChannelRuntimeFamily,
  ChannelRuntimeId,
  ChannelSecretPolicyReceipt,
  SourceChannelMeshExpansionSnapshot,
  SourceChannelMeshPackageName,
} from '../contracts/SourceChannelMeshExpansionContract.js';
import {
  SOURCE_CHANNEL_MESH_PACKAGES,
  ZAVORTH_SOURCE_CHANNEL_MESH_EXPANSION_CONTRACT_VERSION,
} from '../contracts/SourceChannelMeshExpansionContract.js';
import { SourceChannelSecretPolicyService } from './SourceChannelSecretPolicyService.js';
import { SourceChannelSimulatorService } from './SourceChannelSimulatorService.js';
import { resolveZavorthSourceRoot } from './ZavorthSourceRootResolver.js';
import { logger } from '../logger.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  secretPolicyService?: SourceChannelSecretPolicyService;
  simulatorService?: SourceChannelSimulatorService;
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Reference = {
  relativePath: string;
  kind: 'package-json' | 'lockfile' | 'source';
};

type PackDescriptor = {
  channelId: ChannelRuntimeId;
  family: ChannelRuntimeFamily;
  adapterPath: string;
  packageNames: SourceChannelMeshPackageName[];
  actions: ChannelRuntimeContract['actions'];
  decision: ChannelPackEntry['decision'];
  ownerApprovalRequired: boolean;
  requiredSecretRefs: string[];
  optionalSecretRefs: string[];
  allowlistRefs: string[];
  notes: string[];
};

const GENERATED_OR_VENDOR_ROOTS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'tmp',
]);

const LOCKFILE_NAMES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SOURCE_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);

const PACKS: PackDescriptor[] = [
  {
    channelId: 'slack',
    family: 'slack-web-api',
    adapterPath: 'src/adapters/channels/SlackChannelPack.ts',
    packageNames: ['@slack/web-api'],
    actions: ['send', 'receive', 'thread', 'edit', 'delete', 'reaction', 'attachment'],
    decision: 'implemented',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['SLACK_BOT_TOKEN'],
    optionalSecretRefs: ['SLACK_SIGNING_SECRET', 'SLACK_WORKSPACE_ID'],
    allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
    notes: ['Slack live smoke is available only through explicit --confirm-live-io.'],
  },
  {
    channelId: 'whatsapp-cloud',
    family: 'whatsapp-cloud-api',
    adapterPath: 'src/gateways/WhatsAppGateway.ts',
    packageNames: ['qrcode'],
    actions: ['send', 'receive', 'edit'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'],
    optionalSecretRefs: ['WHATSAPP_PHONE_NUMBER_ID'],
    allowlistRefs: ['WHATSAPP_ALLOWED_CHAT_IDS'],
    notes: ['Cloud API path stays the default WhatsApp route for Zavorth.'],
  },
  {
    channelId: 'whatsapp-baileys',
    family: 'whatsapp-baileys-owner-gated',
    adapterPath: 'src/adapters/channels/WhatsAppChannelPack.ts',
    packageNames: ['@whiskeysockets/baileys', 'qrcode'],
    actions: ['send', 'receive', 'attachment'],
    decision: 'implemented-owner-gated',
    ownerApprovalRequired: true,
    requiredSecretRefs: ['WHATSAPP_BAILEYS_SESSION_SECRET_REF'],
    optionalSecretRefs: ['WHATSAPP_BAILEYS_PAIRING_MODE'],
    allowlistRefs: ['WHATSAPP_ALLOWED_CHAT_IDS'],
    notes: ['Baileys is not installed or enabled by default; patch-risk owner decision is required first.'],
  },
  {
    channelId: 'discord',
    family: 'discord-native',
    adapterPath: 'src/gateways/DiscordGateway.ts',
    packageNames: ['discord.js'],
    actions: ['send', 'receive', 'thread', 'reaction', 'attachment'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['DISCORD_BOT_TOKEN'],
    optionalSecretRefs: ['DISCORD_OWNER_USER_IDS'],
    allowlistRefs: ['DISCORD_ALLOWED_CHANNEL_IDS', 'DISCORD_ALLOWED_GUILD_IDS'],
    notes: ['Existing Discord gateway is retained as the native Zavorth channel pack.'],
  },
  {
    channelId: 'telegram',
    family: 'telegram-native',
    adapterPath: 'src/adapters/telegram/BotGateway.ts',
    packageNames: ['grammy'],
    actions: ['send', 'receive', 'thread', 'edit', 'delete', 'reaction', 'attachment'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['TELEGRAM_BOT_TOKEN'],
    optionalSecretRefs: ['TELEGRAM_ADMIN_USER_IDS'],
    allowlistRefs: ['TELEGRAM_ALLOWED_USER_IDS', 'TELEGRAM_ALLOWED_CHAT_IDS'],
    notes: ['Telegram remains the live-ready native channel already present in Zavorth.'],
  },
  {
    channelId: 'signal',
    family: 'signal-bridge',
    adapterPath: 'src/adapters/channels/SignalLiveClient.ts',
    packageNames: ['signal-utils'],
    actions: ['send', 'receive'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['SIGNAL_ACCOUNT_NUMBER'],
    optionalSecretRefs: ['SIGNAL_JSONRPC_URL', 'SIGNAL_CLI_PATH'],
    allowlistRefs: ['SIGNAL_ALLOWED_RECIPIENTS'],
    notes: ['Signal uses existing JSON-RPC/signal-cli bridge semantics, not Source source.'],
  },
  {
    channelId: 'matrix',
    family: 'matrix-relay',
    adapterPath: 'src/services/ChannelLongTailActivationService.ts',
    packageNames: ['@matrix-org/matrix-sdk-crypto-nodejs'],
    actions: ['send', 'receive', 'thread'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['MATRIX_ACCESS_TOKEN'],
    optionalSecretRefs: ['MATRIX_HOMESERVER_URL'],
    allowlistRefs: ['MATRIX_ROOM_IDS'],
    notes: ['Matrix is covered by the long-tail relay family; crypto-native SDK remains optional.'],
  },
  {
    channelId: 'msteams',
    family: 'teams-graph',
    adapterPath: 'src/adapters/channels/TeamsGraphBotClient.ts',
    packageNames: [],
    actions: ['send', 'receive', 'thread', 'edit', 'attachment'],
    decision: 'replaced-by-existing-zavorth-channel',
    ownerApprovalRequired: false,
    requiredSecretRefs: ['TEAMS_CLIENT_SECRET'],
    optionalSecretRefs: ['TEAMS_TENANT_ID', 'TEAMS_APP_ID'],
    allowlistRefs: ['TEAMS_ALLOWED_CONVERSATION_IDS'],
    notes: ['Teams remains Microsoft Graph based and SecretRef-only.'],
  },
];

export class SourceChannelMeshExpansionService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly secretPolicy: SourceChannelSecretPolicyService;
  private readonly simulator: SourceChannelSimulatorService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.secretPolicy = runtime.secretPolicyService || new SourceChannelSecretPolicyService();
    this.simulator = runtime.simulatorService || new SourceChannelSimulatorService({
      now: this.now,
    });
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): SourceChannelMeshExpansionSnapshot {
    const zavorthRoot = path.resolve(input.zavorthRoot || this.zavorthRoot || process.cwd());
    const sourceRoot = resolveZavorthSourceRoot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot,
    });
    const packageEvidence = SOURCE_CHANNEL_MESH_PACKAGES.map((packageName) =>
      this.buildPackageEvidence(packageName, sourceRoot, zavorthRoot),
    );
    const packs = PACKS.map((descriptor) =>
      this.buildPack(descriptor, packageEvidence, sourceRoot, zavorthRoot),
    );
    const simulator = this.simulator.runScenario('slack');
    const status = this.resolveStatus(packs, simulator);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_CHANNEL_MESH_EXPANSION_CONTRACT_VERSION,
      status,
      phase: 4,
      statement: 'Source channel behavior is absorbed as optional Zavorth Channel Mesh packs, offline simulator coverage, secret policy and live-smoke receipts.',
      sourceRoot: normalizePath(sourceRoot),
      zavorthRoot: normalizePath(zavorthRoot),
      packageEvidence,
      packs,
      simulator,
      summary: {
        packagesTracked: SOURCE_CHANNEL_MESH_PACKAGES.length,
        packagesPresentInSource: packageEvidence.filter((entry) => entry.presentInSource).length,
        packagesImplementedInZavorth: packageEvidence.filter((entry) => entry.presentInZavorthPackageJson).length,
        packs: packs.length,
        packsReadyOrReplaced: packs.filter((entry) =>
          ['ready', 'configured', 'replaced-by-existing-channel', 'owner_decision_required'].includes(entry.status),
        ).length,
        ownerGatedPacks: packs.filter((entry) => entry.ownerApprovalRequired).length,
        simulatorReceipts: simulator.summary.receipts,
        actionsCovered: simulator.actionsCovered.length,
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
      },
      policy: {
        noSourceSourceCopy: true,
        optionalPacksOnly: true,
        noLiveIoDuringStage4Check: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        secretRefOnlyChannelAuth: true,
        allowlistRequiredBeforeLiveSend: true,
        whatsappBaileysRequiresPatchRiskOwnerDecision: true,
        artifactFirstReceipts: true,
      },
      commands: {
        inspect: 'npm run source-channel-mesh-expansion --silent',
        inspectJson: 'npm run source-channel-mesh-expansion:json --silent',
        check: 'npm run source-channel-mesh-expansion:check --silent',
        qa: 'npm run qa:source-channel-mesh-expansion --silent',
        liveSmoke: 'npm run source-channel-mesh-expansion -- --channel <channel> --confirm-live-io',
        nextStage: 'Credential vault - Memory, Document, Search And Terminal Pack',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Source Channel Mesh Expansion - Connector registry',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Channel packages tracked: ${snapshot.summary.packagesTracked}`,
      `Channel packages present in Source: ${snapshot.summary.packagesPresentInSource}`,
      `Channel packages implemented in Zavorth: ${snapshot.summary.packagesImplementedInZavorth}`,
      `Packs: ${snapshot.summary.packs}`,
      `Packs ready/replaced: ${snapshot.summary.packsReadyOrReplaced}`,
      `Owner-gated packs: ${snapshot.summary.ownerGatedPacks}`,
      `Simulator receipts: ${snapshot.summary.simulatorReceipts}`,
      `Simulator actions covered: ${snapshot.summary.actionsCovered}`,
      `Live I/O performed: ${snapshot.summary.liveIoPerformed}`,
    ];

    lines.push('Packs:');
    for (const pack of snapshot.packs) {
      lines.push(`- ${pack.channelId}: ${pack.status}, decision=${pack.decision}, configured=${pack.configured}`);
    }
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  public async runSlackLiveSmoke(input: {
    channelId: string;
    text?: string;
    confirmLiveIo?: boolean;
  }) {
    return new SlackChannelPack({
      now: this.now,
    }).runLiveSmoke(input);
  }

  private buildPack(
    descriptor: PackDescriptor,
    packageEvidence: ChannelPackageEvidence[],
    sourceRoot: string,
    zavorthRoot: string,
  ): ChannelPackEntry {
    const secretPolicy = this.secretPolicy.buildReceipt({
      channelId: descriptor.channelId,
      requiredSecretRefs: descriptor.requiredSecretRefs,
      optionalSecretRefs: descriptor.optionalSecretRefs,
      allowlistRefs: descriptor.allowlistRefs,
    });
    const adapterExists = fs.existsSync(path.join(zavorthRoot, descriptor.adapterPath));
    const packageState = this.resolvePackageState(descriptor, packageEvidence);
    const status = this.resolvePackStatus(descriptor, adapterExists, packageState, secretPolicy);
    const patchRiskReceipt = descriptor.channelId === 'whatsapp-baileys'
      ? new WhatsAppChannelPack().buildBaileysPatchRiskReceipt({
          sourcePatchPresent: this.hasBaileysPatch(sourceRoot),
          packageInstalledInZavorth: packageEvidence.find((entry) => entry.packageName === '@whiskeysockets/baileys')?.presentInZavorthPackageJson === true,
          patchEvidencePath: 'patches/@whiskeysockets__baileys@7.0.0-rc.9.patch',
        })
      : undefined;

    return {
      channelId: descriptor.channelId,
      family: descriptor.family,
      status,
      decision: descriptor.decision,
      contract: {
        channelId: descriptor.channelId,
        family: descriptor.family,
        actions: descriptor.actions,
        liveIoByDefault: false,
        explicitLiveCommandRequired: true,
        secretRefOnlyAuth: true,
        allowlistRequired: true,
        secretValuesSerialized: false,
      },
      adapterPath: descriptor.adapterPath,
      packageNames: descriptor.packageNames,
      configured: secretPolicy.status === 'passed',
      ownerApprovalRequired: descriptor.ownerApprovalRequired,
      liveIoPerformed: false,
      enabledByDefault: false,
      secretPolicy,
      ...(patchRiskReceipt ? { patchRiskReceipt } : {}),
      liveSmokeCommand: `npm run source-channel-mesh-expansion -- --channel ${descriptor.channelId} --confirm-live-io`,
      notes: descriptor.notes,
    };
  }

  private resolvePackageState(
    descriptor: PackDescriptor,
    packageEvidence: ChannelPackageEvidence[],
  ): 'implemented' | 'partial' | 'not-required' {
    if (descriptor.packageNames.length === 0) return 'not-required';
    const implemented = descriptor.packageNames.filter((packageName) =>
      packageEvidence.find((entry) => entry.packageName === packageName)?.presentInZavorthPackageJson === true,
    );
    if (implemented.length === descriptor.packageNames.length) return 'implemented';
    if (implemented.length > 0) return 'partial';
    return 'not-required';
  }

  private resolvePackStatus(
    descriptor: PackDescriptor,
    adapterExists: boolean,
    packageState: 'implemented' | 'partial' | 'not-required',
    secretPolicy: ChannelSecretPolicyReceipt,
  ): ChannelPackStatus {
    if (descriptor.ownerApprovalRequired) {
      return 'owner_decision_required';
    }
    if (!adapterExists) {
      return 'missing';
    }
    if (descriptor.decision === 'replaced-by-existing-zavorth-channel') {
      return 'replaced-by-existing-channel';
    }
    if (packageState === 'not-required') {
      return 'missing';
    }
    return secretPolicy.status === 'passed' ? 'configured' : 'ready';
  }

  private resolveStatus(
    packs: ChannelPackEntry[],
    simulator: { status: 'passed' | 'failed' },
  ): 'passed' | 'failed' {
    if (simulator.status !== 'passed') return 'failed';
    if (packs.some((pack) => pack.status === 'missing' || pack.status === 'blocked')) return 'failed';
    if (packs.some((pack) => pack.liveIoPerformed || pack.enabledByDefault)) return 'failed';
    const baileys = packs.find((pack) => pack.channelId === 'whatsapp-baileys');
    if (baileys?.patchRiskReceipt?.status !== 'owner_decision_required') return 'failed';
    return 'passed';
  }

  private buildPackageEvidence(
    packageName: SourceChannelMeshPackageName,
    sourceRoot: string,
    zavorthRoot: string,
  ): ChannelPackageEvidence {
    const sourceReferences = this.findPackageReferences(sourceRoot, packageName);
    const zavorthReferences = this.findPackageReferences(zavorthRoot, packageName);
    return {
      packageName,
      presentInSource: sourceReferences.length > 0,
      presentInZavorthPackageJson: zavorthReferences.some((reference) => reference.kind === 'package-json'),
      presentInZavorthLockfile: zavorthReferences.some((reference) => reference.kind === 'lockfile'),
      sourceReferenceFiles: sourceReferences.map((reference) => reference.relativePath),
      zavorthReferenceFiles: zavorthReferences.map((reference) => reference.relativePath),
      decision: packageDecision(packageName),
    };
  }

  private findPackageReferences(root: string, packageName: SourceChannelMeshPackageName): Reference[] {
    if (!fs.existsSync(root)) {
      return [];
    }
    const references: Reference[] = [];
    for (const file of collectCandidateFiles(root)) {
      const text = readText(file);
      if (!text.includes(packageName)) continue;
      const relativePath = normalizePath(path.relative(root, file));
      if (path.basename(file) === 'package.json') {
        const packageJson = parseJson(text);
        if (packageJsonHasDependency(packageJson, packageName)) {
          references.push({
            relativePath: `${relativePath}${dependencySections(packageJson, packageName)}`,
            kind: 'package-json',
          });
          continue;
        }
      }
      references.push({
        relativePath,
        kind: LOCKFILE_NAMES.has(path.basename(file)) ? 'lockfile' : 'source',
      });
    }
    return dedupeReferences(references);
  }

  private hasBaileysPatch(sourceRoot: string): boolean {
    return fs.existsSync(path.join(sourceRoot, 'patches', '@whiskeysockets__baileys@7.0.0-rc.9.patch'));
  }
}

function packageDecision(packageName: SourceChannelMeshPackageName): ChannelPackageEvidence['decision'] {
  if (packageName === '@whiskeysockets/baileys' || packageName === '@matrix-org/matrix-sdk-crypto-nodejs') {
    return 'owner-gated';
  }
  if (packageName === '@slack/bolt' || packageName === 'signal-utils') {
    return 'not-needed';
  }
  if (packageName === 'discord.js' || packageName === 'grammy') {
    return 'replaced';
  }
  return 'implemented';
}

function collectCandidateFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readDir(current)) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (GENERATED_OR_VENDOR_ROOTS.has(entry.name)) continue;
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile() && isCandidateFile(entry.name)) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort();
}

function isCandidateFile(fileName: string): boolean {
  if (fileName === 'package.json' || LOCKFILE_NAMES.has(fileName)) return true;
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function packageJsonHasDependency(packageJson: PackageJsonShape | null, packageName: string): boolean {
  if (!packageJson) return false;
  return dependencySectionNames().some((section) => Boolean(packageJson[section]?.[packageName]));
}

function dependencySections(packageJson: PackageJsonShape | null, packageName: string): string {
  if (!packageJson) return '';
  const sections = dependencySectionNames().filter((section) => Boolean(packageJson[section]?.[packageName]));
  return sections.length > 0 ? `#${sections.join(',')}` : '';
}

function dependencySectionNames(): Array<keyof PackageJsonShape> {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
}

function parseJson(text: string): PackageJsonShape | null {
  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch (error: unknown) {logger.warn('[Source Channel Mesh Expansion] JSON parse failed', error); return null; }
}

function dedupeReferences(references: Reference[]): Reference[] {
  const seen = new Map<string, Reference>();
  for (const reference of references) {
    seen.set(`${reference.kind}:${reference.relativePath}`, reference);
  }
  return Array.from(seen.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function readDir(absolutePath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch (error: unknown) {logger.warn('[Source Channel Mesh Expansion] filesystem operation failed', error); return []; }
}

function readText(absolutePath: string): string {
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > 25 * 1024 * 1024) return '';
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error: unknown) {logger.warn('[Source Channel Mesh Expansion] filesystem operation failed', error); return ''; }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
