/**
 * Job Delivery Dispatcher.
 * Dispatches scheduled job results (success reports, failure alerts) across configured channels.
 */

import { logger } from '../logger.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { UrlSafetyService } from '../security/UrlSafetyService.js';
import { TerminalAudioNotifier } from '../cli/presentation/TerminalAudioNotifier.js';
import type { JobRunRecord, JobDeliveryTarget } from './types.js';

export class JobDeliveryDispatcher {
  /**
   * Dispatches a job execution summary to all configured delivery targets.
   */
  static async dispatch(run: JobRunRecord, targets: JobDeliveryTarget[]): Promise<boolean> {
    if (!targets || targets.length === 0) {
      return true; // No delivery required
    }

    let allSuccessful = true;
    for (const target of targets) {
      try {
        switch (target.channel) {
          case 'desktop':
            this.deliverDesktop(run);
            break;

          case 'webhook':
            if (target.webhookUrl) {
              const ok = await this.deliverWebhook(run, target.webhookUrl);
              if (!ok) allSuccessful = false;
            }
            break;

          case 'cli':
          default:
            this.deliverCli(run);
            break;
        }
      } catch (err: unknown) {
        allSuccessful = false;
        logger.error(`[Delivery] Failed delivery to ${target.channel}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return allSuccessful;
  }

  private static deliverDesktop(run: JobRunRecord): void {
    if (run.status === 'success') {
      TerminalAudioNotifier.playCompletionChime();
      logger.info(`[Desktop Delivery] Job "${run.jobName}" completed successfully in ${run.durationMs}ms.`);
    } else {
      logger.warn(`[Desktop Delivery] Job "${run.jobName}" failed: ${run.error}`);
    }
  }

  private static deliverCli(run: JobRunRecord): void {
    const icon = run.status === 'success' ? '✅' : '❌';
    logger.info(`[CLI Delivery] ${icon} Scheduled Job "${run.jobName}" status: ${run.status} (${run.durationMs}ms)`);
  }

  private static async deliverWebhook(run: JobRunRecord, url: string): Promise<boolean> {
    const urlSafety = new UrlSafetyService();
    const securityCheck = await urlSafety.checkUrl(url);
    if (!securityCheck.safe) {
      logger.warn(`[Webhook Delivery] Blocked by security policy: ${securityCheck.reason}`);
      return false;
    }

    try {
      const response = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'job.completed',
          timestamp: new Date().toISOString(),
          run,
        }),
      }, { serviceName: 'SchedulerWebhook' });

      return response.ok;
    } catch (err: unknown) {
      logger.error(`[Webhook Delivery] HTTP error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
