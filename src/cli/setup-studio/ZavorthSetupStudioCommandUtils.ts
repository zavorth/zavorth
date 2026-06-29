import type { ZavorthSetupStudioSnapshot } from './ZavorthSetupStudioSchema.js';

export async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Live hatch timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function sanitizeOutput(value: string, snapshot: ZavorthSetupStudioSnapshot): string {
  let output = String(value || '');
  for (const entry of snapshot.plan.envUpdates) {
    if (entry.value && entry.value !== entry.redactedValue) {
      output = output.split(entry.value).join('[redacted]');
    }
  }
  return output
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\bhf_[A-Za-z0-9]{12,}\b/g, '[redacted]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, '[redacted]')
    .replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//[redacted]:[redacted]@');
}

export function orange(value: string): string {
  if (String(process.env.NO_COLOR || '').trim()) {
    return value;
  }
  if (!process.stdout?.isTTY && !String(process.env.FORCE_COLOR || '').trim()) {
    return value;
  }
  return `\u001b[38;2;6;182;212m${value}\u001b[0m`;
}
