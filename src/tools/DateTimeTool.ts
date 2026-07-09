import { BaseTool } from './BaseTool.js';
import { logger } from '../logger.js';

/**
 * Returns the current system date and time.
 */
export class DateTimeTool extends BaseTool {
  readonly name = 'get_datetime';
  readonly description = 'Returns the current date and time from the local system. Use it when the user asks what time it is, what day it is, or any temporal information.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      timezone: {
        type: 'string',
        description: 'Desired time zone, for example America/Sao_Paulo. Defaults to the local system time zone.',
      },
    },
    required: [] as string[],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const timezone = (args.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const now = new Date();
      const formatted = now.toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      return JSON.stringify({
        datetime: formatted,
        iso: now.toISOString(),
        timezone,
      });
    } catch (error: unknown) {logger.warn('[Date Time] serialization failed', error);
    return JSON.stringify({ error: `Invalid time zone: ${timezone}` });
  }
  }
}
