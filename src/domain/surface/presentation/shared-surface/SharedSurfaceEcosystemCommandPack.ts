import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import type { ZavorthPackagePublisher } from '../../../../platform/publish/ZavorthPackagePublisher.js';
import type { ZavorthPlatformActionService } from '../../../../services/ZavorthPlatformActionService.js';
import type { ZavorthPlatformCatalogSyncService } from '../../../../services/ZavorthPlatformCatalogSyncService.js';
import type { ZavorthPlatformRegistryService } from '../../../../services/ZavorthPlatformRegistryService.js';
import type { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import type { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import type { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import type { UniversalSkillBridgeActivationService } from '../../../../services/UniversalSkillBridgeActivationService.js';
import {
  ZavorthNaturalInvocationRouter,
  type ZavorthNaturalInvocationInput,
} from '../../../../services/ZavorthNaturalInvocationRouter.js';
import {
  ZavorthSubagentInvocationGatewayService,
  type ZavorthSubagentInvocationGatewayInput,
} from '../../../../services/ZavorthSubagentInvocationGatewayService.js';
import { ZavorthAgentSurfaceUxService } from '../../../../services/ZavorthAgentSurfaceUxService.js';
import {
  ZavorthBrowserVisionBridgeService,
} from '../../../../services/ZavorthBrowserVisionBridgeService.js';


import type { ZavorthSubagentRuntimeCommandInput } from '../../../../agents/ZavorthSubagentRuntimeService.js';
import {
  ZavorthVisionControlPlaneService,
  type ZavorthVisionControlPlaneCommandInput,
} from '../../../../services/ZavorthVisionControlPlaneService.js';

import type { ZavorthBrowserVisionInput } from '../../../../contracts/ZavorthBrowserVisionBridgeContract.js';
import { ZavorthComputerControlPlaneService } from '../../../../services/ZavorthComputerControlPlaneService.js';
import type { ZavorthComputerControlInput } from '../../../../contracts/ZavorthComputerControlPlaneContract.js';
import { ZavorthAndroidAdbBridgeService } from '../../../../services/ZavorthAndroidAdbBridgeService.js';
import type { ZavorthAndroidAdbInput } from '../../../../contracts/ZavorthAndroidAdbBridgeContract.js';
import { ZavorthPerceptionInvocationRouter } from '../../../../services/ZavorthPerceptionInvocationRouter.js';
import { replyWithSharedSurfaceResponse } from './SharedSurfaceResponseSender.js';

type SharedSurfaceEcosystemCommandPackDeps = {
  platformActionService: Pick<ZavorthPlatformActionService, 'execute'>;
  platformRegistryService: Pick<ZavorthPlatformRegistryService, 'renderCatalogReport'>;
  platformCatalogSyncService: Pick<ZavorthPlatformCatalogSyncService, 'sync'>;
  platformPublisherService: Pick<ZavorthPackagePublisher, 'publishDetailed'>;
  skillMcpSidecarService: Pick<SkillMcpSidecarService, 'renderReport'>;
  skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'renderReport'>;
  skillInstallPlanPresentationService: Pick<SkillInstallPlanPresentationService, 'renderReport'>;
  skillBridgeActivationService: Pick<UniversalSkillBridgeActivationService, 'executeCommand' | 'renderReport'>;
  subagentInvocationGatewayService?: Pick<ZavorthSubagentInvocationGatewayService, 'invoke' | 'executeCommand' | 'renderReport'> | null;
  naturalInvocationRouterService?: Pick<ZavorthNaturalInvocationRouter, 'plan' | 'renderPlan'> | null;
};

export class SharedSurfaceEcosystemCommandPack {
  private readonly subagentInvocationGateway: Pick<ZavorthSubagentInvocationGatewayService, 'invoke' | 'executeCommand' | 'renderReport'>;
  private readonly naturalInvocationRouter: Pick<ZavorthNaturalInvocationRouter, 'plan' | 'renderPlan'>;
  private readonly agentSurfaceUx = new ZavorthAgentSurfaceUxService();
  private readonly visionControlPlane = new ZavorthVisionControlPlaneService();
  private readonly browserVisionBridge = new ZavorthBrowserVisionBridgeService();
  private readonly computerControlPlane = new ZavorthComputerControlPlaneService();
  private readonly androidAdbBridge = new ZavorthAndroidAdbBridgeService();
  private readonly perceptionInvocationRouter = new ZavorthPerceptionInvocationRouter();

  constructor(private readonly deps: SharedSurfaceEcosystemCommandPackDeps) {
    this.subagentInvocationGateway = deps.subagentInvocationGatewayService || new ZavorthSubagentInvocationGatewayService();
    this.naturalInvocationRouter = deps.naturalInvocationRouterService || new ZavorthNaturalInvocationRouter();
  }

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/platform':
        await this.handlePlatform(ctx, args);
        return true;
      case '/skills':
        await this.handleSkills(ctx, args);
        return true;
      case '/agents':
        await this.handleAgents(ctx, args);
        return true;
      case '/invoke':
        await this.handleInvoke(ctx, args);
        return true;
      case '/sandbox':
        await this.handleInvoke(ctx, `sandbox ${args}`.trim());
        return true;
      case '/vision':
        await this.handleVision(ctx, args);
        return true;
      case '/computer':
        await this.handleComputer(ctx, args);
        return true;
      case '/device':
        await this.handleDevice(ctx, args);
        return true;
      default:
        return false;
    }
  }

  private async handlePlatform(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const actionId = String(tokens[0] || '').trim().toLowerCase();
    const entryId = tokens.slice(1).join(' ').trim();

    if (actionId === 'sync') {
      const result = await this.deps.platformCatalogSyncService.sync();
      const lines = [
        'Platform registry sync',
        '',
        result.summary,
        `Status: ${result.status}.`,
        `Itens: ${result.entryCount} | colecoes: ${result.collectionCount} | recipes: ${result.recipeCount}.`,
        `Cache: ${result.cacheFile || 'n/d'}`,
      ];
      if (result.error) {
        lines.push(`Erro: ${result.error}`);
      }
      await ctx.reply(lines.join('\n'));
      return;
    }

    if (actionId === 'publish' && entryId) {
      const result = await this.deps.platformPublisherService.publishDetailed({
        packagePath: entryId,
        authToken: process.env.ZAVORTH_PLATFORM_PUBLISH_TOKEN || '',
        signLocal: true,
      });
      await ctx.reply([
        'Platform publish',
        '',
        `${result.packageId}@${result.version}`,
        `Release: ${result.releaseId}.`,
        `Status: ${result.uploadStatus}.`,
        `Arquivos: ${result.fileCount}.`,
        `Bundle: ${result.outputFile}`,
      ].join('\n'));
      return;
    }

    if (
      ['inspect', 'open', 'doctor', 'trust', 'review', 'install', 'update', 'remove'].includes(actionId)
      && entryId
    ) {
      const result = await this.deps.platformActionService.execute({
        entryId,
        actionId,
        requestedBy: String(ctx.userId || '').trim() || null,
        workspace: process.cwd(),
      });
      const lines = [
        result.summary,
        ...result.details.slice(0, 8),
        '',
        this.deps.platformRegistryService.renderCatalogReport({
          selectedId: entryId,
          query: entryId,
        }),
      ];
      await ctx.reply(lines.join('\n'));
      return;
    }

    await ctx.reply(
      this.deps.platformRegistryService.renderCatalogReport({
        selectedId: normalizedArgs || null,
        query: normalizedArgs || null,
      }),
    );
  }

  private async handleSkills(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();
    const stripCommandPrefix = (value: string, command: string): string =>
      value.slice(command.length).trim() || '';

    if (this.isSkillBridgeActivationCommand(lower)) {
      await this.handleSkillBridgeActivation(ctx, normalizedArgs);
      return;
    }

    if (lower === 'search' || lower.startsWith('search ')) {
      const query = stripCommandPrefix(normalizedArgs, 'search') || null;
      await ctx.reply(
        this.deps.skillLibraryPresentationService.renderReport({
          selectedId: null,
          query,
        }),
      );
      return;
    }

    if (lower === 'absorb' || lower.startsWith('absorb ') || lower === 'batches' || lower.startsWith('batches ')) {
      const sourcePath = lower.startsWith('absorb ')
        ? stripCommandPrefix(normalizedArgs, 'absorb') || null
        : null;
      const request = sourcePath
        ? `absorva essa biblioteca de skills source ${sourcePath}`
        : 'quebre essa biblioteca grande de skills em batches seguros';
      const plan = await this.naturalInvocationRouter.plan({
        text: request,
        channel: ctx.platform || 'shared-surface',
        actorId: String(ctx.userId || '').trim() || null,
        sourcePath,
        autoExecute: false,
      });
      await replyWithSharedSurfaceResponse(ctx, this.agentSurfaceUx.buildNaturalInvocationResponse(plan));
      return;
    }

    if (lower === 'library' || lower.startsWith('library ')) {
      const query = stripCommandPrefix(normalizedArgs, 'library') || null;
      await ctx.reply(
        this.deps.skillLibraryPresentationService.renderReport({
          selectedId: query,
          query,
        }),
      );
      return;
    }

    if (lower === 'plan' || lower.startsWith('plan ')) {
      const remainder = stripCommandPrefix(normalizedArgs, 'plan');
      const lowerRemainder = remainder.toLowerCase();
      if (lowerRemainder.startsWith('recipe ')) {
        const recipeId = remainder.slice('recipe '.length).trim() || null;
        await ctx.reply(this.deps.skillInstallPlanPresentationService.renderReport({ recipeId }));
        return;
      }
      if (lowerRemainder.startsWith('recommend ')) {
        const recommendFor = remainder.slice('recommend '.length).trim() || null;
        await ctx.reply(this.deps.skillInstallPlanPresentationService.renderReport({ recommendFor }));
        return;
      }
      await ctx.reply(
        this.deps.skillInstallPlanPresentationService.renderReport({
          selectedId: remainder || null,
          query: remainder || null,
        }),
      );
      return;
    }

    if (lower === 'mcp' || lower.startsWith('mcp ')) {
      const query = normalizedArgs.slice(3).trim() || null;
      await ctx.reply(this.deps.skillMcpSidecarService.renderReport({ query }));
      return;
    }

    if (lower.startsWith('recipe ')) {
      const recipeId = normalizedArgs.slice('recipe '.length).trim() || null;
      await ctx.reply(this.deps.skillInstallPlanPresentationService.renderReport({ recipeId }));
      return;
    }

    if (lower.startsWith('recommend ')) {
      const recommendFor = normalizedArgs.slice('recommend '.length).trim() || null;
      await ctx.reply(this.deps.skillInstallPlanPresentationService.renderReport({ recommendFor }));
      return;
    }

    await ctx.reply(this.deps.skillLibraryPresentationService.renderReport({
      selectedId: normalizedArgs || null,
      query: normalizedArgs || null,
    }));
  }

  private async handleSkillBridgeActivation(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const bridgeArgs = /^use(?:\s+|$)/i.test(normalizedArgs)
      ? normalizedArgs.replace(/^use\b/i, 'run').trim()
      : normalizedArgs;
    const snapshot = await this.deps.skillBridgeActivationService.executeCommand({
      args: bridgeArgs,
      channel: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
    });
    await ctx.reply(this.deps.skillBridgeActivationService.renderReport(snapshot));
  }

  private async handleAgents(ctx: IMessageContext, args: string): Promise<void> {
    const command = this.parseAgentRuntimeCommand(ctx, args);
    if (command) {
      const snapshot = await this.subagentInvocationGateway.executeCommand(command);
      await replyWithSharedSurfaceResponse(ctx, this.agentSurfaceUx.buildSubagentRuntimeResponse(snapshot));
      return;
    }

    const parsed = this.parseAgentArgs(args);
    const snapshot = await this.subagentInvocationGateway.invoke({
      source: 'channel',
      text: parsed.text,
      channel: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
      threadId: String(ctx.chatId || '').trim() || null,
      mode: parsed.mode,
      roleIds: parsed.roleIds,
      approvalId: parsed.approvalId,
      live: parsed.live,
      mockLive: parsed.mockLive,
      providerName: parsed.providerName,
      modelName: parsed.modelName,
      persistState: true,
    });
    await replyWithSharedSurfaceResponse(ctx, this.agentSurfaceUx.buildSubagentRuntimeResponse(snapshot));
  }

  private async handleInvoke(
    ctx: IMessageContext,
    args: string,
    options: { naturalText?: boolean } = {},
  ): Promise<void> {
    const parsed = this.parseInvokeArgs(args, options);
    const plan = await this.naturalInvocationRouter.plan({
      text: parsed.text,
      channel: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
      sourcePath: parsed.sourcePath,
      approvalId: parsed.approvalId,
      autoExecute: parsed.autoExecute,
      autoLiveSubagents: true,
      liveSubagents: parsed.liveSubagents,
      mockLiveSubagents: parsed.mockLiveSubagents,
    });
    await replyWithSharedSurfaceResponse(ctx, this.agentSurfaceUx.buildNaturalInvocationResponse(plan));
  }

  private async handleVision(ctx: IMessageContext, args: string): Promise<void> {
    const browserCommand = this.parseBrowserVisionFromVisionCommand(ctx, args);
    if (browserCommand) {
      const snapshot = await this.browserVisionBridge.execute(browserCommand);
      await replyWithSharedSurfaceResponse(ctx, this.browserVisionBridge.buildSurfaceResponse(snapshot));
      return;
    }
    const command = this.parseVisionCommand(ctx, args);
    const snapshot = this.visionControlPlane.buildSnapshot(command);
    await replyWithSharedSurfaceResponse(ctx, this.visionControlPlane.buildSurfaceResponse(snapshot));
  }

  private async handleComputer(ctx: IMessageContext, args: string): Promise<void> {
    const browserCommand = this.parseComputerBrowserCommand(ctx, args);
    if (browserCommand) {
      const snapshot = await this.browserVisionBridge.execute(browserCommand);
      await replyWithSharedSurfaceResponse(ctx, this.browserVisionBridge.buildSurfaceResponse(snapshot));
      return;
    }
    const command = this.parseComputerCommand(ctx, args);
    const snapshot = await this.computerControlPlane.execute(command);
    await replyWithSharedSurfaceResponse(ctx, this.computerControlPlane.buildSurfaceResponse(snapshot));
  }

  private async handleDevice(ctx: IMessageContext, args: string): Promise<void> {
    const command = this.parseDeviceCommand(ctx, args);
    const snapshot = await this.androidAdbBridge.execute(command);
    await replyWithSharedSurfaceResponse(ctx, this.androidAdbBridge.buildSurfaceResponse(snapshot));
  }

  private parseBrowserVisionFromVisionCommand(ctx: IMessageContext, args: string): ZavorthBrowserVisionInput | null {
    const tokens = tokenize(args);
    const scope = String(tokens[0] || '').trim().toLowerCase();
    if (scope !== 'browser') {
      return null;
    }
    return this.parseBrowserCommandTokens(ctx, tokens.slice(1), 'browser.inspect');
  }

  private parseComputerBrowserCommand(ctx: IMessageContext, args: string): ZavorthBrowserVisionInput | null {
    const tokens = tokenize(args);
    const scope = String(tokens[0] || '').trim().toLowerCase();
    if (scope !== 'browser') {
      return null;
    }
    return this.parseBrowserCommandTokens(ctx, tokens.slice(1), 'browser.status');
  }

  private parseComputerCommand(ctx: IMessageContext, args: string): ZavorthComputerControlInput {
    const tokens = tokenize(args);
    const verb = String(tokens[0] || '').trim().toLowerCase();
    const knownVerbs = ['status', 'observe', 'inspect', 'plan', 'approve', 'cancel', 'stop'];
    const rest = knownVerbs.includes(verb) ? tokens.slice(1) : tokens;
    const action = normalizeComputerAction(verb);
    let targetWindow: string | null = null;
    let targetKind: ZavorthComputerControlInput['targetKind'] = 'desktop-window';
    let screenText: string | null = null;
    let targetText: string | null = null;
    let payload: string | null = null;
    let planId: string | null = null;
    let approvalId: string | null = null;
    let runId: string | null = null;
    let live = false;
    let strictApproval: boolean | null = null;
    let maxIterations: number | null = null;
    let maxScreenshots: number | null = null;
    let maxDurationMs: number | null = null;
    let idleTtlMs: number | null = null;
    const objectiveParts: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === '--live') {
        live = true;
        continue;
      }
      if (token === '--strict') {
        strictApproval = true;
        continue;
      }
      if (token === '--no-strict') {
        strictApproval = false;
        continue;
      }
      if (token === '--window' || token === '--target-window') {
        targetWindow = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--window=')) {
        targetWindow = token.slice('--window='.length) || null;
        continue;
      }
      if (token.startsWith('--target-window=')) {
        targetWindow = token.slice('--target-window='.length) || null;
        continue;
      }
      if (token === '--target-kind') {
        targetKind = normalizeComputerTargetKind(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--target-kind=')) {
        targetKind = normalizeComputerTargetKind(token.slice('--target-kind='.length));
        continue;
      }
      if (token === '--screen') {
        screenText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--screen=')) {
        screenText = token.slice('--screen='.length) || null;
        continue;
      }
      if (token === '--target-text') {
        targetText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--target-text=')) {
        targetText = token.slice('--target-text='.length) || null;
        continue;
      }
      if (token === '--payload') {
        payload = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--payload=')) {
        payload = token.slice('--payload='.length) || null;
        continue;
      }
      if (token === '--plan') {
        planId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--plan=')) {
        planId = token.slice('--plan='.length) || null;
        continue;
      }
      if (token === '--approval-id') {
        approvalId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--approval-id=')) {
        approvalId = token.slice('--approval-id='.length) || null;
        continue;
      }
      if (token === '--run') {
        runId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--run=')) {
        runId = token.slice('--run='.length) || null;
        continue;
      }
      if (token === '--max-iterations') {
        maxIterations = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--max-iterations=')) {
        maxIterations = parsePositive(token.slice('--max-iterations='.length));
        continue;
      }
      if (token === '--max-screenshots') {
        maxScreenshots = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--max-screenshots=')) {
        maxScreenshots = parsePositive(token.slice('--max-screenshots='.length));
        continue;
      }
      if (token === '--max-duration-ms') {
        maxDurationMs = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--max-duration-ms=')) {
        maxDurationMs = parsePositive(token.slice('--max-duration-ms='.length));
        continue;
      }
      if (token === '--idle-ttl-ms') {
        idleTtlMs = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--idle-ttl-ms=')) {
        idleTtlMs = parsePositive(token.slice('--idle-ttl-ms='.length));
        continue;
      }
      if (action === 'computer.approve' && !planId && !token.startsWith('--')) {
        planId = token;
        continue;
      }
      if (action === 'computer.cancel' && !runId && !token.startsWith('--')) {
        runId = token;
        continue;
      }
      objectiveParts.push(token);
    }

    return {
      action,
      targetWindow,
      targetKind,
      objective: objectiveParts.join(' ').trim() || null,
      screenText,
      targetText,
      payload,
      planId,
      approvalId,
      runId,
      sourceSurface: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
      live,
      strictApproval,
      maxIterations,
      maxScreenshots,
      maxDurationMs,
      idleTtlMs,
    };
  }

  private parseDeviceCommand(ctx: IMessageContext, args: string): ZavorthAndroidAdbInput {
    const tokens = tokenize(args);
    const maybeScope = String(tokens[0] || '').trim().toLowerCase();
    const scopedTokens = maybeScope === 'android' || maybeScope === 'adb' ? tokens.slice(1) : tokens;
    const verb = String(scopedTokens[0] || '').trim().toLowerCase();
    const knownVerbs = ['status', 'list', 'devices', 'doctor', 'observe', 'inspect', 'screenshot', 'capture', 'ui_dump', 'uidump', 'dump', 'logcat', 'logs', 'plan', 'approve', 'cancel', 'stop'];
    const rest = knownVerbs.includes(verb) ? scopedTokens.slice(1) : scopedTokens;
    const action = normalizeDeviceAction(verb);
    let deviceSerial: string | null = null;
    let packageName: string | null = null;
    let activityName: string | null = null;
    let screenText: string | null = null;
    let uiXml: string | null = null;
    let logcatText: string | null = null;
    let targetText: string | null = null;
    let payload: string | null = null;
    let planId: string | null = null;
    let approvalId: string | null = null;
    let runId: string | null = null;
    let live = false;
    let maxLogLines: number | null = null;
    const objectiveParts: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === '--live') {
        live = true;
        continue;
      }
      if (token === '--device' || token === '--serial') {
        deviceSerial = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--device=')) {
        deviceSerial = token.slice('--device='.length) || null;
        continue;
      }
      if (token.startsWith('--serial=')) {
        deviceSerial = token.slice('--serial='.length) || null;
        continue;
      }
      if (token === '--package') {
        packageName = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--package=')) {
        packageName = token.slice('--package='.length) || null;
        continue;
      }
      if (token === '--activity') {
        activityName = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--activity=')) {
        activityName = token.slice('--activity='.length) || null;
        continue;
      }
      if (token === '--screen') {
        screenText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--screen=')) {
        screenText = token.slice('--screen='.length) || null;
        continue;
      }
      if (token === '--ui-xml' || token === '--xml') {
        uiXml = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--ui-xml=')) {
        uiXml = token.slice('--ui-xml='.length) || null;
        continue;
      }
      if (token.startsWith('--xml=')) {
        uiXml = token.slice('--xml='.length) || null;
        continue;
      }
      if (token === '--logcat') {
        logcatText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--logcat=')) {
        logcatText = token.slice('--logcat='.length) || null;
        continue;
      }
      if (token === '--target-text') {
        targetText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--target-text=')) {
        targetText = token.slice('--target-text='.length) || null;
        continue;
      }
      if (token === '--payload') {
        payload = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--payload=')) {
        payload = token.slice('--payload='.length) || null;
        continue;
      }
      if (token === '--plan') {
        planId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--plan=')) {
        planId = token.slice('--plan='.length) || null;
        continue;
      }
      if (token === '--approval-id') {
        approvalId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--approval-id=')) {
        approvalId = token.slice('--approval-id='.length) || null;
        continue;
      }
      if (token === '--run') {
        runId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--run=')) {
        runId = token.slice('--run='.length) || null;
        continue;
      }
      if (token === '--max-log-lines') {
        maxLogLines = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--max-log-lines=')) {
        maxLogLines = parsePositive(token.slice('--max-log-lines='.length));
        continue;
      }
      if (action === 'device.approve' && !planId && !token.startsWith('--')) {
        planId = token;
        continue;
      }
      if (action === 'device.cancel' && !runId && !token.startsWith('--')) {
        runId = token;
        continue;
      }
      objectiveParts.push(token);
    }

    return {
      action,
      deviceSerial,
      objective: objectiveParts.join(' ').trim() || null,
      packageName,
      activityName,
      screenText,
      uiXml,
      logcatText,
      targetText,
      payload,
      planId,
      approvalId,
      runId,
      sourceSurface: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
      live,
      maxLogLines,
    };
  }

  private parseBrowserCommandTokens(
    ctx: IMessageContext,
    tokens: string[],
    defaultAction: ZavorthBrowserVisionInput['action'],
  ): ZavorthBrowserVisionInput {
    const verb = String(tokens[0] || '').trim().toLowerCase();
    const action = normalizeBrowserAction(verb, defaultAction);
    const knownVerbs = ['status', 'inspect', 'plan', 'apply'];
    const rest = knownVerbs.includes(verb) ? tokens.slice(1) : tokens;
    let url: string | null = null;
    let selector: string | null = null;
    let domText: string | null = null;
    let ariaText: string | null = null;
    let htmlText: string | null = null;
    let pdfText: string | null = null;
    let screenshotText: string | null = null;
    let planId: string | null = null;
    let approvalId: string | null = null;
    let live = false;
    let allowPrivateEgress = false;
    const textParts: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === '--live') {
        live = true;
        continue;
      }
      if (token === '--allow-private-egress') {
        allowPrivateEgress = true;
        continue;
      }
      if (token === '--url') {
        url = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--url=')) {
        url = token.slice('--url='.length) || null;
        continue;
      }
      if (token === '--selector') {
        selector = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--selector=')) {
        selector = token.slice('--selector='.length) || null;
        continue;
      }
      if (token === '--dom') {
        domText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--dom=')) {
        domText = token.slice('--dom='.length) || null;
        continue;
      }
      if (token === '--aria') {
        ariaText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--aria=')) {
        ariaText = token.slice('--aria='.length) || null;
        continue;
      }
      if (token === '--html') {
        htmlText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--html=')) {
        htmlText = token.slice('--html='.length) || null;
        continue;
      }
      if (token === '--pdf') {
        pdfText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--pdf=')) {
        pdfText = token.slice('--pdf='.length) || null;
        continue;
      }
      if (token === '--screenshot-text') {
        screenshotText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--screenshot-text=')) {
        screenshotText = token.slice('--screenshot-text='.length) || null;
        continue;
      }
      if (token === '--plan') {
        planId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--plan=')) {
        planId = token.slice('--plan='.length) || null;
        continue;
      }
      if (token === '--approval-id') {
        approvalId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--approval-id=')) {
        approvalId = token.slice('--approval-id='.length) || null;
        continue;
      }
      if (action === 'browser.apply' && !planId && !token.startsWith('--')) {
        planId = token;
        continue;
      }
      textParts.push(token);
    }

    return {
      action,
      url,
      selector,
      requestText: textParts.join(' ').trim() || null,
      domText,
      ariaText,
      htmlText,
      pdfText,
      screenshotText,
      planId,
      approvalId,
      live,
      allowPrivateEgress,
      sourceSurface: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
    };
  }

  private parseVisionCommand(ctx: IMessageContext, args: string): ZavorthVisionControlPlaneCommandInput {
    const tokens = tokenize(args);
    const verb = String(tokens[0] || '').trim().toLowerCase();
    const action = normalizeVisionAction(verb);
    const rest = action === 'vision.inspect' && !['inspect', 'status', 'explain', 'capture', 'screenshot', 'ocr', 'redact', 'summarize', 'summary'].includes(verb)
      ? tokens
      : tokens.slice(1);
    let targetKind: ZavorthVisionControlPlaneCommandInput['targetKind'] = 'unknown';
    let targetRef: string | null = null;
    let artifactPath: string | null = null;
    let artifactMime: string | null = null;
    let ocrText: string | null = null;
    let retentionTtlMs: number | null = null;
    const textParts: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === '--target-kind') {
        targetKind = normalizeVisionTargetKind(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--target-kind=')) {
        targetKind = normalizeVisionTargetKind(token.slice('--target-kind='.length));
        continue;
      }
      if (token === '--target') {
        targetRef = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--target=')) {
        targetRef = token.slice('--target='.length) || null;
        continue;
      }
      if (token === '--artifact') {
        artifactPath = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--artifact=')) {
        artifactPath = token.slice('--artifact='.length) || null;
        continue;
      }
      if (token === '--mime') {
        artifactMime = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--mime=')) {
        artifactMime = token.slice('--mime='.length) || null;
        continue;
      }
      if (token === '--ocr') {
        ocrText = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token.startsWith('--ocr=')) {
        ocrText = token.slice('--ocr='.length) || null;
        continue;
      }
      if (token === '--retention-ttl-ms') {
        retentionTtlMs = parsePositive(rest[index + 1]);
        index += 1;
        continue;
      }
      if (token.startsWith('--retention-ttl-ms=')) {
        retentionTtlMs = parsePositive(token.slice('--retention-ttl-ms='.length));
        continue;
      }
      textParts.push(token);
    }

    return {
      action,
      targetKind,
      targetRef,
      artifactPath,
      artifactMime,
      ocrText,
      observationText: textParts.join(' ').trim() || null,
      retentionTtlMs,
      sourceSurface: ctx.platform || 'shared-surface',
      actorId: String(ctx.userId || '').trim() || null,
      requestedByNaturalLanguage: false,
    };
  }

  private parseAgentRuntimeCommand(ctx: IMessageContext, args: string): ZavorthSubagentRuntimeCommandInput | null {
    const tokens = tokenize(args);
    const verb = String(tokens[0] || '').trim().toLowerCase();
    const channel = ctx.platform || 'shared-surface';
    const actorId = String(ctx.userId || '').trim() || null;
    if (!verb || ['status', 'list', 'ls', 'history', 'timeline', 'running', 'running'].includes(verb)) {
      return {
        action: 'subagents.list',
        channel,
        actorId,
        sourceSurface: 'channel',
      };
    }
    if (!['wait', 'cancel', 'read', 'summarize', 'summary', 'send'].includes(verb)) {
      return null;
    }
    const sessionId = this.extractOption(tokens, '--session') || tokens[1] || null;
    const message = verb === 'send'
      ? this.extractMessageAfterSeparator(tokens) || tokens.slice(sessionId ? 2 : 1).join(' ')
      : null;
    return {
      action: verb === 'wait'
        ? 'subagents.wait'
        : verb === 'cancel'
          ? 'subagents.cancel'
          : verb === 'read'
            ? 'subagents.read'
            : verb === 'send'
              ? 'subagents.send'
              : 'subagents.summarize',
      sessionId,
      message,
      channel,
      actorId,
      sourceSurface: 'channel',
    };
  }

  private extractOption(tokens: string[], flag: string): string | null {
    const index = tokens.indexOf(flag);
    return index >= 0 ? tokens[index + 1] || null : null;
  }

  private extractMessageAfterSeparator(tokens: string[]): string | null {
    const separatorIndex = tokens.indexOf('--');
    return separatorIndex >= 0 ? tokens.slice(separatorIndex + 1).join(' ').trim() || null : null;
  }

  private parseAgentArgs(args: string): ZavorthSubagentInvocationGatewayInput & {
    approvalId: string | null;
    providerName: string | null;
    modelName: string | null;
    roleIds: string[];
    mockLive: boolean;
  } {
    const tokens = tokenize(args);
    const verb = String(tokens[0] || '').trim().toLowerCase();
    const rest = ['spawn', 'run', 'start'].includes(verb) ? tokens.slice(1) : tokens;
    let live = verb === 'spawn' || verb === 'run' || verb === 'start' || tokens.length > 0;
    let mockLive = false;
    let mode: ZavorthSubagentInvocationGatewayInput['mode'] = /\b(session|persistente)\b/i.test(args) ? 'session' : 'oneshot';
    let approvalId: string | null = null;
    let providerName: string | null = null;
    let modelName: string | null = null;
    let roleIds: string[] = [];
    const textParts: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === '--dry-run' || token === '--plan') {
        live = false;
        continue;
      }
      if (token === '--live') {
        live = true;
        continue;
      }
      if (token === '--mock-live') {
        live = true;
        mockLive = true;
        continue;
      }
      if (token === '--session') {
        mode = 'session';
        continue;
      }
      if (token === '--thread') {
        mode = 'thread-bound';
        continue;
      }
      if (token === '--approval-id') {
        approvalId = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token === '--provider') {
        providerName = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token === '--model') {
        modelName = rest[index + 1] || null;
        index += 1;
        continue;
      }
      if (token === '--roles') {
        roleIds = splitList(rest[index + 1] || '');
        index += 1;
        continue;
      }
      textParts.push(token);
    }

    return {
      source: 'channel',
      text: textParts.join(' ').trim() || 'use subagentes e analise o estado atual em modo read-only',
      mode,
      live,
      mockLive,
      approvalId,
      providerName,
      modelName,
      roleIds,
    };
  }

  private isSkillBridgeActivationCommand(lower: string): boolean {
    return lower === 'bridge'
      || lower.startsWith('bridge ')
      || lower === 'origin'
      || lower.startsWith('origin ')
      || lower === 'use'
      || lower.startsWith('use ')
      || lower === 'run'
      || lower.startsWith('run ')
      || lower === 'invoke'
      || lower.startsWith('invoke ')
      || lower === 'dry-run'
      || lower.startsWith('dry-run ')
      || lower === 'dryrun'
      || lower.startsWith('dryrun ')
      || lower === 'live'
      || lower.startsWith('live ');
  }

  private parseInvokeArgs(
    args: string,
    options: { naturalText?: boolean },
  ): ZavorthNaturalInvocationInput & {
    text: string;
    approvalId: string | null;
    sourcePath: string | null;
    mockLiveSubagents: boolean;
    liveSubagents: boolean;
  } {
    const tokens = tokenize(args);
    const textParts: string[] = [];
    let autoExecute = true;
    let mockLiveSubagents = false;
    let liveSubagents = false;
    let approvalId: string | null = null;
    let sourcePath: string | null = null;

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === '--plan' || token === '--dry-run' || token === '--dryrun') {
        autoExecute = false;
        continue;
      }
      if (token === '--execute' || token === '--run') {
        autoExecute = true;
        continue;
      }
      if (token === '--mock-live') {
        mockLiveSubagents = true;
        liveSubagents = true;
        continue;
      }
      if (token === '--live') {
        liveSubagents = true;
        continue;
      }
      if (token === '--approval-id') {
        approvalId = tokens[index + 1] || null;
        index += 1;
        continue;
      }
      if (token === '--source' || token === '--path') {
        sourcePath = tokens[index + 1] || null;
        index += 1;
        continue;
      }
      textParts.push(token);
    }

    return {
      text: textParts.join(' ').trim() || (options.naturalText ? String(args || '').trim() : 'mostre o status dos agentes'),
      autoExecute,
      approvalId,
      sourcePath,
      mockLiveSubagents,
      liveSubagents,
    };
  }

  private parseNaturalAgentRuntimeCommand(ctx: IMessageContext, rawText: string): ZavorthSubagentRuntimeCommandInput | null {
    const normalized = normalizeNatural(rawText);
    const channel = ctx.platform || 'shared-surface';
    const actorId = String(ctx.userId || '').trim() || null;

    if (
      /\b(o que esta rodando agora|o que esta em execucao|rodando agora|em execucao agora)\b/.test(normalized)
      || /\b(status|estado|liste|listar|mostre)\b.*\b(agentes|subagentes|subagents|agents)\b/.test(normalized)
    ) {
      return {
        action: 'subagents.list',
        channel,
        actorId,
        sourceSurface: 'channel',
      };
    }

    const sessionId = extractNaturalSessionId(rawText);
    if (/\b(cancelar|cancele|pare|parar|stop)\b.*\b(agente|subagente|subagent|agent)\b/.test(normalized)) {
      return {
        action: 'subagents.cancel',
        sessionId,
        channel,
        actorId,
        sourceSurface: 'channel',
      };
    }
    if (/\b(resumir|resume|summary|sumarize|sumarizar)\b.*\b(agente|subagente|subagent|agent)\b/.test(normalized)) {
      return {
        action: 'subagents.summarize',
        sessionId,
        channel,
        actorId,
        sourceSurface: 'channel',
      };
    }
    if (/\b(ler|leia|read)\b.*\b(agente|subagente|subagent|agent)\b/.test(normalized)) {
      return {
        action: 'subagents.read',
        sessionId,
        channel,
        actorId,
        sourceSurface: 'channel',
      };
    }

    return null;
  }

  private looksLikeNaturalInvocation(rawText: string): boolean {
    const normalized = normalizeNatural(rawText);
    return /\b(subagentes?|subagents?|agentes?|agents?)\b/.test(normalized)
      || /\b(skill|skills|biblioteca de skills|pasta de skills|melhor skill|absorv|absorber|importe|importar)\b/.test(normalized)
      || /\b(quebre|chunk|lote|batch|biblioteca grande|large library)\b/.test(normalized)
      || looksLikeVisionRequest(normalized)
      || looksLikeSandboxLifecycleRequest(normalized)
      || /\b(o que esta rodando agora|o que esta em execucao|rodando agora)\b/.test(normalized)
      || /\bmande um agente\b/.test(normalized)
      || /\boutro (validar|revisar|auditar|pesquisar)\b/.test(normalized);
  }

}

function tokenize(value: string): string[] {
  const matches = String(value || '').match(/"([^"]*)"|'([^']*)'|\S+/g) || [];
  return matches.map((entry) => entry.replace(/^["']|["']$/g, '')).filter(Boolean);
}

function splitList(value: string): string[] {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeNatural(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s._:-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNaturalSessionId(value: string): string | null {
  const text = String(value || '').trim();
  const explicit =
    text.match(/\b(?:session|sessao|agente|subagente|id)\s*[:#]?\s*([a-z0-9._:-]{4,})\b/i)
    || text.match(/\b(subagent-[a-z0-9._:-]+|agent-[a-z0-9._:-]+|run-[a-z0-9._:-]+)\b/i);
  return explicit?.[1] || null;
}

function normalizeVisionAction(value: string): ZavorthVisionControlPlaneCommandInput['action'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status') return 'vision.status';
  if (normalized === 'explain') return 'vision.explain';
  if (normalized === 'capture' || normalized === 'screenshot') return 'vision.capture';
  if (normalized === 'ocr') return 'vision.ocr';
  if (normalized === 'redact') return 'vision.redact';
  if (normalized === 'summarize' || normalized === 'summary') return 'vision.summarize';
  return 'vision.inspect';
}

function normalizeVisionTargetKind(value: string | undefined): ZavorthVisionControlPlaneCommandInput['targetKind'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (['desktop', 'pc', 'computer'].includes(normalized)) return 'desktop';
  if (['browser', 'web', 'site'].includes(normalized)) return 'browser';
  if (['android', 'adb', 'phone', 'celular', 'telefone'].includes(normalized)) return 'android';
  if (['device', 'mobile'].includes(normalized)) return 'device';
  if (['artifact', 'file', 'image'].includes(normalized)) return 'artifact';
  return 'unknown';
}

function parsePositive(value: string | undefined): number | null {
  const parsed = safeParseInt(String(value || ''), NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function looksLikeVisionRequest(normalizedText: string): boolean {
  return /\b(olhe|veja|ver|confirme visualmente|visualmente|screenshot|print|tela|ocr|imagem|camera)\b/.test(normalizedText)
    || /\b(computador|desktop|browser|navegador|celular|android|adb)\b.*\b(ver|olhar|inspecionar|confirmar)\b/.test(normalizedText)
    || /\b(olhar|ver|inspecionar|confirmar)\b.*\b(computador|desktop|browser|navegador|celular|android|adb|tela)\b/.test(normalizedText)
    || /\b(abra|abrir|acesse|acessar|navegue|inspecione)\b.*\b(site|url|link|pagina|web|browser|navegador|http)\b/.test(normalizedText);
}

function looksLikeSandboxLifecycleRequest(normalizedText: string): boolean {
  return /\b(docker|dockers|container|containers|gvisor|runsc|firecracker|microvm|micro vm|sandbox|sandboxes)\b/.test(normalizedText)
    && /\b(ligue|liga|suba|subir|start|inicie|iniciar|use|usar|rode|rodar|execute|executar|crie|criar|liste|listar|lista|mostre|mostrar|quais|todos|rodando|ligados?|ativos?|derrube|derrubar|desliga|desligue|mate|matar|limpe|cleanup|stop|pare|parar|encerre|encerrar|doctor|status|pronto|readiness|inventario|inventory)\b/.test(normalizedText);
}

function normalizeBrowserAction(
  value: string,
  fallback: ZavorthBrowserVisionInput['action'],
): ZavorthBrowserVisionInput['action'] {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'status') return 'browser.status';
  if (normalized === 'plan') return 'browser.plan';
  if (normalized === 'apply') return 'browser.apply';
  if (normalized === 'inspect') return 'browser.inspect';
  return fallback;
}

function normalizeComputerAction(value: string): NonNullable<ZavorthComputerControlInput['action']> {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'observe' || normalized === 'inspect') return 'computer.observe';
  if (normalized === 'plan') return 'computer.plan';
  if (normalized === 'approve') return 'computer.approve';
  if (normalized === 'cancel' || normalized === 'stop') return 'computer.cancel';
  return 'computer.status';
}

function normalizeComputerTargetKind(value: string | undefined): NonNullable<ZavorthComputerControlInput['targetKind']> {
  const normalized = String(value || '').trim().toLowerCase();
  if (['browser', 'browser-tab'].includes(normalized)) return 'browser-tab';
  if (['app', 'local-app', 'aplicativo', 'programa'].includes(normalized)) return 'local-app';
  if (['desktop', 'pc', 'computer', 'window', 'janela', 'desktop-window'].includes(normalized)) return 'desktop-window';
  return 'unknown';
}

function normalizeDeviceAction(value: string): NonNullable<ZavorthAndroidAdbInput['action']> {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'list' || normalized === 'devices') return 'device.list';
  if (normalized === 'doctor') return 'device.doctor';
  if (normalized === 'observe' || normalized === 'inspect') return 'device.observe';
  if (normalized === 'screenshot' || normalized === 'capture') return 'device.screenshot';
  if (normalized === 'ui_dump' || normalized === 'uidump' || normalized === 'dump') return 'device.ui_dump';
  if (normalized === 'logcat' || normalized === 'logs') return 'device.logcat';
  if (normalized === 'plan') return 'device.plan';
  if (normalized === 'approve') return 'device.approve';
  if (normalized === 'cancel' || normalized === 'stop') return 'device.cancel';
  return 'device.status';
}
