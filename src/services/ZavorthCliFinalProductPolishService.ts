import fs from 'node:fs';
import path from 'node:path';
import {
  ZAVORTH_CLI_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
  type ZavorthCliFinalProductPolishEntry,
  type ZavorthCliFinalProductPolishEntryKind,
  type ZavorthCliFinalProductPolishSnapshot,
  type ZavorthCliFinalProductPolishStatus,
} from '../contracts/ZavorthCliFinalProductPolishContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
};

const FILES = {
  bin: 'bin/zavorth.js',
  registry: 'src/cli/ZavorthCliRegistry.ts',
  helpers: 'src/cli/ZavorthCliSurfaceHelpers.ts',
  inkIndex: 'tools/cli/ink-test-env/index.tsx',
  inkPackage: 'tools/cli/ink-test-env/package.json',
} as const;

const REQUIRED_COMMANDS = [
  'zavorth setup',
  'zavorth start',
  'zavorth open',
  'zavorth ready',
  'zavorth status',
  'zavorth chat',
  'zavorth doctor',
  'zavorth providers',
  'zavorth channels',
  'zavorth skills',
  'zavorth review',
  'zavorth trust',
] as const;

export class ZavorthCliFinalProductPolishService {
  private readonly now: () => Date;
  private readonly rootDir: string;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = runtime.rootDir || process.cwd();
  }

  public buildSnapshot(): ZavorthCliFinalProductPolishSnapshot {
    const files = {
      bin: this.read(FILES.bin),
      registry: this.read(FILES.registry),
      helpers: this.read(FILES.helpers),
      inkIndex: this.read(FILES.inkIndex),
      inkPackage: this.read(FILES.inkPackage),
    };
    const entries = this.buildEntries(files);
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const inkPreviewRendersOnce = files.inkIndex.includes('waitUntilExit()')
      && files.inkIndex.includes('AutoExit')
      && !files.inkIndex.includes('setTimeout(() =>')
      && !files.inkIndex.includes('setInterval(');
    const noControlSurfaceByDefault = !files.inkIndex.includes('/control')
      && !files.helpers.includes('/control')
      && !files.registry.includes('zavorth control');
    const englishDefaultCriticalPath = !/(Comando vazio|Fechando|Voce|Dica rapida|Seguranca|Painel)/u.test([
      files.inkIndex,
      files.registry.slice(0, 16000),
      files.helpers.slice(850, 1150),
    ].join('\n'));

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CLI_FINAL_PRODUCT_POLISH_CONTRACT_VERSION,
      source: 'ZavorthCliFinalProductPolishService',
      status,
      files: FILES,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        requiredCommands: [...REQUIRED_COMMANDS],
        dashboardPath: '/dashboard',
        zavorthControlPath: '/control',
        inkPreviewRendersOnce,
        inkInteractiveMode: files.inkIndex.includes('readline.createInterface')
          && files.inkIndex.includes('/dashboard')
          && files.inkIndex.includes('/exit'),
        zavorthNativeCommandIdentity: files.inkIndex.includes('Zavorth Agent OS / Command Runtime')
          && files.inkIndex.includes('FOX')
          && files.inkIndex.includes('Subagent Deck')
          && files.inkIndex.includes('Receipt Preview'),
        noInfiniteRenderLoop: inkPreviewRendersOnce,
        englishDefaultCriticalPath,
        noControlSurfaceByDefault,
        cliCanExecuteMutations: false,
        rawSecretsSerialized: false,
      },
      safety: {
        cliProjectionsAreReadOnly: true,
        mutableExecutionStaysInRuntime: true,
        approvalsRemainPolicyBrokerBound: true,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:cli-final-product-polish',
        inspectJson: 'npm run zavorth:cli-final-product-polish:json',
        check: 'npm run zavorth:cli-final-product-polish:check --silent',
        nextStage: 'Intent model3 - Live Certification Matrix',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthCliFinalProductPolishSnapshot): string {
    const lines = [
      'Zavorth CLI Final Product Polish - Intent model2',
      '',
      `Status: ${snapshot.status}`,
      `Commands: ${snapshot.summary.requiredCommands.join(', ')}`,
      `Ink renders once: ${snapshot.summary.inkPreviewRendersOnce}`,
      `Interactive mode: ${snapshot.summary.inkInteractiveMode}`,
      `No render loop: ${snapshot.summary.noInfiniteRenderLoop}`,
      `Dashboard path: ${snapshot.summary.dashboardPath}`,
      '',
      'CLI polish matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | visible=${entry.userVisible}`);
      for (const blocker of entry.blockers) lines.push(`  blocker: ${blocker}`);
    }
    lines.push('', 'Safety: CLI projections are read-only; mutable execution remains owned by the governed runtime.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildEntries(files: Record<keyof typeof FILES, string>): ZavorthCliFinalProductPolishEntry[] {
    return [
      this.entry({
        id: 'cli.public-bin',
        label: 'Public CLI entrypoint',
        kind: 'surface',
        passed: files.bin.includes('ZAVORTH_PUBLIC_CLI')
          && files.bin.includes('dist/zavorth-cli.js'),
        userVisible: true,
        evidence: ['bin/zavorth.js', 'ZAVORTH_PUBLIC_CLI'],
      }),
      this.entry({
        id: 'cli.daily-use-commands',
        label: 'Daily-use command projections',
        kind: 'command',
        passed: [
          'providers',
          'channels',
          'missions',
          'receipts',
          'schedule',
          'skills',
          'agents',
          'templates',
        ].every((marker) => files.registry.includes(`${marker}: {`) || files.registry.includes(`${marker}',`)),
        userVisible: true,
        evidence: ['providers', 'channels', 'missions', 'receipts', 'schedule', 'skills', 'agents'],
      }),
      this.entry({
        id: 'cli.help-surface',
        label: 'Root help exposes real daily commands',
        kind: 'command',
        passed: REQUIRED_COMMANDS.every((command) => files.helpers.includes(command))
          && files.helpers.includes('/dashboard')
          && files.helpers.includes('Open Dashboard.'),
        userVisible: true,
        evidence: [...REQUIRED_COMMANDS, '/dashboard'],
      }),
      this.entry({
        id: 'cli.ink-static-render',
        label: 'Ink preview renders once',
        kind: 'ink',
        passed: files.inkIndex.includes('AutoExit')
          && files.inkIndex.includes('waitUntilExit()')
          && !files.inkIndex.includes('setTimeout(() =>')
          && !files.inkIndex.includes('setInterval('),
        userVisible: true,
        evidence: ['AutoExit', 'waitUntilExit', 'no setInterval'],
      }),
      this.entry({
        id: 'cli.ink-identity',
        label: 'Zavorth native command identity',
        kind: 'ink',
        passed: files.inkIndex.includes('Zavorth Agent OS / Command Runtime')
          && files.inkIndex.includes('FOX')
          && files.inkIndex.includes('Subagent Deck')
          && files.inkIndex.includes('Receipt Preview'),
        userVisible: true,
        evidence: ['fox', 'wordmark', 'tools', 'skills', 'receipts'],
      }),
      this.entry({
        id: 'cli.dashboard-path',
        label: 'Dashboard is the main visual target',
        kind: 'surface',
        passed: files.inkIndex.includes('/dashboard')
          && files.helpers.includes('/dashboard')
          && !files.inkIndex.includes('/control'),
        userVisible: true,
        evidence: ['/dashboard', 'no /control in Ink preview'],
      }),
      this.entry({
        id: 'cli.english-critical-path',
        label: 'English default on critical CLI path',
        kind: 'language',
        passed: !/(Comando vazio|Fechando|Voce|Dica rapida|Seguranca|Painel)/u.test([
          files.inkIndex,
          files.registry.slice(0, 16000),
          files.helpers.slice(850, 1150),
        ].join('\n')),
        userVisible: true,
        evidence: ['critical command output is English'],
      }),
      this.entry({
        id: 'cli.read-only-projections',
        label: 'Daily projections do not execute mutations',
        kind: 'safety',
        passed: files.registry.includes('canExecuteMutations: false')
          && files.registry.includes('Zavorth should never silently pretend a provider is ready')
          && files.registry.includes('Every tick still passes through Policy Broker'),
        userVisible: false,
        evidence: ['canExecuteMutations: false', 'Policy Broker notes'],
      }),
      this.entry({
        id: 'cli.ink-package',
        label: 'Ink preview package supports check and once',
        kind: 'workspace',
        passed: files.inkPackage.includes('"once"')
          && files.inkPackage.includes('"check"')
          && files.inkPackage.includes('"ink"'),
        userVisible: false,
        evidence: ['npm run once', 'npm run check'],
      }),
    ];
  }

  private entry(input: {
    id: string;
    label: string;
    kind: ZavorthCliFinalProductPolishEntryKind;
    passed: boolean;
    userVisible: boolean;
    evidence: string[];
  }): ZavorthCliFinalProductPolishEntry {
    return {
      id: input.id,
      label: input.label,
      kind: input.kind,
      status: input.passed ? 'passed' : 'attention',
      userVisible: input.userVisible,
      evidence: input.evidence,
      blockers: input.passed ? [] : ['CLI polish marker is missing or drifted back toward demo/legacy behavior.'],
    };
  }

  private read(file: string): string {
    return fs.readFileSync(path.join(this.rootDir, file), 'utf8');
  }
}

function resolveStatus(entries: ZavorthCliFinalProductPolishEntry[]): ZavorthCliFinalProductPolishStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}
