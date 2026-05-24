import { TerminalPanel } from '../presentation/TerminalPanel.js';
import { TerminalTheme } from '../presentation/TerminalTheme.js';
import { ZavorthManagedConfigService, type ZavorthManagedConfigPlan } from '../../services/ZavorthManagedConfigService.js';
import type { CliExecutionResult, CliWriter, ZavorthCliFlags } from '../ZavorthCliContract.js';

export async function handleZavorthManagedConfigCommand(input: {
  commandName: string | null;
  args: string;
  flags: ZavorthCliFlags;
  writer: CliWriter;
}): Promise<CliExecutionResult | null> {
  if (!['managed-config', 'managed', 'enterprise'].includes(String(input.commandName || ''))) {
    return null;
  }

  const parsed = parseArgs(input.args);
  const plan = await new ZavorthManagedConfigService().buildPlan(parsed);
  const body = input.flags.json ? JSON.stringify(plan, null, 2) : renderManagedConfigPlan(plan);
  input.writer.line(body);
  return { ok: plan.ok, handled: true, output: [body], error: plan.ok ? null : 'Managed config is blocked.' };
}

function parseArgs(args: string): { sourceRef?: string | null; expectedChecksum?: string | null; apply?: boolean; yes?: boolean; deploymentKey?: string | null } {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  return {
    sourceRef: readFlag(tokens, 'source', { multiToken: true }) || readFlag(tokens, 'url', { multiToken: true }) || null,
    expectedChecksum: readFlag(tokens, 'checksum') || readFlag(tokens, 'sha256') || null,
    deploymentKey: readFlag(tokens, 'deployment-key') || null,
    apply: tokens.includes('apply') || tokens.includes('--apply'),
    yes: tokens.includes('--yes') || tokens.includes('-y'),
  };
}

function readFlag(tokens: string[], name: string, options: { multiToken?: boolean } = {}): string | null {
  const inlinePrefix = `--${name}=`;
  const inline = tokens.find((token) => token.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length).trim() || null;
  const index = tokens.indexOf(`--${name}`);
  if (index < 0) return null;
  if (!options.multiToken) {
    return String(tokens[index + 1] || '').trim() || null;
  }
  const values: string[] = [];
  for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
    const token = String(tokens[cursor] || '').trim();
    if (!token || token.startsWith('--')) break;
    values.push(token);
  }
  return values.join(' ').trim() || null;
}

function renderManagedConfigPlan(plan: ZavorthManagedConfigPlan): string {
  const color = plan.status === 'applied'
    ? TerminalTheme.colors.success
    : plan.status === 'blocked'
      ? TerminalTheme.colors.error
      : plan.status === 'attention'
        ? TerminalTheme.colors.warning
        : TerminalTheme.colors.info;
  const findings = plan.findings.length
    ? plan.findings.map((finding) => `${finding.severity.toUpperCase().padEnd(7)} ${finding.message}`).join('\n')
    : 'No findings.';
  const body = [
    `${TerminalTheme.format.bold('Status')} ${color(plan.status)}`,
    `source: ${plan.sourceRef || 'none'}`,
    `checksum: ${plan.checksum || 'unavailable'}`,
    `checksum verified: ${plan.checksumVerified ? 'yes' : 'no'}`,
    `deployment key: ${plan.deploymentKeyVerified === null ? 'not required' : plan.deploymentKeyVerified ? 'verified' : 'failed'}`,
    `applied: ${plan.applied ? 'yes' : 'no'}`,
    '',
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Managed payload')),
    `managed keys: ${plan.summary.managedKeys.join(', ') || 'none'}`,
    `requirements: ${plan.summary.requirementKeys.join(', ') || 'none'}`,
    `secret refs: ${plan.summary.secretRefs.join(', ') || 'none'}`,
    '',
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Findings')),
    findings,
    '',
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Targets')),
    `managed config: ${plan.managedConfigPath}`,
    `requirements: ${plan.requirementsPath}`,
    `receipt: ${plan.receiptPath}`,
    '',
    TerminalTheme.colors.primary(TerminalTheme.format.bold('Next actions')),
    ...plan.nextActions.map((action) => `${TerminalTheme.colors.primary('>')} ${action}`),
  ].join('\n');
  return TerminalPanel.render(body, {
    title: plan.applied ? 'Managed Config Applied' : 'Managed Config Preview',
    type: plan.status === 'blocked' ? 'error' : plan.status === 'attention' ? 'warning' : 'info',
  });
}
