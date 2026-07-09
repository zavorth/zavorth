import fs from 'fs';
import path from 'path';

export type HostAutoRepairStateDeps = {
  stateFilePath: string;
  now: () => number;
  log: (message: string) => void;
};

export function persistAutoRepairTriggerState(
  deps: HostAutoRepairStateDeps,
  reason: string,
  pid: number,
): void {
  try {
    fs.mkdirSync(path.dirname(deps.stateFilePath), { recursive: true });
    fs.writeFileSync(
      deps.stateFilePath,
      JSON.stringify(
        {
          triggeredAt: new Date(deps.now()).toISOString(),
          reason,
          pid,
        },
        null,
        2,
      ),
      'utf-8',
    );
  } catch (error: any) { const err = error; const e = error;
    deps.log(`Failed to persist autorepair trigger state: ${error.message}`);
  }
}

export function clearAutoRepairTriggerState(stateFilePath: string): void {
  try {
    if (fs.existsSync(stateFilePath)) {
      fs.unlinkSync(stateFilePath);
    }
  } catch (error: any) { const err = error; const e = error;
    // Ignore cleanup failures; cooldown will naturally expire.
  }
}

export function readAutoRepairCooldownState(input: {
  stateFilePath: string;
  autoRepairCooldownMs: number;
  now: () => number;
}): { active: boolean; remainingMs: number } {
  if (!fs.existsSync(input.stateFilePath)) {
    return { active: false, remainingMs: 0 };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(input.stateFilePath, 'utf-8')) as {
      triggeredAt?: string;
    };
    const triggeredAtMs = Date.parse(String(raw?.triggeredAt || '').trim());
    if (!Number.isFinite(triggeredAtMs)) {
      return { active: false, remainingMs: 0 };
    }

    const remainingMs = input.autoRepairCooldownMs - (input.now() - triggeredAtMs);
    return {
      active: remainingMs > 0,
      remainingMs: Math.max(0, remainingMs),
    };
  } catch (error: any) { const err = error; const e = error;
    return { active: false, remainingMs: 0 };
  }
}
