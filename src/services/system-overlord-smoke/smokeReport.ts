import path from 'path';
import { logger } from '../../logger.js';
import type {
  SystemOverlordSmokeItem,
  SystemOverlordSmokeReport,
  SystemOverlordSmokeStatus,
} from './smokeTypes.js';

export function buildSmokeCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32'
    ? 'npm.cmd run test:overlord:smoke'
    : 'npm run test:overlord:smoke';
}

export function buildRunningSmokeReport(input: {
  startedAt: string;
  items: SystemOverlordSmokeItem[];
  reportFile: string;
  platform?: NodeJS.Platform;
}): SystemOverlordSmokeReport {
  return {
    startedAt: input.startedAt,
    finishedAt: null,
    status: 'running',
    ok: false,
    command: buildSmokeCommand(input.platform),
    summary: 'Smoke do System Overlord em andamento.',
    probeUrl: null,
    items: input.items,
    error: null,
    file: input.reportFile,
  };
}

export function buildUnexpectedFailureSmokeReport(input: {
  startedAt: string;
  probeUrl: string | null;
  items: SystemOverlordSmokeItem[];
  error: unknown;
  reportFile: string;
  now: () => Date;
  platform?: NodeJS.Platform;
}): SystemOverlordSmokeReport {
  return {
    startedAt: input.startedAt,
    finishedAt: input.now().toISOString(),
    status: 'failed',
    ok: false,
    command: buildSmokeCommand(input.platform),
    summary: 'Smoke do System Overlord falhou de forma inesperada.',
    probeUrl: input.probeUrl,
    items: input.items,
    error: input.error instanceof Error ? input.error.message : String(input.error),
    file: input.reportFile,
  };
}

export function buildFinalSmokeReport(input: {
  startedAt: string;
  probeUrl: string;
  items: SystemOverlordSmokeItem[];
  reportFile: string;
  now: () => Date;
  platform?: NodeJS.Platform;
}): SystemOverlordSmokeReport {
  const passed = input.items.filter((item) => item.status === 'passed').length;
  const failed = input.items.filter((item) => item.status === 'failed').length;
  const skipped = input.items.filter((item) => item.status === 'skipped').length;
  const status: SystemOverlordSmokeStatus =
    failed > 0
      ? 'failed'
      : passed > 0
        ? 'passed'
        : 'skipped';
  const summary =
    failed > 0
      ? `Smoke do System Overlord encontrou ${failed} falha(s), com ${passed} item(ns) validado(s) e ${skipped} pulado(s).`
      : passed > 0
        ? `Smoke do System Overlord validou ${passed} superficie(s) e pulou ${skipped} item(ns) opcionais nao configurados.`
        : 'Smoke do System Overlord nao encontrou superfÃ­cies prontas para validar e terminou apenas com skips honestos.';

  return {
    startedAt: input.startedAt,
    finishedAt: input.now().toISOString(),
    status,
    ok: status === 'passed',
    command: buildSmokeCommand(input.platform),
    summary,
    probeUrl: input.probeUrl,
    items: input.items,
    error: null,
    file: input.reportFile,
  };
}

export function writeSmokeReport(
  report: SystemOverlordSmokeReport,
  input: {
    reportFile: string;
    mkdirSync: (target: string, options?: { recursive?: boolean }) => void;
    writeFileSync: (target: string, contents: string, encoding: BufferEncoding) => void;
  },
): void {
  if (!input.reportFile) {
    return;
  }

  try {
    input.mkdirSync(path.dirname(input.reportFile), { recursive: true });
    input.writeFileSync(input.reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } catch (err: any) { const error = err; const e = err; logger.warn("[auto-fix] Empty catch block", err); }
}
