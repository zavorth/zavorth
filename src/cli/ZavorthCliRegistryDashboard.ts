// @ts-nocheck
import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  DashboardAccessService,
  parseDashboardAccessAction,
  type DashboardAccessDoctorSnapshot,
  type DashboardAccessSnapshot,
} from '../services/DashboardAccessService.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  normalized: string;
  args: string;
  writer: CliWriter;
};

function isDashboardDoctorSnapshot(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): snapshot is DashboardAccessDoctorSnapshot {
  return 'checks' in snapshot;
}

function formatDashboardAccessJson(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): Record<string, unknown> {
  if (isDashboardDoctorSnapshot(snapshot)) {
    return snapshot;
  }

  const base: Record<string, unknown> = {
    ok: true,
    action: snapshot.action,
    opened: snapshot.opened,
    publicUrl: snapshot.publicUrl,
    tokenSource: snapshot.tokenSource,
    tokenFile: snapshot.tokenFile,
  };
  if (snapshot.action === 'url') {
    base.url = snapshot.url;
  }
  if (snapshot.action === 'token') {
    base.token = snapshot.token;
  }
  return base;
}

function formatDashboardAccessCli(
  snapshot: DashboardAccessSnapshot | DashboardAccessDoctorSnapshot,
): string {
  if (isDashboardDoctorSnapshot(snapshot)) {
    const lines = ['Dashboard Doctor', ''];
    for (const check of snapshot.checks) {
      const icon = check.ok ? 'OK' : 'FAIL';
      lines.push(`  [${icon}] ${check.label}: ${check.detail || (check.ok ? 'Passed' : 'Failed')}`);
    }
    lines.push('');
    lines.push(snapshot.ok ? 'All checks passed.' : 'Some checks failed. Run "zavorth dashboard repair" to fix.');
    return lines.join('\n');
  }

  const lines = ['Dashboard Access'];
  lines.push(`  Action: ${snapshot.action}`);
  if (snapshot.action === 'url' && snapshot.url) {
    lines.push(`  URL: ${snapshot.url}`);
  }
  if (snapshot.action === 'token' && snapshot.token) {
    lines.push(`  Token: ${snapshot.token}`);
  }
  if (snapshot.publicUrl) {
    lines.push(`  Public URL: ${snapshot.publicUrl}`);
  }
  if (snapshot.opened) {
    lines.push('  Browser opened.');
  }
  return lines.join('\n');
}

export async function handleZavorthCliRegistryDashboardCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { effectiveFlags, commandName, args, writer } = params;

  if (commandName !== 'dashboard' && commandName !== 'control') {
    return null;
  }

  const access = new DashboardAccessService();
  const action = parseDashboardAccessAction(args);
  const snapshot = action === 'doctor'
    ? access.doctor()
    : action === 'repair'
      ? access.repair()
      : action === 'generate-token'
        ? access.generateToken()
        : await access.run(action);
  const body = effectiveFlags.json
    ? JSON.stringify(formatDashboardAccessJson(snapshot), null, 2)
    : formatDashboardAccessCli(snapshot);
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}
