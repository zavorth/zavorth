import { DiscordGatewayRepairFlowService } from '../../../../services/DiscordGatewayRepairFlowService.js';
import { GatewayHealthRenewalService } from '../../../../services/GatewayHealthRenewalService.js';
import type {
  RuntimeAccessChannelProviderDoctorSnapshot,
  RuntimeAccessZavorthControlSnapshot,
  RuntimeAccessReadinessReport,
  RuntimeAccessReadinessStep,
  RuntimeAccessResolvedInput,
} from './RuntimeAccessReadinessTypes.js';

type RuntimeAccessSurfaceProbe = {
  ok: boolean;
  targetUrl: string;
  statusCode: number | null;
  error: string | null;
};

type RuntimeAccessReportBuilderOptions = {
  now: () => Date;
  publicBaseUrl: string;
  highRiskApprovalPin: string;
  buildLocalBaseUrl: (zavorthControl: RuntimeAccessZavorthControlSnapshot | null) => string;
  discordGatewayRepairFlowService: Pick<DiscordGatewayRepairFlowService, 'inspect'>;
  gatewayHealthRenewalService: Pick<GatewayHealthRenewalService, 'inspect'>;
};

export class RuntimeAccessReadinessReportService {
  constructor(private readonly options: RuntimeAccessReportBuilderOptions) {}

  public buildReport(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null = null): RuntimeAccessReadinessReport {
    const localBaseUrl = this.options.buildLocalBaseUrl(input.zavorthControl);
    const localIssues = this.buildLocalIssues(input, localProbe);
    const remoteIssues = this.buildRemoteIssues(input);
    const localReady = this.buildLocalBlockingIssues(input, localProbe).length === 0;
    const remoteReady = localReady && remoteIssues.length === 0;
    const recommendations = this.buildRecommendations(input, localReady, remoteReady);
    const nextSteps = this.buildNextSteps(input, remoteReady, localProbe);

    return {
      checkedAt: this.options.now().toISOString(),
      runtime: {
        ...input,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: input.hostIdentity?.firstRun ?? null,
      },
      auth: input.auth,
      local: {
        baseUrl: localBaseUrl,
        zavorthControlUrl: `${localBaseUrl}/zavorthControl`,
        appUrl: `${localBaseUrl}/zavorthControl`,
        ready: localReady,
        issues: localIssues,
      },
      remote: {
        baseUrl: this.options.publicBaseUrl || null,
        appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl}/zavorthControl` : null,
        ready: remoteReady,
        issues: remoteIssues,
      },
      recommendations,
      nextSteps,
      summary: this.buildSummary(localReady, remoteReady, localIssues, remoteIssues),
    };
  }

  public buildLocalBlockingIssues(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null): string[] {
    const issues: string[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    if (!input.hostSupervisor.alive && !surfaceHealthy) issues.push('The host supervisor is not active.');
    if (!input.telegramWorker.alive && !surfaceHealthy) issues.push('The main Zavorth worker is not active.');
    if (input.providers.readyCount === 0) issues.push('No conversational provider is ready on the current runtime.');
    if (input.nodeMeshSmoke.status === 'failed') issues.push('The last real Node Mesh smoke failed; the local runtime should not be treated as ready yet.');
    if (input.systemOverlordSmoke.status === 'failed') issues.push('The last System Overlord smoke failed; review supervised browser/tunnel/WSL/Docker before trusting these surfaces.');
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('The current host has not been authorized for mutable executions yet.');
    if (localProbe && !localProbe.ok) issues.push(this.describeLocalProbeFailure(localProbe));
    return issues;
  }

  public buildLocalIssues(input: RuntimeAccessResolvedInput, localProbe: RuntimeAccessSurfaceProbe | null): string[] {
    const issues: string[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    if (!input.hostSupervisor.alive && !surfaceHealthy) issues.push('The host supervisor is not active.');
    if (!input.telegramWorker.alive && !surfaceHealthy) issues.push('The main Zavorth worker is not active.');
    if (input.providers.readyCount === 0) issues.push('No conversational provider is ready on the current runtime.');
    if (input.nodeMeshSmoke.status === 'failed') {
      issues.push(input.nodeMeshSmoke.error ? `The real Node Mesh smoke failed on the last execution: ${input.nodeMeshSmoke.error}` : 'The real Node Mesh smoke failed on the last execution.');
    }
    if (input.systemOverlordSmoke.status === 'failed') {
      issues.push(input.systemOverlordSmoke.summary ? `The System Overlord smoke failed on the last execution: ${input.systemOverlordSmoke.summary}` : 'The System Overlord smoke failed on the last execution.');
    }
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('The current host has not been authorized for mutable execution yet.');
    if (localProbe && !localProbe.ok) issues.push(this.describeLocalProbeFailure(localProbe));
    return issues;
  }

  public buildRemoteIssues(input: RuntimeAccessResolvedInput): string[] {
    const issues: string[] = [];
    if (!this.options.publicBaseUrl) {
      issues.push('ZAVORTH_PUBLIC_BASE_URL has not been configured yet.');
    } else if (!this.options.publicBaseUrl.toLowerCase().startsWith('https://')) {
      issues.push('The public Zavorth URL must use HTTPS for the remote web shell.');
    }
    if (!input.auth.enabled) issues.push('The web token is not ready yet.');
    if (input.hostIdentity && input.hostIdentity.authorized === false) issues.push('The current host has not been authorized for mutable execution yet.');
    if (input.tenants.pendingOnboardingCount > 0) issues.push('Shared tenants still need complete onboarding/policy.');
    if (input.nodeMeshSmoke.status === 'failed') issues.push('The latest real Node Mesh smoke failed; review the remote plan before trusting paired invokes.');
    if (input.systemOverlordSmoke.status === 'failed') issues.push('The System Overlord smoke check failed; revalidate supervised browser/tunnel/WSL/Docker before promising expanded operation on the remote host.');
    if (input.channelProviderDoctor.status === 'failed') issues.push('The native channel doctor failed; revalidate Slack native / WhatsApp Cloud API before expanding remote rollout.');
    if (input.remoteTransportDoctor.status === 'failed') issues.push('The remote transport doctor failed; revalidate the remote plan before trusting paired sidecars, gateways, and nodes.');
    return issues;
  }

  public buildRecommendations(input: RuntimeAccessResolvedInput, localReady: boolean, remoteReady: boolean): string[] {
    const lines: string[] = [];
    const mcpSummary = this.normalizeMcpSummary(input.mcp);
    const discordRepair = this.options.discordGatewayRepairFlowService.inspect(input.discordBridge);
    const healthRenewal = this.options.gatewayHealthRenewalService.inspect({
      checkedAt: this.options.now().toISOString(),
      runtime: {
        hostSupervisor: input.hostSupervisor,
        telegramWorker: input.telegramWorker,
        discordBridge: input.discordBridge,
        providers: input.providers,
        mcp: input.mcp,
        tenants: input.tenants,
        zavorthControl: null,
        nodeMeshSmoke: input.nodeMeshSmoke,
        systemOverlordSmoke: input.systemOverlordSmoke,
        channelProviderDoctor: input.channelProviderDoctor,
        remoteTransportDoctor: input.remoteTransportDoctor,
        learning: input.learning,
        layeredMemory: input.layeredMemory,
        platform: input.platform,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: input.hostIdentity?.firstRun ?? null,
      },
      auth: input.auth,
      local: { baseUrl: this.options.buildLocalBaseUrl(null), zavorthControlUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, appUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, ready: localReady, issues: [] },
      remote: { baseUrl: this.options.publicBaseUrl || null, appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl.replace(/\/+$/u, '')}/zavorthControl` : null, ready: remoteReady, issues: [] },
      recommendations: [],
      nextSteps: [],
      summary: '',
    });

    if (localReady) lines.push('Use local /zavorthControl as the primary surface to operate and approve Zavorth.');
    if (input.learning.available) {
      if (input.learning.summary.pending > 0) lines.push(`The learning plane has ${input.learning.summary.pending} pending candidate(s); use /learning candidates to review and promote only items that passed the gate.`);
      else if (input.learning.summary.total > 0) lines.push(`The learning plane already consolidated ${input.learning.summary.total} candidate(s), with ${input.learning.summary.promoted} trusted local and ${input.learning.summary.quarantined} quarantined.`);
      else lines.push('The learning plane has not found enough high-confidence runs yet to generate new candidates.');
    }
    if (input.layeredMemory.available) {
      if (input.layeredMemory.summary.procedural > 0) lines.push(`Layered memory has ${input.layeredMemory.summary.procedural} validated procedure(s); use /memory procedures to reuse trusted steps.`);
      else lines.push('Layered memory is enabled, but does not have enough procedures yet for strong procedural recall.');
    }
    if (input.platform.available) {
      if (input.platform.summary.reviewPending > 0 || input.platform.summary.quarantined > 0) lines.push(`The platform plane has ${input.platform.summary.reviewPending} item(s) under review and ${input.platform.summary.quarantined} quarantined; close this gate before expanding rollout.`);
      else if (input.platform.summary.learnedLocal > 0) lines.push(`The platform plane already recognizes ${input.platform.summary.learnedLocal} learned-local item(s) with explicit governance.`);
    }
    if (discordRepair.status === 'healthy') lines.push(input.discordBridge.mode === 'native' ? 'The native Discord gateway is ready to receive messages directly.' : 'The local Discord bridge is ready to receive signed relay envelopes.');
    else if (discordRepair.status === 'attention') { lines.push(discordRepair.summary); if (discordRepair.nextStep) lines.push(discordRepair.nextStep); }
    const selectedModel = input.providers.modelPicker?.selected || null;
    if (selectedModel) {
      lines.push(`The shared Model Picker selected ${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness}).`);
    }
    if (input.providers.readyCount > 0) lines.push(`The provider plane has ${input.providers.readyCount} ready route(s); current ${input.providers.activeProviderName}/${input.providers.activeModelName} with profile ${input.providers.recommendedProfile}.`);
    else lines.push('No ready provider was found; configure at least one cloud route before treating the runtime as operational.');
    for (const recommendation of input.providers.recommendations.slice(0, 2)) lines.push(recommendation);
    if (mcpSummary.enabled > 0) lines.push(mcpSummary.connected > 0 ? `The MCP control plane has ${mcpSummary.connected}/${mcpSummary.enabled} connected server(s) with ${mcpSummary.toolCount} ready tool(s).` : 'MCP servers are enabled, but none reached connected state in the current runtime.');
    for (const recommendation of input.mcp.recommendations.slice(0, 1)) lines.push(recommendation);
    if (input.tenants.pendingOnboardingCount > 0) {
      const firstPending = input.tenants.pendingOnboarding[0];
      lines.push(`Complete onboarding/policy for ${firstPending?.tenantId || 'the shared tenant'} before treating this runtime as multitenant production-ready.`);
    }
    if (input.nodeMeshSmoke.status === 'passed' && !input.nodeMeshSmoke.stale) lines.push(input.nodeMeshSmoke.checkedAt ? `Node Mesh passed the real smoke test at ${input.nodeMeshSmoke.checkedAt}; pairing, heartbeat and invoke end-to-end are validated.` : 'Node Mesh passed the real smoke test; pairing, heartbeat and invoke end-to-end are validated.');
    else if (input.nodeMeshSmoke.status === 'passed' && input.nodeMeshSmoke.stale) lines.push(input.nodeMeshSmoke.checkedAt ? `The latest real Node Mesh smoke passed at ${input.nodeMeshSmoke.checkedAt}, but the report is stale; run npm run test:nodes:smoke to renew mesh validation.` : 'The latest real Node Mesh smoke passed, but the report is stale; run npm run test:nodes:smoke to renew mesh validation.');
    else if (input.nodeMeshSmoke.status === 'failed') lines.push('The latest real Node Mesh smoke failed; run npm run test:nodes:smoke before trusting remote invokes.');
    else if (input.nodeMeshSmoke.status === 'running') lines.push('A real Node Mesh smoke is running; wait for the result before treating the mesh as validated.');
    else lines.push('There is no recent real Node Mesh smoke yet; run npm run test:nodes:smoke to validate pairing, heartbeat and invoke end-to-end.');
    if (input.systemOverlordSmoke.status === 'passed' && !input.systemOverlordSmoke.stale) lines.push(input.systemOverlordSmoke.checkedAt ? `System Overlord passed the smoke test at ${input.systemOverlordSmoke.checkedAt}; browser, tunnel, WSL and Docker supervised were evaluated honestly.` : 'System Overlord passed the smoke test; browser, tunnel, WSL and Docker supervised were evaluated honestly.');
    else if (input.systemOverlordSmoke.status === 'passed' && input.systemOverlordSmoke.stale) lines.push(input.systemOverlordSmoke.checkedAt ? `The latest System Overlord smoke passed at ${input.systemOverlordSmoke.checkedAt}, but the report is stale; run npm run test:overlord:smoke to renew supervised browser, tunnel, WSL, and Docker validation.` : 'The latest System Overlord smoke passed, but the report is stale; run npm run test:overlord:smoke to renew supervised browser, tunnel, WSL, and Docker validation.');
    else if (input.systemOverlordSmoke.status === 'failed') lines.push(input.systemOverlordSmoke.summary ? `The System Overlord smoke failed: ${input.systemOverlordSmoke.summary}` : 'The System Overlord smoke failed; run npm run test:overlord:smoke before trusting supervised host surfaces.');
    else if (input.systemOverlordSmoke.status === 'running') lines.push('A System Overlord smoke is running; wait for the result before treating browser/tunnel/WSL/Docker as validated.');
    else if (input.systemOverlordSmoke.status === 'skipped') lines.push('The System Overlord smoke finished with honest skips only; provision optional dependencies to validate supervised browser, tunnel, WSL, and Docker.');
    else lines.push('There is no recent System Overlord smoke yet; run npm run test:overlord:smoke to validate supervised browser, tunnel, WSL, and Docker.');
    if (input.channelProviderDoctor.status === 'passed' && !input.channelProviderDoctor.stale) lines.push(input.channelProviderDoctor.checkedAt ? `The native channel doctor validated ${this.describeChannelProviderDoctorTargets(input.channelProviderDoctor)} at ${input.channelProviderDoctor.checkedAt}.` : `The native channel doctor validated ${this.describeChannelProviderDoctorTargets(input.channelProviderDoctor)}.`);
    else if (input.channelProviderDoctor.status === 'passed' && input.channelProviderDoctor.stale) lines.push(input.channelProviderDoctor.checkedAt ? `The latest native channel doctor passed at ${input.channelProviderDoctor.checkedAt}, but the report is stale; run npm run test:channels:smoke before expanding Slack native / WhatsApp Cloud API rollout.` : 'The latest native channel doctor passed, but the report is stale; run npm run test:channels:smoke before expanding Slack native / WhatsApp Cloud API rollout.');
    else if (input.channelProviderDoctor.status === 'failed') lines.push(input.channelProviderDoctor.summary ? `The native channel doctor failed: ${input.channelProviderDoctor.summary}` : 'The native channel doctor failed; run npm run test:channels:smoke before expanding Slack native / WhatsApp Cloud API rollout.');
    if (input.remoteTransportDoctor.status === 'passed' && !input.remoteTransportDoctor.stale) lines.push(input.remoteTransportDoctor.checkedAt ? `Remote transports passed doctor at ${input.remoteTransportDoctor.checkedAt}; the remote plan is validated.` : 'Remote transports passed the doctor; the remote plan is validated.');
    else if (input.remoteTransportDoctor.status === 'passed' && input.remoteTransportDoctor.stale) lines.push(input.remoteTransportDoctor.checkedAt ? `The latest remote transport doctor passed at ${input.remoteTransportDoctor.checkedAt}, but the report is stale; run npm run test:transports:smoke before trusting paired sidecars, gateways, and nodes.` : 'The latest remote transport doctor passed, but the report is stale; run npm run test:transports:smoke before trusting paired sidecars, gateways, and nodes.');
    else if (input.remoteTransportDoctor.status === 'failed') lines.push(input.remoteTransportDoctor.summary ? `The remote transport doctor failed: ${input.remoteTransportDoctor.summary}` : 'The remote transport doctor failed; run npm run test:transports:smoke before trusting the remote plan.');
    else if (input.remoteTransportDoctor.status === 'running') lines.push('A remote transport doctor is running; wait for the result before treating the remote plan as validated.');
    if (healthRenewal.status === 'renewal_recommended') lines.push(`${healthRenewal.summary} Useful commands: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`);
    if (!this.options.publicBaseUrl) lines.push('For simple remote access, start a quick tunnel with npm run ops:public:tunnel or set ZAVORTH_PUBLIC_BASE_URL with a trusted HTTPS URL.');
    if (this.options.publicBaseUrl && !remoteReady) lines.push('The public URL already exists, but security and availability items still need completion before remote use.');
    if (remoteReady) lines.push('The remote web shell can already point to the public Zavorth URL with a dedicated web token.');
    if (!input.auth.enabled && this.options.highRiskApprovalPin) lines.push('The high-risk PIN remains reserved for critical confirmations; set a dedicated ZAVORTH_WEB_AUTH_TOKEN to enable web access.');
    if (input.hostIdentity?.firstRun) lines.push('The host is on its first run; confirm /hostauth status before enabling mutable operations on other machines.');
    if (localReady && (!input.hostSupervisor.alive || !input.telegramWorker.alive)) lines.push('The web surface responded, but the supervisor or worker lock appears stale; confirm the runtime before using this host as an operational reference.');
    return Array.from(new Set(lines));
  }

  public buildNextSteps(input: RuntimeAccessResolvedInput, remoteReady: boolean, localProbe: RuntimeAccessSurfaceProbe | null = null): RuntimeAccessReadinessStep[] {
    const steps: RuntimeAccessReadinessStep[] = [];
    const surfaceHealthy = localProbe?.ok === true;
    const discordRepair = this.options.discordGatewayRepairFlowService.inspect(input.discordBridge);
    const healthRenewal = this.options.gatewayHealthRenewalService.inspect({
      checkedAt: this.options.now().toISOString(),
      runtime: {
        ...input,
        zavorthControl: null,
        hostAuthorized: input.hostIdentity?.authorized ?? null,
        firstRun: null,
      },
      auth: input.auth,
      local: { baseUrl: this.options.buildLocalBaseUrl(null), zavorthControlUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, appUrl: `${this.options.buildLocalBaseUrl(null)}/zavorthControl`, ready: surfaceHealthy, issues: [] },
      remote: { baseUrl: this.options.publicBaseUrl, appUrl: this.options.publicBaseUrl ? `${this.options.publicBaseUrl}/zavorthControl` : null, ready: remoteReady, issues: [] },
      recommendations: [],
      nextSteps: [],
      summary: surfaceHealthy ? 'Local runtime with surface ready.' : 'Local runtime still needs surface reconciliation.',
    });

    if (!input.hostSupervisor.alive && !surfaceHealthy) steps.push({ id: 'start-supervised-host', title: 'Start the supervised host', description: 'Run npm run dev:supervised or npm run start:supervised before opening /zavorthControl.', blocking: true });
    else if (localProbe && !localProbe.ok) steps.push({ id: 'recover-web-surface', title: 'Recover the web surface', description: 'The host supervisor is active, but the web readiness endpoint did not respond. Restart the supervised runtime or check the announced port before operating.', blocking: true });
    else if (!input.telegramWorker.alive && !surfaceHealthy) steps.push({ id: 'recover-worker', title: 'Recover the main worker', description: 'Use /selfupdate or restart supervised Zavorth to bring the worker back online.', blocking: true });
    if (input.hostIdentity && input.hostIdentity.authorized === false) steps.push({ id: 'trust-host', title: 'Authorize this host', description: 'Validate /hostauth status and run /hostauth trust if this host is trusted for mutable execution.', blocking: true });
    if (input.providers.readyCount === 0) steps.push({ id: 'configure-primary-provider', title: 'Configure a primary provider', description: 'Set GEMINI_API_KEY, OPENAI_API_KEY, or another valid route before operating Zavorth in production.', blocking: true });
    else if (input.providers.modelPicker?.selected && !input.providers.modelPicker.selected.ready) steps.push({ id: 'align-model-picker-selection', title: 'Align the Model Picker selection', description: `The shared selection points to ${input.providers.modelPicker.selected.providerLabel}/${input.providers.modelPicker.selected.modelLabel}, but this route is in ${input.providers.modelPicker.selected.readiness}. Configure a route or choose a ready provider.`, blocking: false });
    else if (!input.providers.readyProviders.includes(input.providers.activeProviderName)) steps.push({ id: 'align-provider-default', title: 'Align the default provider', description: `The active provider does not appear as ready yet. Consider switching the default to ${input.providers.readyProviders[0] || 'a configured route'}.`, blocking: false });
    if (discordRepair.status === 'attention') steps.push({ id: 'recover-discord-bridge', title: input.discordBridge.mode === 'native' ? 'Recover the Discord gateway' : 'Recover the Discord bridge', description: discordRepair.nextStep || (input.discordBridge.mode === 'native' ? 'Use /autorepair or /reload to reconcile the native Discord gateway before opening the remote channel.' : 'Use /autorepair or /reload to reconcile the local Discord relay before opening the remote channel.'), blocking: false });
    if (healthRenewal.status === 'renewal_recommended') steps.push({ id: 'renew-gateway-health', title: 'Renew lightweight health checks', description: `${healthRenewal.summary} Useful commands: ${healthRenewal.commands.slice(0, 3).join(' | ')}.`.trim(), blocking: false });
    if (this.normalizeMcpSummary(input.mcp).enabled > 0 && this.normalizeMcpSummary(input.mcp).connected === 0) steps.push({ id: 'recover-mcp-runtime', title: 'Reconnect the MCP runtime', description: 'The MCP manifest is present, but no enabled capability stayed connected. Review manifest, binaries, and MCP runtime bootstrap.', blocking: false });
    if (input.tenants.pendingOnboardingCount > 0) steps.push({ id: 'finish-tenant-onboarding', title: 'Finish shared tenant onboarding', description: 'Configure owner IDs, allowlisted channels, and pending tenant policy before opening the runtime to multiple servers.', blocking: false });
    if (input.learning.available && input.learning.summary.pending > 0) steps.push({ id: 'review-learning-candidates', title: 'Review learned candidates', description: 'Use /learning candidates to approve, promote, or quarantine learned drafts before exposing new automations in the trusted runtime.', blocking: false });
    if (input.layeredMemory.available && input.layeredMemory.summary.procedural > 0) steps.push({ id: 'consult-procedural-memory', title: 'Consult procedural memory', description: 'Use /memory procedures or the memory card in /zavorthControl to reuse validated procedures before repeating a routine manually.', blocking: false });
    if (input.platform.available && (input.platform.summary.reviewPending > 0 || input.platform.summary.quarantined > 0)) steps.push({ id: 'review-platform-governance', title: 'Close review and quarantine in the platform plane', description: 'Review learned-local items, candidates under review, and any quarantine before promoting new plugins, skills, or MCPs.', blocking: false });
    if (input.nodeMeshSmoke.status !== 'passed' || input.nodeMeshSmoke.stale) steps.push({ id: 'validate-node-mesh-smoke', title: 'Validate Node Mesh with a real smoke', description: input.nodeMeshSmoke.status === 'failed' ? 'The latest real Node Mesh smoke failed. Run npm run test:nodes:smoke and review the persisted report before trusting paired invokes.' : input.nodeMeshSmoke.status === 'running' ? 'A real Node Mesh smoke is running. Wait for the persisted result before releasing the mesh as validated.' : input.nodeMeshSmoke.stale ? 'The latest real Node Mesh smoke is stale. Run npm run test:nodes:smoke to renew pairing, heartbeat, and end-to-end invoke validation.' : 'There is in the recent real Node Mesh smoke yet. Run npm run test:nodes:smoke to validate pairing, heartbeat, and end-to-end invoke.', blocking: false });
    if (input.systemOverlordSmoke.status === 'failed' || input.systemOverlordSmoke.status === 'running' || input.systemOverlordSmoke.status === 'missing' || input.systemOverlordSmoke.status === 'skipped' || (input.systemOverlordSmoke.status === 'passed' && input.systemOverlordSmoke.stale)) {
      const description = input.systemOverlordSmoke.status === 'failed' ? (input.systemOverlordSmoke.summary ? `The latest System Overlord smoke failed (${input.systemOverlordSmoke.summary}). Run npm run test:overlord:smoke before trusting supervised browser, tunnel, WSL, and Docker.` : 'The latest System Overlord smoke failed. Run npm run test:overlord:smoke before trusting supervised browser, tunnel, WSL, and Docker.') : input.systemOverlordSmoke.status === 'running' ? 'A System Overlord smoke is running. Wait for the persisted report before releasing supervised browser, tunnel, WSL, and Docker.' : input.systemOverlordSmoke.status === 'passed' ? (input.systemOverlordSmoke.checkedAt ? `The System Overlord smoke is stale (latest report at ${input.systemOverlordSmoke.checkedAt}). Run npm run test:overlord:smoke to renew supervised surface validation.` : 'The System Overlord smoke is stale. Run npm run test:overlord:smoke to renew supervised surface validation.') : input.systemOverlordSmoke.status === 'skipped' ? 'The System Overlord smoke ended with honest skips only. Provision optional dependencies and run npm run test:overlord:smoke to validate supervised browser, tunnel, WSL, and Docker.' : 'There is no recent System Overlord smoke yet. Run npm run test:overlord:smoke to validate supervised browser, tunnel, WSL, and Docker.';
      steps.push({ id: 'validate-system-overlord-smoke', title: 'Validate supervised System Overlord', description, blocking: false });
    }
    if (input.channelProviderDoctor.status === 'failed' || (input.channelProviderDoctor.status === 'passed' && input.channelProviderDoctor.stale)) {
      const description = input.channelProviderDoctor.status === 'failed' ? (input.channelProviderDoctor.summary ? `The native channel doctor failed (${input.channelProviderDoctor.summary}). Run npm run test:channels:smoke before expanding Slack native / WhatsApp Cloud API rollout.` : 'The native channel doctor failed. Run npm run test:channels:smoke before expanding Slack native / WhatsApp Cloud API rollout.') : input.channelProviderDoctor.checkedAt ? `The native channel doctor is stale (latest report at ${input.channelProviderDoctor.checkedAt}). Run npm run test:channels:smoke to renew Slack native / WhatsApp Cloud API validation.` : 'The native channel doctor is stale. Run npm run test:channels:smoke to renew Slack native / WhatsApp Cloud API validation.';
      steps.push({ id: 'validate-channel-providers', title: 'Validate native channels', description, blocking: false });
    }
    if (input.remoteTransportDoctor.status === 'failed' || input.remoteTransportDoctor.status === 'running' || (input.remoteTransportDoctor.status === 'passed' && input.remoteTransportDoctor.stale) || input.remoteTransportDoctor.status === 'missing') {
      const description = input.remoteTransportDoctor.status === 'failed' ? (input.remoteTransportDoctor.summary ? `The remote transport doctor failed (${input.remoteTransportDoctor.summary}). Run npm run test:transports:smoke before trusting paired sidecars, gateways, and nodes.` : 'The remote transport doctor failed. Run npm run test:transports:smoke before trusting paired sidecars, gateways, and nodes.') : input.remoteTransportDoctor.status === 'running' ? 'A remote transport doctor is running. Wait for the persisted result before treating the remote plan as validated.' : input.remoteTransportDoctor.status === 'passed' ? (input.remoteTransportDoctor.checkedAt ? `The remote transport doctor is stale (latest report at ${input.remoteTransportDoctor.checkedAt}). Run npm run test:transports:smoke to renew remote plan validation.` : 'The remote transport doctor is stale. Run npm run test:transports:smoke to renew remote plan validation.') : 'There is no recent remote transport doctor yet. Run npm run test:transports:smoke to validate paired sidecars, gateways, and nodes.';
      steps.push({ id: 'validate-remote-transports', title: 'validate remote transports', description, blocking: false });
    }
    if (!this.options.publicBaseUrl) steps.push({ id: 'configure-public-base-url', title: 'Set the public URL', description: 'Start a quick tunnel with npm run ops:public:tunnel or configure ZAVORTH_PUBLIC_BASE_URL with the runtime HTTPS URL to enable the remote web shell.', blocking: false });
    else if (!this.options.publicBaseUrl.toLowerCase().startsWith('https://')) steps.push({ id: 'secure-public-url', title: 'Switch to HTTPS', description: 'The Zavorth public URL must use HTTPS for the remote web shell to work safely.', blocking: true });
    if (!input.auth.enabled) steps.push({ id: 'configure-web-token', title: 'Configure the web token', description: 'set ZAVORTH_WEB_AUTH_TOKEN or generate a file token before exposing the runtime.', blocking: true });
    if (remoteReady) steps.push({ id: 'connect-remote-frontend', title: 'Connect the remote web shell', description: 'Open the published remote shell, enter the Zavorth public URL, and validate the connection with the web token.', blocking: false });
    return steps;
  }

  public buildSummary(localReady: boolean, remoteReady: boolean, localIssues: string[], remoteIssues: string[]): string {
    if (localReady && remoteReady) return 'Zavorth ready for usage local and remote.';
    if (localReady) return `Zavorth is ready for local use. remote pending: ${remoteIssues[0] || 'Remote access still needs adjustments.'}`;
    return `Zavorth is not ready yet for consistent use: ${localIssues[0] || 'Local pending items remain.'}`;
  }

  public describeLocalProbeFailure(localProbe: RuntimeAccessSurfaceProbe): string {
    const targetUrl = localProbe.targetUrl || 'o /zavorthControl local';
    if (localProbe.statusCode) return `The Zavorth web surface did not respond with a healthy status em ${targetUrl} (status ${localProbe.statusCode}).`;
    if (localProbe.error) return `The Zavorth web surface did not respond at ${targetUrl}: ${localProbe.error}`;
    return `The Zavorth web surface did not respond at ${targetUrl}.`;
  }

  public describeChannelProviderDoctorTargets(snapshot: RuntimeAccessChannelProviderDoctorSnapshot): string {
    const targets = (snapshot.items || []).filter((item) => item.status === 'passed').map((item) => {
      if (item.channelId === 'telegram') return item.mode === 'native' ? 'Telegram native' : 'Telegram';
      if (item.channelId === 'discord') return item.mode === 'native' ? 'Discord native' : 'Discord';
      if (item.channelId === 'whatsapp') return item.mode === 'cloud-api' ? 'WhatsApp Cloud API' : item.mode === 'baileys' ? 'WhatsApp Baileys' : 'WhatsApp';
      if (item.channelId === 'signal') return item.mode === 'signal-cli' ? 'Signal bridge' : 'Signal';
      if (item.channelId === 'imessage') return item.mode === 'mac-bridge' ? 'iMessage bridge' : 'iMessage';
      if (item.channelId === 'teams') return item.mode === 'graph-bot' ? 'Teams Graph/Bot' : 'Teams';
      if (item.channelId === 'email') return item.mode === 'local-outbox' ? 'Email local-outbox' : 'Email';
      return item.mode === 'native' ? 'Slack native' : 'Slack';
    });
    if (targets.length === 0) return 'os providers natives configurados';
    if (targets.length === 1) return targets[0];
    if (targets.length === 2) return `${targets[0]} and ${targets[1]}`;
    return `${targets.slice(0, -1).join(', ')} and ${targets[targets.length - 1]}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeMcpSummary(snapshot: Pick<{ summary: any }, 'summary'> | null | undefined): any {
    const summary = snapshot?.summary;
    return {
      total: Number(summary?.total || 0),
      enabled: Number(summary?.enabled || 0),
      connected: Number(summary?.connected || 0),
      failed: Number(summary?.failed || 0),
      disabled: Number(summary?.disabled || 0),
      stopped: Number(summary?.stopped || 0),
      toolCount: Number(summary?.toolCount || 0),
      capabilityCount: Number(summary?.capabilityCount || 0),
    };
  }
}
