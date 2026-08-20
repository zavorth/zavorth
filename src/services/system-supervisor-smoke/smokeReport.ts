import path from 'path';
import { logger } from '../../logger.js';
import type {
  SystemOverlordSmokeItem,
  SystemOverlordSmokeReport,
  SystemOverlordSmokeStatus,
} from './smokeTypes.js';
import { asErrorLike } from '../../utils/errorLike';

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
    summary: 'Smoke do System Overlord running.',
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
    summary: 'Smoke do System Overlord failed de forma inesperada.',
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
      ? `System smoke found ${failed} failure(s), com ${passed} validated item(s) and ${skipped} skipped item(s).`
      : passed > 0
        ? `System Overlord smoke validated ${passed} surface(s) and skipped ${skipped} optional item(s) not configured.`
        : 'System Overlord smoke did not find any ready surfaces to validate and ended with only honest skips.';

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
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err); }
}
