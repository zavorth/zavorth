import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { formatReleasePresenceSnapshot } from './ZavorthCliReleaseRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

type ParsedReleaseArgs = {
  action: 'status' | 'diff' | 'rollback-preview' | 'presence';
  from: string | null;
  to: string | null;
  targetId: string | null;
  live: boolean;
};

export async function handleZavorthCliRegistryReleaseCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;
  if (commandName !== 'release') {
    return null;
  }

  const service = runtime.releasePresenceControlPlaneService;
  if (!service) {
    return null;
  }

  const parsed = parseReleaseArgs(args, effectiveFlags);
  const snapshot = parsed.action === 'diff'
    ? await service.buildDiff({
        from: parsed.from,
        to: parsed.to,
        live: parsed.live,
      })
    : parsed.action === 'rollback-preview'
      ? await service.buildRollbackPreview({
          targetId: parsed.targetId,
          preview: true,
          live: parsed.live,
        })
      : parsed.action === 'presence'
        ? await service.buildRemotePresence({ live: parsed.live })
        : await service.buildStatus({ live: parsed.live });

  const body = effectiveFlags.json
    ? JSON.stringify(snapshot, null, 2)
    : formatReleasePresenceSnapshot(snapshot);
  writer.line(body);
  return { ok: true, handled: true, output: [body], error: null };
}

function parseReleaseArgs(args: string, flags: Pick<ZavorthCliFlags, 'live'>): ParsedReleaseArgs {
  const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const first = String(tokens[0] || '').trim().toLowerCase();
  let action: ParsedReleaseArgs['action'] =
    first === 'diff'
      ? 'diff'
      : first === 'rollback'
        ? 'rollback-preview'
        : first === 'presence' || first === 'remote'
          ? 'presence'
          : 'status';
  let from: string | null = null;
  let to: string | null = null;
  let targetId: string | null = null;
  let live = Boolean(flags.live);

  const rest = action === 'status' && first !== 'status'
    ? tokens
    : tokens.slice(1);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const lower = token.toLowerCase();

    if (lower === 'status') {
      action = 'status';
      continue;
    }
    if (lower === 'diff') {
      action = 'diff';
      continue;
    }
    if (lower === 'presence' || lower === 'remote') {
      action = 'presence';
      continue;
    }
    if (lower === 'rollback') {
      action = 'rollback-preview';
      continue;
    }
    if (lower === '--preview' || lower === 'preview' || lower === '--dry-run' || lower === 'dryrun') {
      if (action === 'rollback-preview') {
        continue;
      }
      if (action === 'status') {
        action = 'rollback-preview';
      }
      continue;
    }
    if (lower === '--live') {
      live = true;
      continue;
    }
    if ((lower === '--id' || lower === '--target' || lower === '--target-id') && rest[index + 1]) {
      targetId = rest[index + 1];
      index += 1;
      continue;
    }
    if (lower.startsWith('--id=')) {
      targetId = token.slice('--id='.length);
      continue;
    }
    if (lower.startsWith('--target=')) {
      targetId = token.slice('--target='.length);
      continue;
    }
    if (lower.startsWith('--target-id=')) {
      targetId = token.slice('--target-id='.length);
      continue;
    }

    if (action === 'diff') {
      if (!from) {
        from = token;
        continue;
      }
      if (!to) {
        to = token;
        continue;
      }
    }
    if (action === 'rollback-preview' && !targetId) {
      targetId = token;
    }
  }

  return {
    action,
    from: from || 'previous',
    to: to || 'latest',
    targetId,
    live,
  };
}
