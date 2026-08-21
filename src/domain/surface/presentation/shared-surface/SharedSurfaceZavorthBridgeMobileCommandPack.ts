import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type {

  ZavorthBridgeMobileAccessResult,
  ZavorthBridgeMobileAccessService,
} from '../../../../services/ZavorthBridgeMobileAccessService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
type ZavorthBridgeMobileAccessLike = Pick<ZavorthBridgeMobileAccessService, 'start' | 'status' | 'guide' | 'stop'>;

type SharedSurfaceZavorthBridgeMobileCommandPackDeps = {
  accessService: ZavorthBridgeMobileAccessLike;
};

export class SharedSurfaceZavorthBridgeMobileCommandPack {
  public constructor(private readonly deps: SharedSurfaceZavorthBridgeMobileCommandPackDeps) {}

  public async handle(
    ctx: IMessageContext,
    action: 'start' | 'status' | 'guide' | 'stop' | string,
  ): Promise<void> {
    const normalized = String(action || '').trim().toLowerCase();
    try {
      let result: ZavorthBridgeMobileAccessResult;
      if (normalized === 'stop' || normalized === 'off') {
        result = await this.deps.accessService.stop({
          requestedBy: String(ctx.userId || '').trim() || null,
        });
      } else if (normalized === 'guide' || normalized === 'guia') {
        result = await this.deps.accessService.guide();
      } else if (normalized === 'status' || normalized === 'check') {
        result = await this.deps.accessService.status();
      } else {
        result = await this.deps.accessService.start({
          requestedBy: String(ctx.userId || '').trim() || null,
        });
      }

      await ctx.reply(this.formatReply(result));
    } catch (error: unknown) {await ctx.reply(errorMessage(error, tSurface('error_bridge_mobile')));
    }
  }

  private formatReply(result: ZavorthBridgeMobileAccessResult): string {
    const lines = [
      'ZavorthBridge mobile',
      '',
      result.summary,
      `State: ${result.state}.`,
      `Mode: ${result.mode}.`,
      `Ready for remote use: ${result.readyForRemoteUse ? 'yes' : 'no'}.`,
      `URL: ${result.accessUrl || 'unavailable'}`,
    ];

    if (result.secret) {
      lines.push(`Password: ${result.secret}`);
    }
    if (result.verification) {
      lines.push(`Final confirmation: ${result.verification.ok ? 'yes' : 'pending'}.`);
      lines.push(`Verification: ${result.verification.summary}`);
      if (result.verification.targetUrl) {
        lines.push(`Verified URL: ${result.verification.targetUrl}`);
      }
      if (result.verification.httpStatus !== null) {
        lines.push(`HTTP: ${result.verification.httpStatus}`);
      }
    }
    if (result.lease.expiresAt) {
      lines.push(`Lease expires at: ${result.lease.expiresAt}`);
    }
    if (result.doctorSummary) {
      lines.push(`Doctor: ${result.doctorSummary}`);
    }

    if (result.action === 'start' && result.ok && result.verification?.ok) {
      lines.push('', 'Ready now:');
      lines.push('1. Open the link on the phone.');
      if (result.secret) {
        lines.push('2. Sign in with the configured password.');
        lines.push('3. Run /agmobile stop when done.');
      } else {
        lines.push('2. Run /agmobile stop when done.');
      }
    }

    if (result.guide.steps.length > 0) {
      lines.push('', 'Passo a passo:');
      result.guide.steps.slice(0, 5).forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
    }

    if (result.guide.notes.length > 0) {
      lines.push('', 'Notas:');
      result.guide.notes.slice(0, 4).forEach((note) => lines.push(`- ${note}`));
    }

    if (result.recommendations.length > 0 && !result.ok) {
      lines.push('', 'Pendencias:');
      result.recommendations.slice(0, 4).forEach((entry) => lines.push(`- ${entry}`));
    }

    return lines.join('\n');
  }

}
