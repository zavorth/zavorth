import os from 'os';
import { createRequire } from 'module';
import { logger } from '../logger.js';

type RuntimeBudgetThresholds = {
  rssMb: number;
  heapUsedMb: number;
  activeHandles: number;
  activeRequests: number;
  loadedCommonJsModules: number;
};

export type RuntimeBudgetProfile = 'minimal' | 'chat' | 'desktop' | 'browser' | 'dev' | 'full' | 'safe-8gb';

export type RuntimeResourceSnapshot = {
  version: 1;
  generatedAt: string;
  process: {
    pid: number;
    ppid: number;
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    uptimeSeconds: number;
    argv: string[];
    execPath: string;
  };
  host: {
    hostname: string;
    totalMemoryMb: number;
    freeMemoryMb: number;
    memoryLoadPercent: number;
    cpuCount: number;
  };
  runtime: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
    arrayBuffersMb: number;
    activeHandles: number;
    activeRequests: number;
    loadedCommonJsModules: number;
    handleTypes: Record<string, number>;
    requestTypes: Record<string, number>;
  };
};

export type RuntimeBudgetReport = {
  version: 1;
  generatedAt: string;
  profile: RuntimeBudgetProfile;
  ok: boolean;
  snapshot: RuntimeResourceSnapshot;
  thresholds: RuntimeBudgetThresholds;
  checks: Array<{
    id: keyof RuntimeBudgetThresholds;
    ok: boolean;
    actual: number;
    limit: number;
    unit: 'count' | 'MB';
  }>;
  recommendations: string[];
};

const DEFAULT_THRESHOLDS: Record<RuntimeBudgetProfile, RuntimeBudgetThresholds> = {
  minimal: {
    rssMb: 120,
    heapUsedMb: 55,
    activeHandles: 12,
    activeRequests: 20,
    loadedCommonJsModules: 220,
  },
  chat: {
    rssMb: 180,
    heapUsedMb: 90,
    activeHandles: 24,
    activeRequests: 24,
    loadedCommonJsModules: 420,
  },
  desktop: {
    rssMb: 220,
    heapUsedMb: 120,
    activeHandles: 32,
    activeRequests: 10,
    loadedCommonJsModules: 520,
  },
  browser: {
    rssMb: 260,
    heapUsedMb: 140,
    activeHandles: 40,
    activeRequests: 12,
    loadedCommonJsModules: 620,
  },
  dev: {
    rssMb: 320,
    heapUsedMb: 180,
    activeHandles: 70,
    activeRequests: 20,
    loadedCommonJsModules: 900,
  },
  full: {
    rssMb: 350,
    heapUsedMb: 210,
    activeHandles: 90,
    activeRequests: 24,
    loadedCommonJsModules: 1100,
  },
  'safe-8gb': {
    rssMb: 180,
    heapUsedMb: 90,
    activeHandles: 24,
    activeRequests: 24,
    loadedCommonJsModules: 420,
  },
};

function roundMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function countTypes(items: unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const type = item && typeof item === 'object' && 'constructor' in item
      ? ((item as { constructor?: { name?: string } }).constructor?.name || 'Unknown')
      : 'Unknown';
    counts[type] = (counts[type] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function readActiveHandles(): unknown[] {
  const fn = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles;
  return typeof fn === 'function' ? fn.call(process) : [];
}

function readActiveRequests(): unknown[] {
  const fn = (process as unknown as { _getActiveRequests?: () => unknown[] })._getActiveRequests;
  return typeof fn === 'function' ? fn.call(process) : [];
}

function readLoadedCommonJsModules(): number {
  try {
    const require = createRequire(__filename);
    return Object.keys(require.cache || {}).length;
  } catch (error: unknown) {logger.warn('[Runtime Resource Budget] cache operation failed', error); return 0; }
}

export class RuntimeResourceBudgetService {
  public inspectCurrentProcess(): RuntimeResourceSnapshot {
    const memory = process.memoryUsage();
    const activeHandles = readActiveHandles();
    const activeRequests = readActiveRequests();
    const totalMemoryMb = roundMb(os.totalmem());
    const freeMemoryMb = roundMb(os.freemem());

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      process: {
        pid: process.pid,
        ppid: process.ppid,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptimeSeconds: round(process.uptime()),
        argv: process.argv.slice(),
        execPath: process.execPath,
      },
      host: {
        hostname: os.hostname(),
        totalMemoryMb,
        freeMemoryMb,
        memoryLoadPercent: totalMemoryMb > 0 ? round(((totalMemoryMb - freeMemoryMb) / totalMemoryMb) * 100) : 0,
        cpuCount: os.cpus().length,
      },
      runtime: {
        rssMb: roundMb(memory.rss),
        heapTotalMb: roundMb(memory.heapTotal),
        heapUsedMb: roundMb(memory.heapUsed),
        externalMb: roundMb(memory.external),
        arrayBuffersMb: roundMb(memory.arrayBuffers),
        activeHandles: activeHandles.length,
        activeRequests: activeRequests.length,
        loadedCommonJsModules: readLoadedCommonJsModules(),
        handleTypes: countTypes(activeHandles),
        requestTypes: countTypes(activeRequests),
      },
    };
  }

  public buildBudgetReport(
    profile: RuntimeBudgetProfile,
    snapshot: RuntimeResourceSnapshot = this.inspectCurrentProcess(),
    overrides: Partial<RuntimeBudgetThresholds> = {},
  ): RuntimeBudgetReport {
    const thresholds = {
      ...DEFAULT_THRESHOLDS[profile],
      ...overrides,
    };
    const checks: RuntimeBudgetReport['checks'] = [
      {
        id: 'rssMb',
        ok: snapshot.runtime.rssMb <= thresholds.rssMb,
        actual: snapshot.runtime.rssMb,
        limit: thresholds.rssMb,
        unit: 'MB',
      },
      {
        id: 'heapUsedMb',
        ok: snapshot.runtime.heapUsedMb <= thresholds.heapUsedMb,
        actual: snapshot.runtime.heapUsedMb,
        limit: thresholds.heapUsedMb,
        unit: 'MB',
      },
      {
        id: 'activeHandles',
        ok: snapshot.runtime.activeHandles <= thresholds.activeHandles,
        actual: snapshot.runtime.activeHandles,
        limit: thresholds.activeHandles,
        unit: 'count',
      },
      {
        id: 'activeRequests',
        ok: snapshot.runtime.activeRequests <= thresholds.activeRequests,
        actual: snapshot.runtime.activeRequests,
        limit: thresholds.activeRequests,
        unit: 'count',
      },
      {
        id: 'loadedCommonJsModules',
        ok: snapshot.runtime.loadedCommonJsModules <= thresholds.loadedCommonJsModules,
        actual: snapshot.runtime.loadedCommonJsModules,
        limit: thresholds.loadedCommonJsModules,
        unit: 'count',
      },
    ];

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      profile,
      ok: checks.every((check) => check.ok),
      snapshot,
      thresholds,
      checks,
      recommendations: this.buildRecommendations(profile, snapshot, checks),
    };
  }

  public resolveProfile(value: string | null | undefined): RuntimeBudgetProfile {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized in DEFAULT_THRESHOLDS) {
      return normalized as RuntimeBudgetProfile;
    }
    return 'minimal';
  }

  private buildRecommendations(
    profile: RuntimeBudgetProfile,
    snapshot: RuntimeResourceSnapshot,
    checks: RuntimeBudgetReport['checks'],
  ): string[] {
    const recommendations: string[] = [];
    for (const check of checks.filter((entry) => !entry.ok)) {
      if (check.id === 'rssMb') {
        recommendations.push(`RSS acima do budget ${profile}; mantenha canais, browser e sidecars em lazy-load.`);
      }
      if (check.id === 'heapUsedMb') {
        recommendations.push('Heap acima do budget; revise caches quentes e carregamento antecipado de memoria/contexto.');
      }
      if (check.id === 'activeHandles') {
        recommendations.push('Handles ativos acima do budget; procure timers, sockets e watchers iniciados no boot.');
      }
      if (check.id === 'activeRequests') {
        recommendations.push('Requests ativos acima do budget; confirme que probes e chamadas de rede nao ficam penduradas.');
      }
      if (check.id === 'loadedCommonJsModules') {
        recommendations.push('Muitos modulos CommonJS carregados; mova dependencias pesadas para dynamic import por capability.');
      }
    }

    if (snapshot.host.memoryLoadPercent >= 80) {
      recommendations.push(`Host com memoria alta (${snapshot.host.memoryLoadPercent}%). Use perfil safe-8gb e evite browser/QA no boot.`);
    }

    return Array.from(new Set(recommendations));
  }
}
