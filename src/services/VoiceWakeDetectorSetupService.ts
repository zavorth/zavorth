import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import { mergeEnvContent, type ZavorthSetupStudioEnvUpdate } from '../cli/ZavorthSetupStudioService.js';
import type { ZavorthOperationalWakeDetectorSetup } from '../contracts/ZavorthOperationalRefinementContract.js';

export type VoiceWakeDetectorSetupChoice = 'disabled' | 'default-local' | 'custom-command';

export type VoiceWakeDetectorSetupInput = {
  choice?: VoiceWakeDetectorSetupChoice | null;
  command?: string | null;
  args?: string[] | string | null;
  apply?: boolean;
};

export type VoiceWakeDetectorSetupSnapshot = ZavorthOperationalWakeDetectorSetup & {
  envFile: string;
  summary: string;
};

type VoiceWakeDetectorSetupRuntime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
};

export class VoiceWakeDetectorSetupService {
  private readonly projectRoot: string;
  private readonly env: Record<string, string | undefined>;

  constructor(runtime: VoiceWakeDetectorSetupRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.env = runtime.env || process.env;
  }

  public buildPlan(input: VoiceWakeDetectorSetupInput = {}): VoiceWakeDetectorSetupSnapshot {
    const selected = normalizeChoice(input.choice, input.command, this.env);
    const envUpdates = this.buildEnvUpdates(selected, input);
    const applyPerformed = input.apply === true;
    const envFile = path.join(this.projectRoot, '.env');

    if (applyPerformed) {
      const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
      fs.writeFileSync(envFile, mergeEnvContent(current, envUpdates), 'utf8');
    }

    return {
      status: selected === 'disabled' ? 'partial' : 'ready',
      selected,
      envFile,
      envUpdates: envUpdates.map((entry) => ({
        key: entry.key,
        redactedValue: entry.redactedValue,
        reason: entry.reason,
      })),
      applyPerformed,
      summary: summaryFor(selected, applyPerformed),
      privacy: {
        defaultOff: true,
        localFirst: true,
        ttlRequired: true,
        rawAudioPersisted: false,
        visibleIndicatorRequired: true,
      },
      commands: [
        'zavorth echo wake setup --default-local --apply',
        'zavorth echo wake setup --custom-command <cmd> --args "<args>" --apply',
        'zavorth echo wake arm --ttl=15m',
        'zavorth echo wake disarm',
        'zavorth echo wake status',
      ],
    };
  }

  public renderText(snapshot: VoiceWakeDetectorSetupSnapshot): string {
    return [
      '[zavorth-wake-detector-setup]',
      `status=${snapshot.status} selected=${snapshot.selected} apply=${snapshot.applyPerformed ? 'yes' : 'no'}`,
      snapshot.summary,
      `env=${snapshot.envFile}`,
      ...snapshot.envUpdates.map((entry) => `- ${entry.key}=${entry.redactedValue} (${entry.reason})`),
      '',
    ].join('\n');
  }

  private buildEnvUpdates(
    selected: VoiceWakeDetectorSetupChoice,
    input: VoiceWakeDetectorSetupInput,
  ): ZavorthSetupStudioEnvUpdate[] {
    const updates: ZavorthSetupStudioEnvUpdate[] = [
      {
        key: 'ZAVORTH_WAKE_TTL_SECONDS',
        value: String(Math.max(30, Number(this.env.ZAVORTH_WAKE_TTL_SECONDS || 900))),
        redactedValue: String(Math.max(30, Number(this.env.ZAVORTH_WAKE_TTL_SECONDS || 900))),
        reason: 'session TTL for opt-in wake word arming',
      },
    ];

    if (selected === 'disabled') {
      updates.push(
        envUpdate('ZAVORTH_WAKE_EMBEDDED', '0', 'wake detector disabled during setup'),
        envUpdate('ZAVORTH_WAKE_COMMAND', '', 'no external detector command configured'),
        envUpdate('ZAVORTH_WAKE_ARGS', '', 'no external detector arguments configured'),
      );
      return updates;
    }

    if (selected === 'default-local') {
      updates.push(
        envUpdate('ZAVORTH_WAKE_EMBEDDED', '1', 'use bundled/local detector path when available'),
        envUpdate('ZAVORTH_WAKE_COMMAND', '', 'default detector does not require a custom process'),
        envUpdate('ZAVORTH_WAKE_ARGS', '', 'default detector does not require custom arguments'),
      );
      return updates;
    }

    const command = String(input.command || this.env.ZAVORTH_WAKE_COMMAND || '').trim();
    const args = normalizeArgs(input.args || this.env.ZAVORTH_WAKE_ARGS || '');
    updates.push(
      envUpdate('ZAVORTH_WAKE_EMBEDDED', '0', 'custom detector owns wake detection'),
      envUpdate('ZAVORTH_WAKE_COMMAND', command, 'custom detector command selected by operator'),
      envUpdate('ZAVORTH_WAKE_ARGS', args, 'custom detector arguments selected by operator'),
    );
    return updates;
  }
}

function normalizeChoice(
  rawChoice: VoiceWakeDetectorSetupInput['choice'],
  command: VoiceWakeDetectorSetupInput['command'],
  env: Record<string, string | undefined>,
): VoiceWakeDetectorSetupChoice {
  const normalized = String(rawChoice || '').trim().toLowerCase();
  if (normalized === 'off' || normalized === 'disabled' || normalized === 'disable') return 'disabled';
  if (normalized === 'default' || normalized === 'default-local' || normalized === 'local') return 'default-local';
  if (normalized === 'custom' || normalized === 'custom-command') return 'custom-command';
  if (String(command || env.ZAVORTH_WAKE_COMMAND || '').trim()) return 'custom-command';
  if (String(env.ZAVORTH_WAKE_EMBEDDED || '').trim() === '1') return 'default-local';
  return 'default-local';
}

function normalizeArgs(value: string[] | string): string {
  if (Array.isArray(value)) return value.join(' ').trim();
  return String(value || '').trim();
}

function envUpdate(key: string, value: string, reason: string): ZavorthSetupStudioEnvUpdate {
  return {
    key,
    value,
    redactedValue: key.includes('COMMAND') || key.includes('ARGS') ? redactShell(value) : value,
    reason,
  };
}

function redactShell(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, '$1=[REDACTED_SECRET]');
}

function summaryFor(selected: VoiceWakeDetectorSetupChoice, applied: boolean): string {
  const suffix = applied ? ' Configuration was written to .env.' : ' Preview only; no file was written.';
  if (selected === 'disabled') return `Wake remains off by default and no detector is configured.${suffix}`;
  if (selected === 'custom-command') return `Wake uses an operator-selected detector command, still TTL-bound and local-first.${suffix}`;
  return `Wake uses the default local detector path when available, still opt-in per session.${suffix}`;
}
