import fs from 'node:fs';
import path from 'node:path';

const DOC = 'docs/200-wave-3-native-absorption-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRODUCTION_RESTORE_DOC = 'docs/199-wave-3-production-restore-load-command-center-native-first.md';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const REQUIRED_SURFACES = [
  'capabilities/plugins',
  'dashboard/Command Center view models',
  'providers',
  'channels',
  'message transports',
  'sessions/history metadata',
  'config/SecretRef/state metadata',
  'refresh/reconciliation',
  'action dispatch',
  'message send',
  'provider execution',
  'command/tool execution',
  'migration/import',
] as const;

const VALID_CLASSIFICATIONS = new Set([
  'absorbed-native',
  'native-first-refreshable',
  'adapter-required',
  'blocked',
  'future-native-replacement',
]);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function surfaceRow(content: string, surface: string): string {
  const row = content
    .split('\n')
    .find((line) => line.startsWith(`| ${surface} |`));

  if (!row) {
    throw new Error(`Missing surface row: ${surface}`);
  }

  return row;
}

function rowClassification(row: string): string {
  return row.split('|').map((part) => part.trim())[2];
}

describe('Wave 3 native absorption milestone report', () => {
  it('documents the Wave 3 native absorption milestone and required guarantees', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave3-native-absorption-milestone-recorded');
    expect(content).toContain('wave3NativeAbsorptionMilestoneRecorded=true');
    expect(content).toContain('absorbedNativeSurfacesExplicit=true');
    expect(content).toContain('adapterRequiredSurfacesExplicit=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).toContain('partialAdapterRemovalCandidatesListed=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForCommandCenterRender=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForNativeRegistryLookup=false');
    expect(content).toContain('sourceRuntimeAuthority=false');
    expect(content).toContain('executionAuthority=false');
    expect(content).toContain('messageActuallySent=false');
    expect(content).toContain('providerActuallyExecuted=false');
    expect(content).toContain('commandActuallyExecuted=false');
    expect(content).toContain('toolActuallyExecuted=false');
    expect(content).toContain('stateMigrated=false');
    expect(content).toContain('sourceModuleCopied=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('Wave 3 consolidation pack follow-up: docs/201-wave-3-native-absorption-consolidation-pack.md');
    expect(content).toContain('advance beyond the consolidation pack');
  });

  it('lists every required surface with a valid classification', () => {
    const content = read(DOC);

    REQUIRED_SURFACES.forEach((surface) => {
      const row = surfaceRow(content, surface);
      const classification = rowClassification(row);

      expect(VALID_CLASSIFICATIONS.has(classification)).toBe(true);
    });
  });

  it('marks absorbed and native-first surfaces with concrete evidence gates', () => {
    const content = read(DOC);
    const evidenceExpectations: Array<[string, string[]]> = [
      ['capabilities/plugins', ['`185`', '`190`', '`194`-`199`']],
      ['dashboard/Command Center view models', ['`186`', '`192`', '`199`']],
      ['providers', ['`187`', '`190`', '`191`']],
      ['channels', ['`183`', '`187`', '`191`']],
      ['message transports', ['`182`', '`183`', '`187`']],
      ['sessions/history metadata', ['`188`', '`194`-`199`']],
      ['config/SecretRef/state metadata', ['`189`', '`194`-`199`']],
    ];

    evidenceExpectations.forEach(([surface, gates]) => {
      const row = surfaceRow(content, surface);

      gates.forEach((gate) => {
        expect(row).toContain(gate);
      });
    });
  });

  it('keeps adapter-required and blocked surfaces explicit', () => {
    const content = read(DOC);

    expect(rowClassification(surfaceRow(content, 'refresh/reconciliation'))).toBe('adapter-required');
    expect(rowClassification(surfaceRow(content, 'action dispatch'))).toBe('blocked');
    expect(rowClassification(surfaceRow(content, 'message send'))).toBe('blocked');
    expect(rowClassification(surfaceRow(content, 'provider execution'))).toBe('blocked');
    expect(rowClassification(surfaceRow(content, 'command/tool execution'))).toBe('blocked');
    expect(rowClassification(surfaceRow(content, 'migration/import'))).toBe('blocked');
    expect(content).toContain('global adapter removal is not allowed');
    expect(content).toContain('live refresh/reconciliation commit is not implemented');
  });

  it('lists real native-first consumers and paths that do not call ExternalExecutor live', () => {
    const content = read(DOC);

    [
      'CommandCenterRuntimeProjection',
      'DashboardCommandCenterAdapterInput',
      'production-loaded Command Center projection from 199',
      'capability registry lookup/list/classify',
      'dashboard/Command Center render/view lookup',
      'provider/channel/transport metadata lookup/classify',
      'session/history metadata lookup/render',
      'config/SecretRef/state metadata lookup',
    ].forEach((item) => {
      expect(content).toContain(item);
    });
  });

  it('lists partial removal candidates without authorizing global adapter removal', () => {
    const content = read(DOC);

    [
      'capability/plugin registry lookup fallback',
      'dashboard view model default adapter path',
      'provider/channel/transport metadata discovery fallback',
      'session/config metadata lookup fallback',
    ].forEach((candidate) => {
      expect(content).toContain(candidate);
    });
    expect(content).toContain('These are candidates only; they do not authorize removal');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
  });

  it('updates tracking docs and prior production restore/load gate for the milestone', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/200-wave-3-native-absorption-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`200` is the Wave 3 native absorption milestone report');
    expect(read(PRODUCTION_RESTORE_DOC)).toContain('Wave 3 native absorption milestone report follow-up: docs/200-wave-3-native-absorption-milestone-report.md');
    expect(read(PRODUCTION_RESTORE_DOC)).toContain('Do not');
    expect(read(PRODUCTION_RESTORE_DOC)).toContain('`201`');
  });

  it('does not serialize raw secrets or grant forbidden authority', () => {
    const content = read(DOC);

    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(content).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(content).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
    expect(content).toContain('ExternalExecutor live call blocked');
    expect(content).toContain('provider/tool/command execution blocked');
    expect(content).toContain('message send blocked');
    expect(content).toContain('ExternalExecutor state migration/copy blocked');
  });
});
