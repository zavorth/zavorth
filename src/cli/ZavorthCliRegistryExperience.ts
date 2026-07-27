import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  formatExperienceCommandResult,
  formatExperienceDiffs,
  formatExperienceHome,
  formatExperienceHud,
  formatExperienceLearning,
  formatExperiencePulse,
} from './ZavorthCliExperienceRenderer.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  normalized: string;
  args: string;
  writer: CliWriter;
};

/**
 * Explicit CLI profile tokens only — never free-text keyword feature routing.
 * Accepts: short|dev|executive|mentor as a standalone token, or --profile <id>.
 * Natural-language phrases ("summarize impacto…") stay model-owned.
 */
function parseExperienceResponseProfile(args: string): 'short' | 'dev' | 'executive' | 'mentor' | null {
  const raw = String(args || '').trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/).filter(Boolean);
  const profileFlagIdx = tokens.findIndex((t) => t === '--profile' || t === '-p' || t === '--style');
  if (profileFlagIdx >= 0) {
    const id = String(tokens[profileFlagIdx + 1] || '').toLowerCase();
    if (id === 'short' || id === 'dev' || id === 'executive' || id === 'mentor') return id;
    if (id === 'curto' || id === 'objetivo') return 'short';
    if (id === 'developer' || id === 'technical' || id === 'technical') return 'dev';
    if (id === 'executivo' || id === 'manager') return 'executive';
    if (id === 'teacher' || id === 'didatico') return 'mentor';
    return null;
  }
  // Bare explicit token as first or only arg (CLI deterministic, not free-text NLU).
  const first = String(tokens[0] || '').toLowerCase();
  if (tokens.length === 1) {
    if (first === 'short' || first === 'dev' || first === 'executive' || first === 'mentor') return first;
    if (first === 'curto' || first === 'objetivo') return 'short';
    if (first === 'developer' || first === 'technical' || first === 'technical') return 'dev';
    if (first === 'executivo' || first === 'manager') return 'executive';
    if (first === 'teacher' || first === 'didatico' || first === 'mentor') return 'mentor';
  }
  return null;
}

function parseExperienceDiffCliArgs(args: string): {
  reviewId: string;
  targetId: string;
  decision: 'approve-plan' | 'approve-file' | 'approve-hunk' | 'reject-hunk' | 'retry-without-hunk';
} | null {
  const tokens = String(args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const action = String(tokens[0] || '')
    .trim()
    .toLowerCase();
  if (!action || action === 'list' || action === 'status' || action === 'review' || action === 'show') return null;
  const firstId = tokens[1] || 'current';
  const secondId = tokens[2] || firstId;
  if (action === 'approve' || action === 'approve-plan') {
    return { reviewId: firstId, targetId: firstId, decision: 'approve-plan' };
  }
  if (action === 'approve-file') {
    return { reviewId: firstId, targetId: secondId, decision: 'approve-file' };
  }
  if (action === 'approve-hunk') {
    return { reviewId: firstId, targetId: secondId, decision: 'approve-hunk' };
  }
  if (action === 'reject-hunk' || action === 'reject') {
    return { reviewId: firstId, targetId: secondId, decision: 'reject-hunk' };
  }
  if (action === 'retry' || action === 'retry-without-hunk') {
    return { reviewId: firstId, targetId: secondId, decision: 'retry-without-hunk' };
  }
  return null;
}

function parseExperienceLearningCliArgs(args: string): {
  candidateId?: string | null;
  decision: 'approve' | 'reject' | 'promote' | 'revoke' | 'reset' | 'export';
} | null {
  const tokens = String(args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const action = String(tokens[0] || '')
    .trim()
    .toLowerCase();
  if (!action) return null;
  if (action === 'list' || action === 'status' || action === 'review') return null;
  if (action === 'approve' || action === 'reject' || action === 'promote' || action === 'revoke') {
    return {
      decision: action,
      candidateId: tokens[1] || null,
    };
  }
  if (action === 'reset' || action === 'export') {
    return {
      decision: action,
      candidateId: null,
    };
  }
  return null;
}

export async function handleZavorthCliRegistryExperienceCommand(
  params: RegistryCommandParams,
): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, normalized, args, writer } = params;

  if (commandName === 'home' || commandName === 'experience') {
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core unavailable.' }, null, 2)
      : snapshot
        ? formatExperienceHome(snapshot)
        : 'Experience Core unavailable in this runtime.';
    writer.line(body);
    return {
      ok: Boolean(snapshot),
      handled: true,
      output: [body],
      error: snapshot ? null : 'Experience Core unavailable.',
    };
  }

  if (commandName === 'pulse') {
    const responseProfile = parseExperienceResponseProfile(args || normalized);
    if (responseProfile && runtime.experienceCoreService) {
      await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: `use estilo ${responseProfile}`,
        intent: 'ask',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        responseProfile,
      });
    }
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
      responseProfile,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot?.daily?.pulse || { ok: false, error: 'Zavorth Pulse unavailable.' }, null, 2)
      : snapshot
        ? formatExperiencePulse(snapshot)
        : 'Zavorth Pulse unavailable in this runtime.';
    writer.line(body);
    return {
      ok: Boolean(snapshot),
      handled: true,
      output: [body],
      error: snapshot ? null : 'Zavorth Pulse unavailable.',
    };
  }

  if (commandName === 'hud') {
    const snapshot = runtime.experienceCoreService?.buildHome({
      surface: effectiveFlags.platform,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint || null,
      responseProfile: parseExperienceResponseProfile(args || normalized),
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot || { ok: false, error: 'Experience Core unavailable.' }, null, 2)
      : snapshot
        ? formatExperienceHud(snapshot)
        : 'Experience Core unavailable in this runtime.';
    writer.line(body);
    return {
      ok: Boolean(snapshot),
      handled: true,
      output: [body],
      error: snapshot ? null : 'Experience Core unavailable.',
    };
  }

  if (commandName === 'diff') {
    if (runtime.experienceCoreService) {
      const diffDecision = parseExperienceDiffCliArgs(args);
      if (diffDecision) {
        const result = await runtime.experienceCoreService.executeCommand({
          contractVersion: 'ExperienceCommand/v1',
          text: `diff ${args}`.trim(),
          intent: 'run',
          surface: effectiveFlags.platform,
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
          workspace: effectiveFlags.workspaceHint || null,
          diffDecision,
        });
        const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : formatExperienceCommandResult(result);
        writer.line(body);
        return { ok: result.ok, handled: true, output: [body], error: result.error };
      }
      const snapshot = runtime.experienceCoreService.buildHome({
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot.diffReviews || [], null, 2)
        : formatExperienceDiffs(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
  }

  if (commandName === 'ask' || commandName === 'run') {
    if (runtime.experienceCoreService) {
      const requestText = args || (commandName === 'run' ? normalized : '');
      const responseProfile = parseExperienceResponseProfile(requestText);
      const result = await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: requestText,
        intent: commandName === 'run' ? 'run' : 'ask',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        trustMode: 'protected',
        responseProfile,
        metadata: {
          cliCommandName: commandName,
          repl: effectiveFlags.repl,
          headless: effectiveFlags.headless,
          approvalMode: effectiveFlags.approvalMode || undefined,
          responseProfile: responseProfile || undefined,
        },
      });
      const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : formatExperienceCommandResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.error };
    }
  }

  if (commandName === 'learn' || commandName === 'learning') {
    if (runtime.experienceCoreService) {
      const learning = parseExperienceLearningCliArgs(args);
      if (!learning) {
        const snapshot = runtime.experienceCoreService.buildHome({
          surface: effectiveFlags.platform,
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
          workspace: effectiveFlags.workspaceHint || null,
        });
        const body = effectiveFlags.json
          ? JSON.stringify(snapshot.learning, null, 2)
          : formatExperienceLearning(snapshot);
        writer.line(body);
        return { ok: true, handled: true, output: [body], error: null };
      }
      const result = await runtime.experienceCoreService.executeCommand({
        contractVersion: 'ExperienceCommand/v1',
        text: `learn ${args}`.trim(),
        intent: 'learn',
        surface: effectiveFlags.platform,
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
        workspace: effectiveFlags.workspaceHint || null,
        learning,
      });
      const body = effectiveFlags.json ? JSON.stringify(result, null, 2) : formatExperienceCommandResult(result);
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.error };
    }
  }

  return null;
}
