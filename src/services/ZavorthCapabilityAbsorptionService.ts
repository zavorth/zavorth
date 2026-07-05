import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.js';
import {
ZAVORTH_CAPABILITY_ABSORPTION_CONTRACT_VERSION,
  type ZavorthCapabilityAbsorptionItem,
  type ZavorthCapabilityAbsorptionSnapshot,
  type ZavorthCapabilityAbsorptionStatus,
} from '../contracts/ZavorthCapabilityAbsorptionContract.js';

type Runtime = {
  now?: () => Date;
  root?: string;
};

type PackageJsonLike = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export class ZavorthCapabilityAbsorptionService {
  private readonly now: () => Date;
  private readonly root: string;
  private readonly packageJson: PackageJsonLike;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.root = runtime.root || process.cwd();
    this.packageJson = this.readJson('package.json') || {};
  }

  public buildSnapshot(): ZavorthCapabilityAbsorptionSnapshot {
    const items = this.buildItems();
    const summary = summarize(items);
    const status = items.some((item) => item.status === 'missing' && item.nextPhase === 'phase-9-live-product-qa')
      ? 'blocked'
      : items.some((item) => item.status !== 'native')
        ? 'attention'
        : 'passed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CAPABILITY_ABSORPTION_CONTRACT_VERSION,
      source: 'ZavorthCapabilityAbsorptionService',
      status,
      items,
      summary,
      policy: {
        catalogIsNotLiveProof: true,
        everyLiveAdapterNeedsCredentialProof: true,
        securityPolicyCannotBeLearnedAway: true,
        channelsRequirePairingOrAllowlist: true,
        appsRequireSeparateSignedArtifacts: true,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:capability-absorption',
        inspectJson: 'npm run zavorth:capability-absorption:json',
        check: 'npm run zavorth:capability-absorption:check --silent',
        next: 'Phase 2 - Channel Deepening',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthCapabilityAbsorptionSnapshot): string {
    const lines = [
      'Zavorth Capability Absorption Map',
      '',
      `Status: ${snapshot.status}`,
      `Items: ${snapshot.summary.total}`,
      `Native: ${snapshot.summary.native}`,
      `Partial: ${snapshot.summary.partial}`,
      `Cataloged: ${snapshot.summary.cataloged}`,
      `Missing: ${snapshot.summary.missing}`,
      `Needs credentials: ${snapshot.summary.requiresCredentials}`,
      `Needs app: ${snapshot.summary.requiresApp}`,
      '',
      'Absorption map:',
    ];

    for (const item of snapshot.items) {
      lines.push(`- ${item.label}: ${item.status} -> ${item.nextPhase}`);
      lines.push(`  surface: ${item.zavorthNativeSurface}`);
      lines.push(`  target: ${item.desiredOutcome}`);
      if (item.currentEvidence.length > 0) lines.push(`  evidence: ${item.currentEvidence.join('; ')}`);
      if (item.missingForFullNative.length > 0) lines.push(`  missing: ${item.missingForFullNative.join('; ')}`);
    }

    lines.push('');
    lines.push('Policy: catalog support is not live proof; every live adapter still needs credentials, allowlists and receipts.');
    lines.push(`Next: ${snapshot.commands.next}`);
    return lines.join('\n');
  }

  private buildItems(): ZavorthCapabilityAbsorptionItem[] {
    const script = (name: string) => this.hasScript(name);
    const exists = (file: string) => fs.existsSync(path.join(this.root, file));
    const dep = (name: string) => Boolean(this.packageJson.dependencies?.[name] || this.packageJson.devDependencies?.[name]);

    return [
      item({
        id: 'governance-policy-broker-receipts',
        label: 'Policy Broker, approvals, SecretRefs and receipts',
        category: 'governance',
        source: 'zavorth',
        desiredOutcome: 'Keep Zavorth governance as the native boundary for every absorbed capability.',
        status: script('zavorth:product-readiness:check') && script('effect-boundary:check') ? 'native' : 'partial',
        zavorthNativeSurface: 'Effect Boundary + Trust Lens + receipts',
        currentEvidence: ['effect-boundary:check', 'zavorth:product-readiness:check', 'docs/effect-boundary.md'],
        missingForFullNative: [],
        risks: ['Never let learning, plugins or channels rewrite core security policy.'],
        nextPhase: 'already-native',
      }),
      item({
        id: 'guided-onboarding',
        label: 'Guided onboarding wizard',
        category: 'onboarding',
        source: 'catalog-seed',
        desiredOutcome: 'Make first-run setup a guided, beautiful, low-friction Zavorth-native journey.',
        status: script('zavorth:cli-final-product-polish:check') && script('zavorth:unified-onboarding:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'zavorth setup / onboarding / CLI setup studio',
        currentEvidence: ['zavorth:cli-final-product-polish:check', 'zavorth:unified-onboarding:check'],
        missingForFullNative: ['full long-form live QA', 'QR pairing for relevant channels', 'daemon install branch per OS'],
        risks: ['Onboarding must not imply a provider/channel is live before proof exists.'],
        nextPhase: 'phase-9-live-product-qa',
      }),
      item({
        id: 'channel-mesh-core',
        label: 'Channel Mesh core',
        category: 'channel',
        source: 'ecosystem-signal',
        desiredOutcome: 'Unify every communication surface behind setup, pairing, doctor, proof and receipts.',
        status: script('zavorth:live-readiness-evidence-proof-pack:check') && exists('docs/channel-mesh.md') ? 'native' : 'partial',
        zavorthNativeSurface: 'Channel Mesh + runtime channel adapters',
        currentEvidence: ['docs/channel-mesh.md', 'zavorth:live-readiness-evidence-proof-pack:check'],
        missingForFullNative: [],
        risks: ['Catalog entries must remain blocked until credentials and allowlists exist.'],
        nextPhase: 'already-native',
      }),
      item({
        id: 'channels-long-tail',
        label: 'Zavorth-native long-tail channels',
        category: 'channel',
        source: 'catalog-seed',
        desiredOutcome: 'WhatsApp, iMessage, Slack, Signal, Matrix, LINE, Feishu/Lark, Zalo, WeChat, QQ and related surfaces behave as first-class Zavorth channels.',
        status: this.hasAny(['whatsapp', 'imessage', 'slack', 'signal', 'matrix', 'line', 'zalo']) ? 'cataloged' : 'missing',
        zavorthNativeSurface: 'zavorth channels + Channel Mesh',
        currentEvidence: ['channel catalog/adapters exist for several targets', 'docs/channel-mesh.md'],
        missingForFullNative: ['per-channel live setup', 'pairing/allowlist flow', 'read/send proof', 'rate limits and delivery receipts'],
        risks: ['Remote inboxes can become prompt-injection entrypoints without pairing and policy.'],
        nextPhase: 'phase-2-channel-deepening',
      }),
      item({
        id: 'provider-mesh-failover',
        label: 'Provider Mesh and failover',
        category: 'provider',
        source: 'ecosystem-signal',
        desiredOutcome: 'Use many LLM/media providers with health, fallback, cost and credential proof.',
        status: script('zavorth:provider-readiness:check') && exists('docs/provider-mesh.md') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Provider Mesh',
        currentEvidence: ['docs/provider-mesh.md', 'zavorth:provider-readiness:check', 'zavorth:live-certification-matrix:check'],
        missingForFullNative: ['automatic failover policy', 'live canary per configured provider', 'cost-aware route memory'],
        risks: ['Never treat model catalog support as live availability.'],
        nextPhase: 'phase-9-live-product-qa',
      }),
      item({
        id: 'native-learning-loop',
        label: 'Zavorth-native-style learning loop',
        category: 'learning',
        source: 'zavorth-native',
        desiredOutcome: 'Turn successful work into approved memories, reusable skills and safer future routing.',
        status: script('zavorth:native-learning-loop:check') ? 'native' : script('zavorth:memory-learning-loop:check') ? 'partial' : 'missing',
        zavorthNativeSurface: 'Mnemos + Learning OS',
        currentEvidence: ['zavorth:native-learning-loop:check', 'zavorth:memory-learning-loop:check', 'docs/mnemos-memory-os.md'],
        missingForFullNative: script('zavorth:native-learning-loop:check') ? [] : ['auto-skill candidates after complex tasks', 'skill self-improvement candidates', 'FTS session search', 'approved user model'],
        risks: ['Learning must never mutate sandbox, firewall, allowlist or approval policy.'],
        nextPhase: script('zavorth:native-learning-loop:check') ? 'already-native' : 'phase-3-learning-loop',
      }),
      item({
        id: 'skills-built-in-expansion',
        label: 'Zavorth-native-scale built-in skills',
        category: 'skill',
        source: 'zavorth-native',
        desiredOutcome: 'Provide broad devops, data, creative, media, productivity and research skills as governed instructions/adapters.',
        status: script('zavorth:universal-skill-expansion:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Skill library + Universal Skill Bridge',
        currentEvidence: ['zavorth:universal-skill-expansion:check', 'zavorth:skill-ecosystem:check'],
        missingForFullNative: ['curated 40+ high-quality skills', 'live proof by skill family', 'auto-created skill review workflow'],
        risks: ['Skills remain instructions unless explicitly wrapped as tools.'],
        nextPhase: 'phase-3-learning-loop',
      }),
      item({
        id: 'zavorthControl-native-ui',
        label: 'Zavorth-native advanced ZavorthControl ZavorthControl',
        category: 'zavorthControl',
        source: 'zavorth-native',
        desiredOutcome: 'Expose tool cards, subagent cards, streaming, approval cards, context usage and retry/edit flows in /zavorthControl.',
        status: script('zavorth:zavorthControl-final-product-polish:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: '/zavorthControl ZavorthControl',
        currentEvidence: ['zavorth:zavorthControl-final-product-polish:check', 'docs/web-zavorthControl.md'],
        missingForFullNative: ['live SSE QA', 'tool call expand/collapse in every runtime path', 'context/cost meter', 'message edit/regenerate queue'],
        risks: ['ZavorthControl remains a control surface; execution still routes through Policy Broker.'],
        nextPhase: 'phase-4-zavorthControl',
      }),
      item({
        id: 'cli-terminal-tui',
        label: 'Premium CLI/TUI',
        category: 'cli',
        source: 'ecosystem-signal',
        desiredOutcome: 'Keep terminal chat/setup/status polished while hiding internal machinery behind advanced groups.',
        status: script('zavorth:cli-final-product-polish:check') ? 'native' : 'partial',
        zavorthNativeSurface: 'zavorth / zavorth chat / setup studio / hud',
        currentEvidence: ['zavorth:cli-final-product-polish:check', 'docs/zavorth-cli.md'],
        missingForFullNative: ['long human QA in fresh install with real provider/channel'],
        risks: ['Avoid exposing hundreds of engineering commands in the public path.'],
        nextPhase: 'phase-9-live-product-qa',
      }),
      item({
        id: 'native-browser-cdp',
        label: 'Native browser automation',
        category: 'browser',
        source: 'zavorth-native',
        desiredOutcome: 'Offer governed browse, screenshot, click, type and extraction without relying only on MCP.',
        status: script('zavorth:browser-vision-bridge:check') || exists('src/mcp/tools/AutomaticBrowserTool.ts') ? 'partial' : 'missing',
        zavorthNativeSurface: 'Browser Vision Bridge + perception tools',
        currentEvidence: ['zavorth:browser-vision-bridge:check', 'AutomaticBrowserTool'],
        missingForFullNative: ['persistent session manager', 'CDP sidecar lifecycle', 'domain policy and visual receipts'],
        risks: ['Browser content is untrusted prompt material and must stay bounded.'],
        nextPhase: 'phase-5-browser-computer-use',
      }),
      item({
        id: 'computer-use-cua',
        label: 'Computer Use control plane',
        category: 'computer-use',
        source: 'zavorth-native',
        desiredOutcome: 'Use screenshots, mouse/keyboard actions and supervised desktop automation with receipts.',
        status: script('zavorth:computer-control-plane:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Computer Control Plane + supervised adapters',
        currentEvidence: ['zavorth:computer-control-plane:check', 'tests/agents/ComputerUseAgent.test.ts'],
        missingForFullNative: ['live desktop QA', 'per-app allowlists', 'interrupt and rollback UX'],
        risks: ['Desktop control needs stronger approval and visible interruption.'],
        nextPhase: 'phase-5-browser-computer-use',
      }),
      item({
        id: 'cron-scheduler',
        label: 'First-class scheduler and cron',
        category: 'scheduler',
        source: 'zavorth-native',
        desiredOutcome: 'Schedule natural-language tasks with channel delivery, retries, logs and policy per tick.',
        status: script('zavorth:scheduled-task-daily-ops-readiness:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Governed scheduled tasks',
        currentEvidence: ['zavorth:scheduled-task-daily-ops-readiness:check', 'tests/telegram/TelegramSchedulerSupport.test.ts'],
        missingForFullNative: ['full user-facing cron UX', 'channel delivery proof', 'durable worker long-run QA'],
        risks: ['Scheduled tasks cannot create scheduled tasks or silently escalate tools.'],
        nextPhase: 'phase-9-live-product-qa',
      }),
      item({
        id: 'terminal-backends',
        label: 'Multi-backend execution',
        category: 'execution-backend',
        source: 'zavorth-native',
        desiredOutcome: 'Run work across local, Docker, SSH, WSL and cloud sandboxes through the same Effect contract.',
        status: script('zavorth:execution-backends') || script('zavorth:sandbox-lifecycle:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Execution Gateway + Sandbox Lifecycle',
        currentEvidence: ['zavorth:sandbox-lifecycle:check', 'zavorth:execution-backends'],
        missingForFullNative: ['SSH backend proof', 'cloud sandbox proof', 'backend selection UX', 'resource/cost limits'],
        risks: ['Backends must not bypass Effect Boundary or receipts.'],
        nextPhase: 'phase-6-execution-backends',
      }),
      item({
        id: 'native-companion-apps',
        label: 'Native companion apps',
        category: 'native-app',
        source: 'catalog-seed',
        desiredOutcome: 'macOS tray, iOS and Android companion nodes for voice, canvas, notifications and device control.',
        status: script('zavorth-native-companion-device-pack:check') ? 'requires_app' : 'missing',
        zavorthNativeSurface: 'Satellite nodes + companion app pack',
        currentEvidence: ['zavorth-native-companion-device-pack:check', 'Node/Satellite services'],
        missingForFullNative: ['signed app artifacts', 'mobile pairing UX', 'push notification setup', 'store/distribution path'],
        risks: ['Apps require signed releases and device permission transparency.'],
        nextPhase: 'phase-7-satellite-apps',
      }),
      item({
        id: 'extension-plugin-sdk',
        label: 'Extension and plugin SDK',
        category: 'plugin',
        source: 'catalog-seed',
        desiredOutcome: 'Support installable extensions with manifests, permissions, signatures, sandbox and lifecycle hooks.',
        status: script('zavorth:universal-skill-bridge-activation:check') ? 'partial' : 'cataloged',
        zavorthNativeSurface: 'Plugin SDK + Universal Skill Bridge',
        currentEvidence: ['zavorth:universal-skill-bridge-activation:check', 'docs/capabilities-and-plugins.md'],
        missingForFullNative: ['marketplace', 'signature verification for plugin bundles', 'runtime lifecycle hooks', 'per-plugin doctor'],
        risks: ['Plugins must not become arbitrary code execution by default.'],
        nextPhase: 'phase-8-plugin-sdk',
      }),
      item({
        id: 'voice-audio-echo',
        label: 'Voice and audio layer',
        category: 'voice',
        source: 'catalog-seed',
        desiredOutcome: 'Voice memo transcription, TTS, wake modes and channel-safe audio handling under Echo.',
        status: dep('@google/genai') || dep('@anthropic-ai/sdk') ? 'cataloged' : 'missing',
        zavorthNativeSurface: 'Echo voice/audio capability plane',
        currentEvidence: ['audio inline data support in runtime', 'provider catalog includes audio/media providers'],
        missingForFullNative: ['ElevenLabs/system TTS adapters', 'speech-to-text proof', 'wake-word app integration'],
        risks: ['Audio can carry sensitive data and must be redacted in receipts.'],
        nextPhase: 'phase-7-satellite-apps',
      }),
      item({
        id: 'product-live-qa',
        label: 'Live product QA with real credentials',
        category: 'qa',
        source: 'zavorth',
        desiredOutcome: 'Prove install, provider, Telegram/channel, mutation approval, zavorthControl and receipt flow end to end.',
        status: script('zavorth:product-readiness:check') ? 'requires_credentials' : 'missing',
        zavorthNativeSurface: 'Product Readiness Gate',
        currentEvidence: ['zavorth:product-readiness:check', 'zavorth:live-certification-matrix:check'],
        missingForFullNative: ['real API key', 'real channel token', 'human visual QA', 'live receipt archive'],
        risks: ['Dry-run certification is not a substitute for a credentialed live proof.'],
        nextPhase: 'phase-9-live-product-qa',
      }),
    ];
  }

  private hasScript(name: string): boolean {
    return Boolean(this.packageJson.scripts?.[name]);
  }

  private hasAny(markers: string[]): boolean {
    const haystack = [
      JSON.stringify(this.packageJson),
      this.read('docs/channel-mesh.md'),
      this.read('src/bootstrap/bootstrapSurfaceComposition.ts'),
      this.read('src/domain/channels/infrastructure/setup-guide/ChannelSetupGuideCatalog.ts'),
    ].join('\n').toLowerCase();
    return markers.some((marker) => haystack.includes(marker.toLowerCase()));
  }

  private read(file: string): string {
    try {
      return fs.readFileSync(path.join(this.root, file), 'utf8');
    } catch (error) { logger.warn('[Zavorth Capability Absorption] filesystem operation failed', error); return ''; }
  }

  private readJson(file: string): PackageJsonLike | null {
    try {
      return JSON.parse(this.read(file)) as PackageJsonLike;
    } catch (error) { logger.warn('[Zavorth Capability Absorption] JSON parse failed', error); return null; }
  }
}

function item(input: ZavorthCapabilityAbsorptionItem): ZavorthCapabilityAbsorptionItem {
  return input;
}

function summarize(items: ZavorthCapabilityAbsorptionItem[]): ZavorthCapabilityAbsorptionSnapshot['summary'] {
  const count = (status: ZavorthCapabilityAbsorptionStatus) => items.filter((item) => item.status === status).length;
  const nextPhases = items.reduce((acc, item) => {
    acc[item.nextPhase] = (acc[item.nextPhase] || 0) + 1;
    return acc;
  }, {} as ZavorthCapabilityAbsorptionSnapshot['summary']['nextPhases']);

  const phaseKeys: Array<keyof typeof nextPhases> = [
    'already-native',
    'phase-2-channel-deepening',
    'phase-3-learning-loop',
    'phase-4-zavorthControl',
    'phase-5-browser-computer-use',
    'phase-6-execution-backends',
    'phase-7-satellite-apps',
    'phase-8-plugin-sdk',
    'phase-9-live-product-qa',
  ];
  for (const key of phaseKeys) nextPhases[key] = nextPhases[key] || 0;

  return {
    total: items.length,
    native: count('native'),
    partial: count('partial'),
    cataloged: count('cataloged'),
    missing: count('missing'),
    requiresCredentials: count('requires_credentials'),
    requiresApp: count('requires_app'),
    catalogSeeded: items.filter((item) => item.source === 'catalog-seed').length,
    zavorthNativeSeeded: items.filter((item) => item.source === 'zavorth-native').length,
    ecosystemSignals: items.filter((item) => item.source === 'ecosystem-signal').length,
    nextPhases,
    liveProofStillRequired: items.filter((item) => item.missingForFullNative.some((missing) => /proof|credential|token|live/i.test(missing))).length,
    rawSecretsSerialized: false,
    externalIoPerformed: false,
    workspaceMutationPerformed: false,
  };
}
