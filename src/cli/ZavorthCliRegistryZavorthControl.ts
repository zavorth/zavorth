import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  ZavorthControlAccessService,
  parseZavorthControlAccessAction,
  type ZavorthControlAccessDoctorSnapshot,
  type ZavorthControlAccessSnapshot,
} from '../services/ZavorthControlAccessService.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  normalized: string;
  args: string;
  writer: CliWriter;
};

function isZavorthControlDoctorSnapshot(
  snapshot: ZavorthControlAccessSnapshot | ZavorthControlAccessDoctorSnapshot,
): snapshot is ZavorthControlAccessDoctorSnapshot {
  return 'status' in snapshot;
}

function formatZavorthControlAccessJson(
  snapshot: ZavorthControlAccessSnapshot | ZavorthControlAccessDoctorSnapshot,
): Record<string, unknown> {
  if (isZavorthControlDoctorSnapshot(snapshot)) {
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

function formatZavorthControlAccessCli(
  snapshot: ZavorthControlAccessSnapshot | ZavorthControlAccessDoctorSnapshot,
): string {
  if (isZavorthControlDoctorSnapshot(snapshot)) {
    const lines = ['ZavorthControl Doctor', ''];
    lines.push(`  Status: ${snapshot.status}`);
    for (const problem of snapshot.problems) {
      lines.push(`  [FAIL] ${problem}`);
    }
    lines.push('');
    lines.push(snapshot.ok ? 'All checks passed.' : 'Some checks failed. Run "zavorth zavorthControl repair" to fix.');
    return lines.join('\n');
  }

  const lines = ['ZavorthControl Access'];
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

export async function handleZavorthCliRegistryControlCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { effectiveFlags, commandName, args, writer } = params;

  if (commandName !== 'control' && commandName !== 'open') {
    return null;
  }

  const access = new ZavorthControlAccessService();
  const action = parseZavorthControlAccessAction(args);
  const snapshot = action === 'doctor'
    ? access.doctor()
    : action === 'repair'
      ? access.repair()
      : action === 'generate-token'
        ? access.generateToken()
        : await access.run(action);
  const body = effectiveFlags.json
    ? JSON.stringify(formatZavorthControlAccessJson(snapshot), null, 2)
    : formatZavorthControlAccessCli(snapshot);
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}
