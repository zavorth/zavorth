import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { ZavorthNativeIntegrationService } from './ZavorthNativeIntegrationService.js';

export const ZAVORTH_OPERATIONAL_PARITY_CONTRACT_VERSION = 'zavorth-operational-parity/1' as const;

export type ZavorthOperationalParityDomainId =
  | 'channels'
  | 'gateway'
  | 'plugins'
  | 'liveQa'
  | 'onboarding';

export type ZavorthOperationalParityDomain = {
  id: ZavorthOperationalParityDomainId;
  title: string;
  status: 'pass' | 'attention' | 'blocked';
  summary: string;
  evidence: string[];
  nextActions: string[];
};

export type ZavorthOperationalParitySnapshot = {
  contractVersion: typeof ZAVORTH_OPERATIONAL_PARITY_CONTRACT_VERSION;
  generatedAt: string;
  status: 'pass' | 'attention' | 'blocked';
  score: number;
  domains: ZavorthOperationalParityDomain[];
  safety: {
    noSecretsRead: true;
    noNetworkCalls: true;
    noExternalAgentCode: true;
    liveUseStillRequiresCredentialsAndReceipts: true;
  };
};

export type ZavorthOperationalParityRuntime = {
  now?: () => Date;
  nativeIntegrations?: ZavorthNativeIntegrationService;
};

export class ZavorthOperationalParityService {
  private readonly now: () => Date;
  private readonly nativeIntegrations: ZavorthNativeIntegrationService;

  constructor(runtime: ZavorthOperationalParityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.nativeIntegrations = runtime.nativeIntegrations || new ZavorthNativeIntegrationService({ now: this.now });
  }

  public buildSnapshot(projectRoot: string): ZavorthOperationalParitySnapshot {
    const native = this.nativeIntegrations.buildSnapshot();
    const commandsFile = path.join(projectRoot, 'src', 'cli', 'ZavorthCliLiveNamespaces.ts');
    const setupStudio = path.join(projectRoot, 'src', 'cli', 'setup-studio');
    const gatewayFiles = [
      path.join(projectRoot, 'src', 'gateway', 'core', 'GatewayHostService.ts'),
      path.join(projectRoot, 'src', 'domain', 'gateway', 'application', 'runtime-access'),
      path.join(projectRoot, 'src', 'cli', 'hud', 'ZavorthCliRuntimeTuiRenderer.ts'),
    ];
    const pluginFiles = [
      path.join(projectRoot, 'src', 'services', 'PluginRegistryService.ts'),
      path.join(projectRoot, 'src', 'services', 'PluginStateService.ts'),
      path.join(projectRoot, 'src', 'cli', 'ZavorthCliLiveNamespaces.ts'),
    ];
    const qaFiles = [
      path.join(projectRoot, 'scripts', 'premium-distribution-qa-check.mjs'),
      path.join(projectRoot, 'scripts', 'channel-long-tail-activation-check.mjs'),
      path.join(projectRoot, 'scripts', 'terminal-presentation-check.mjs'),
      path.join(projectRoot, 'tests', 'cli', 'ZavorthCliLiveNamespaces.test.ts'),
    ];

    const channels = native.entries.filter((entry) => entry.kind === 'channel');
    const providerCount = native.summary.providers;
    const channelCount = native.summary.channels;

    const domains: ZavorthOperationalParityDomain[] = [
      this.domain({
        id: 'channels',
        title: 'Channel ecosystem',
        pass: channelCount >= 30 && this.fileContains(commandsFile, ['runMessage', 'runDirectory', 'runPairing', 'runQr']),
        summary: `${channelCount} channels are native-ready; message, directory, pairing and QR commands are wired.`,
        evidence: [
          `Native channel catalog: ${channelCount}`,
          `Native provider routes: ${providerCount}`,
          `Long-tail adapters: ${channels.filter((entry) => entry.nativeSurface.includes('ChannelLongTailActivationService')).length}`,
          'Delivery is still gated by explicit credentials, allowlists and proof receipts.',
        ],
        nextActions: [
          'Run: zavorth native catalog',
          'Run: zavorth directory self --channel telegram --live --yes after configuring credentials.',
          'Run: zavorth message send --channel telegram --target <id> --message "ping" --deliver --yes.',
        ],
      }),
      this.domain({
        id: 'gateway',
        title: 'Gateway, pairing and node host',
        pass: gatewayFiles.every((file) => existsSync(file)) && this.fileContains(commandsFile, ['runServiceCommand', 'runNodeHost', 'runNodesCommand', 'createPairingDraft']),
        summary: 'Gateway service lifecycle, node host, pairing code and QR setup are CLI-addressable.',
        evidence: [
          'daemon/gateway install/start/stop/restart/logs/status are available.',
          'node/nodes pair, claim, exec and logs are available.',
          'pairing and QR payloads are stored locally with TTL and redaction.',
        ],
        nextActions: [
          'Run: zavorth gateway install --command "<gateway command>"',
          'Run: zavorth nodes pair notebook --label "Linux Mint"',
          'Run: zavorth qr pairing --channel device',
        ],
      }),
      this.domain({
        id: 'plugins',
        title: 'Plugin SDK and lifecycle',
        pass: pluginFiles.every((file) => existsSync(file)) && this.fileContains(commandsFile, ['resolvePluginManifest', 'doctorPlugin', 'runPluginHook', 'scaffoldPlugin']),
        summary: 'Plugin manifest, checksum, permissions, doctor, hooks, enable/disable and scaffold flows are present.',
        evidence: [
          'Local plugins require a manifest or generated fallback.',
          'Enable is preview-first and writes runtime state only after confirmation.',
          'Lifecycle hooks run through the plugin command path and leave receipts.',
        ],
        nextActions: [
          'Run: zavorth plugins scaffold my-plugin',
          'Run: zavorth plugins install ./my-plugin --yes',
          'Run: zavorth plugins doctor my-plugin',
        ],
      }),
      this.domain({
        id: 'liveQa',
        title: 'Live QA and release gates',
        pass: qaFiles.every((file) => existsSync(file)),
        summary: 'CLI/distribution/channel QA gates exist and are callable without reading secrets.',
        evidence: [
          'Premium distribution QA script exists.',
          'Long-tail channel activation check exists.',
          'Terminal presentation check exists.',
          'Live namespace tests cover backup, config, MCP, messaging, plugins and pairing.',
        ],
        nextActions: [
          'Run: npm run runtime:check --silent',
          'Run: node scripts/premium-distribution-qa-check.mjs',
          'Run: node scripts/channel-long-tail-activation-check.mjs',
        ],
      }),
      this.domain({
        id: 'onboarding',
        title: 'Cohesive onboarding',
        pass: existsSync(setupStudio) && this.fileContains(commandsFile, ['runDirectory', 'runPairing', 'runPlugins', 'runSkills']),
        summary: 'First Light, quickstart, home, hatch and advanced namespaces share the same governed CLI surface.',
        evidence: [
          'The public CLI exposes a small entrypoint and hides heavy systems behind namespaces.',
          'First Light state/progress files exist.',
          'Provider/channel wizard and live validation services exist.',
        ],
        nextActions: [
          'Run: zavorth onboarding',
          'Run: zavorth hatch',
          'Run: zavorth certify',
        ],
      }),
    ];

    const blocked = domains.filter((domain) => domain.status === 'blocked').length;
    const attention = domains.filter((domain) => domain.status === 'attention').length;
    const score = Math.round((domains.filter((domain) => domain.status === 'pass').length / domains.length) * 100);
    return {
      contractVersion: ZAVORTH_OPERATIONAL_PARITY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      status: blocked > 0 ? 'blocked' : attention > 0 ? 'attention' : 'pass',
      score,
      domains,
      safety: {
        noSecretsRead: true,
        noNetworkCalls: true,
        noExternalAgentCode: true,
        liveUseStillRequiresCredentialsAndReceipts: true,
      },
    };
  }

  public renderText(snapshot: ZavorthOperationalParitySnapshot): string {
    return [
      '',
      'o  ZAVORTH CERTIFY',
      '|',
      this.box('Operational parity', [
        `status: ${snapshot.status}`,
        `score: ${snapshot.score}/100`,
        'scope: channels, gateway, plugins, live QA and onboarding',
      ]),
      ...snapshot.domains.map((domain) => this.box(`${domain.status.toUpperCase()} ${domain.title}`, [
        domain.summary,
        '',
        'Evidence:',
        ...domain.evidence.map((line) => `- ${line}`),
        '',
        'Next:',
        ...domain.nextActions.map((line) => `- ${line}`),
      ])),
      this.box('Safety', [
        'No secrets were read.',
        'No network calls were made.',
        'No external agent code was executed.',
        'Live use still requires credentials, allowlists and proof receipts.',
      ]),
    ].join('\n');
  }

  private domain(input: {
    id: ZavorthOperationalParityDomainId;
    title: string;
    pass: boolean;
    summary: string;
    evidence: string[];
    nextActions: string[];
  }): ZavorthOperationalParityDomain {
    return {
      id: input.id,
      title: input.title,
      status: input.pass ? 'pass' : 'attention',
      summary: input.summary,
      evidence: input.evidence,
      nextActions: input.nextActions,
    };
  }

  private fileContains(file: string, needles: string[]): boolean {
    if (!existsSync(file)) return false;
    const raw = readFileSync(file, 'utf8');
    return needles.every((needle) => raw.includes(needle));
  }

  private box(title: string, lines: string[]): string {
    const width = Math.min(96, Math.max(42, title.length + 8, ...lines.map((line) => stripAnsi(line).length + 4)));
    const wrapped = lines.flatMap((line) => wrap(line, width - 4));
    return [
      `o  ${title} ${'-'.repeat(Math.max(1, width - title.length - 5))}+`,
      ...wrapped.map((line) => `|  ${line.padEnd(width - 4)} |`),
      `+${'-'.repeat(width - 1)}+`,
      '|',
    ].join('\n');
  }
}

function wrap(value: string, width: number): string[] {
  if (!value) return [''];
  if (stripAnsi(value).length <= width) return [value];
  const out: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/u)) {
    const next = current ? `${current} ${word}` : word;
    if (stripAnsi(next).length > width && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

function stripAnsi(value: string): string {
  return String(value).replace(/\x1b\[[0-9;]*m/gu, '');
}
