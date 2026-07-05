import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { AIGatewayProxyService } from './AIGatewayProxyService.js';
import { logger } from '../logger.js';

export type AIGatewayCompatibilityDoctorReport = {
  ok: boolean;
  status: 'passed' | 'failed' | 'missing';
  checkedAt: string;
  baseUrl: string;
  upstreamBaseUrl: string;
  overlayFile: string | null;
  summary: string;
  command: string;
  checkedTarget: string;
  httpStatus: number | null;
  error: string | null;
};

type AIGatewayCompatibilityDoctorRuntime = {
  gatewayService?: Pick<AIGatewayProxyService, 'readStatus'>;
  fetchImpl?: typeof fetch;
};

export class GatewayCompatibilityDoctorService {
  private readonly gatewayService: Pick<AIGatewayProxyService, 'readStatus'>;
  private readonly fetchImpl: typeof fetch;

  constructor(runtime: AIGatewayCompatibilityDoctorRuntime = {}) {
    this.gatewayService = runtime.gatewayService || new AIGatewayProxyService();
    this.fetchImpl = runtime.fetchImpl || fetch;
  }

  public readLastReport(): AIGatewayCompatibilityDoctorReport {
    const fallback = this.buildFallback();
    try {
      if (!fs.existsSync(config.AIGatewayCompatibilityStatusFile)) {
        return fallback;
      }
      const parsed = JSON.parse(fs.readFileSync(config.AIGatewayCompatibilityStatusFile, 'utf8')) as Partial<AIGatewayCompatibilityDoctorReport>;
      return {
        ...fallback,
        ...parsed,
      };
    } catch (error) { logger.warn('[way Compatibility Doctor] JSON parse failed', error); return fallback; }
  }

  public async run(): Promise<AIGatewayCompatibilityDoctorReport> {
    const gateway = this.gatewayService.readStatus();
    if (!gateway.enabled) {
      const report = this.persist({
        ...this.buildFallback(),
        ok: false,
        status: 'missing',
        checkedAt: new Date().toISOString(),
        summary: 'Gateway proprio do AIGateway desativado.',
      });
      return report;
    }

    const checkedTarget = this.joinUrl(gateway.baseUrl, 'models');
    try {
      const response = await this.fetchImpl(checkedTarget, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      const ok = response.ok;
      return this.persist({
        ok,
        status: ok ? 'passed' : 'failed',
        checkedAt: new Date().toISOString(),
        baseUrl: gateway.baseUrl,
        upstreamBaseUrl: gateway.upstreamBaseUrl,
        overlayFile: gateway.overlayFile,
        summary: ok
          ? 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.'
          : `Gateway proprio do AIGateway respondeu com HTTP ${response.status}.`,
        command: 'AIGateway doctor',
        checkedTarget,
        httpStatus: response.status,
        error: null,
      });
    } catch (error) {
    logger.warn('[way Compatibility Doctor] network request failed', error);
    return this.persist({
        ok: false,
        status: 'failed',
        checkedAt: new Date().toISOString(),
        baseUrl: gateway.baseUrl,
        upstreamBaseUrl: gateway.upstreamBaseUrl,
        overlayFile: gateway.overlayFile,
        summary: 'Gateway proprio do AIGateway nao passou no doctor de compatibilidade.',
        command: 'AIGateway doctor',
        checkedTarget,
        httpStatus: null,
        error: error?.message || String(error),
      });
  }
  }

  private buildFallback(): AIGatewayCompatibilityDoctorReport {
    return {
      ok: false,
      status: 'missing',
      checkedAt: '',
      baseUrl: config.zavorthAIGatewayGatewayBaseUrl,
      upstreamBaseUrl: config.AIGatewayUpstreamBaseUrl,
      overlayFile: path.resolve(config.AIGatewayOverlayFile),
      summary: 'Ainda nao existe doctor de compatibilidade do AIGateway neste host.',
      command: 'AIGateway doctor',
      checkedTarget: this.joinUrl(config.zavorthAIGatewayGatewayBaseUrl, 'models'),
      httpStatus: null,
      error: null,
    };
  }

  private persist(report: AIGatewayCompatibilityDoctorReport): AIGatewayCompatibilityDoctorReport {
    fs.mkdirSync(path.dirname(config.AIGatewayCompatibilityStatusFile), { recursive: true });
    fs.writeFileSync(config.AIGatewayCompatibilityStatusFile, JSON.stringify(report, null, 2), 'utf8');
    return report;
  }

  private joinUrl(baseUrl: string, segment: string): string {
    const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(segment.replace(/^\/+/, ''), normalized).toString();
  }
}
