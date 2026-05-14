import { BaseTool } from './BaseTool.js';

/**
 * DateTimeTool â€” Retorna a data e hora atuais do sistema.
 */
export class DateTimeTool extends BaseTool {
  readonly name = 'get_datetime';
  readonly description = 'Retorna a data e hora atuais do sistema local. Use quando o usuÃ¡rio perguntar que horas sÃ£o, que dia Ã© hoje, ou qualquer informaÃ§Ã£o temporal.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      timezone: {
        type: 'string',
        description: 'Fuso horÃ¡rio desejado (ex: America/Sao_Paulo). PadrÃ£o: fuso local do sistema.',
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
    } catch (error) {
      return JSON.stringify({ error: `Fuso horÃ¡rio invÃ¡lido: ${timezone}` });
    }
  }
}
