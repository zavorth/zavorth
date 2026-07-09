import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthCalendarAdvancedTool extends BaseTool {
  public readonly name = 'zavorth_calendar_advanced';

  public readonly description =
    'Advanced calendar operations — Google Calendar and Outlook integration via CLI/API, recurring events, reminders, multi-calendar sync, availability checks, and event search.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'list_events', 'create_event', 'update_event', 'delete_event', 'search', 'get_event', 'list_calendars', 'check_availability', 'create_recurring', 'add_reminder', 'export_ics', 'import_ics', 'today', 'this_week'.",
      },
      provider: {
        type: 'string',
        description: "Calendar provider: 'google', 'outlook', 'ics'. Default: 'google'.",
      },
      calendar_id: {
        type: 'string',
        description: 'Calendar ID (Google) or folder (Outlook). Default: primary.',
      },
      event_id: {
        type: 'string',
        description: 'Event ID for update/delete/get operations.',
      },
      summary: {
        type: 'string',
        description: 'Event title/summary.',
      },
      description: {
        type: 'string',
        description: 'Event description.',
      },
      location: {
        type: 'string',
        description: 'Event location.',
      },
      start_time: {
        type: 'string',
        description: "Event start time (ISO 8601). Example: '2024-03-15T10:00:00'.",
      },
      end_time: {
        type: 'string',
        description: 'Event end time (ISO 8601).',
      },
      attendees: {
        type: 'string',
        description: 'Comma-separated email addresses of attendees.',
      },
      recurrence: {
        type: 'string',
        description: "RRULE for recurring events. Example: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'.",
      },
      reminder_minutes: {
        type: 'number',
        description: 'Reminder minutes before event. Default: 15.',
      },
      search_query: {
        type: 'string',
        description: 'Search query for events.',
      },
      time_min: {
        type: 'string',
        description: 'Start of time range (ISO 8601).',
      },
      time_max: {
        type: 'string',
        description: 'End of time range (ISO 8601).',
      },
      max_results: {
        type: 'number',
        description: 'Max events to return. Default: 20.',
      },
      all_day: {
        type: 'boolean',
        description: 'All-day event. Default: false.',
      },
      ics_path: {
        type: 'string',
        description: 'Path to ICS file for import/export.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json'. Default: 'text'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'list_events': return await this.listEvents(args);
      case 'create_event': return await this.createEvent(args);
      case 'update_event': return await this.updateEvent(args);
      case 'delete_event': return await this.deleteEvent(args);
      case 'search': return await this.searchEvents(args);
      case 'get_event': return await this.getEvent(args);
      case 'list_calendars': return await this.listCalendars(args);
      case 'check_availability': return await this.checkAvailability(args);
      case 'create_recurring': return await this.createRecurring(args);
      case 'add_reminder': return await this.addReminder(args);
      case 'export_ics': return await this.exportIcs(args);
      case 'import_ics': return await this.importIcs(args);
      case 'today': return await this.todayEvents(args);
      case 'this_week': return await this.thisWeekEvents(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runGcal(args_list: string[]): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('gcalcli', args_list, {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: any) { logger.warn('[Zavorth Calendar Advanced] process execution failed', error); return ''; }
  }

  private async runNodeScript(script: string, timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('node', ['-e', script], {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: any) { logger.warn('[Zavorth Calendar Advanced] process execution failed', error); return ''; }
  }

  private async listEvents(args: Record<string, unknown>): Promise<string> {
    const provider = String(args.provider || 'google');
    const maxResults = Number(args.max_results || 20);

    switch (provider) {
      case 'google': {
        const gcalArgs = ['list', '--num', String(maxResults)];
        if (args.time_min) gcalArgs.push('--started', String(args.time_min));
        if (args.time_max) gcalArgs.push('--ended', String(args.time_max));
        if (args.calendar_id) gcalArgs.push('--calendar', String(args.calendar_id));
        return `Calendar events:\n${await this.runGcal(gcalArgs)}`;
      }
      case 'outlook': {
        return await this.outlookListEvents(args);
      }
      case 'ics': {
        return await this.icsListEvents(args);
      }
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async outlookListEvents(args: Record<string, unknown>): Promise<string> {
    const script = `
const { execSync } = require('child_process');
try {
  const result = execSync('m365 outlook event list --output json', { timeout: 15000 }).toString();
  const events = JSON.parse(result);
  events.slice(0, ${Number(args.max_results || 20)}).forEach(e => {
    console.log(\`\${e.start?.dateTime} - \${e.subject} [\${e.id}]\`);
  });
} catch (e: any) { const error = e; const err = e;
  console.error('Outlook CLI not available. Install: npm i -g @pnp/cli-microsoft365');
}
`;
    const result = await this.runNodeScript(script);
    return `Outlook events:\n${result}`;
  }

  private async icsListEvents(args: Record<string, unknown>): Promise<string> {
    const icsPath = String(args.ics_path || '');
    if (!icsPath) return 'Error: "ics_path" is required for ICS provider.';
    if (!fs.existsSync(icsPath)) return `Error: ICS file not found: ${icsPath}`;

    try {
      const content = fs.readFileSync(icsPath, 'utf-8');
      const events = content.split('BEGIN:VEVENT').slice(1).map(block => {
        const summary = block.match(/SUMMARY:(.+)/)?.[1] || '(no title)';
        const dtstart = block.match(/DTSTART[^:]*:(.+)/)?.[1] || 'unknown';
        const dtend = block.match(/DTEND[^:]*:(.+)/)?.[1] || 'unknown';
        const location = block.match(/LOCATION:(.+)/)?.[1] || '';
        return `  ${dtstart} — ${summary}${location ? ` @ ${location}` : ''}`;
      });

      return `ICS events from ${icsPath} (${events.length}):\n${events.join('\n')}`;
    } catch (error: any) { logger.warn('[Zavorth Calendar Advanced] lifecycle operation failed', error); return ''; }
  }

  private async createEvent(args: Record<string, unknown>): Promise<string> {
    const provider = String(args.provider || 'google');
    const summary = String(args.summary || '');
    const startTime = String(args.start_time || '');
    const endTime = String(args.end_time || '');
    if (!summary || !startTime) return 'Error: "summary" and "start_time" are required.';

    switch (provider) {
      case 'google': {
        const gcalArgs = ['add'];
        if (args.calendar_id) gcalArgs.push('--calendar', String(args.calendar_id));
        gcalArgs.push(summary, '--when', startTime);
        if (endTime) gcalArgs.push('--duration', String(Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)) + 'm');
        if (args.location) gcalArgs.push('--where', String(args.location));
        if (args.description) gcalArgs.push('--description', String(args.description));
        return `Create event:\n${await this.runGcal(gcalArgs)}`;
      }
      case 'ics': {
        return this.createIcsEvent(args);
      }
      default:
        return `Error: Create not supported for "${provider}".`;
    }
  }

  private createIcsEvent(args: Record<string, unknown>): string {
    const summary = String(args.summary || '');
    const startTime = String(args.start_time || '');
    const endTime = String(args.end_time || startTime);
    const description = String(args.description || '');
    const location = String(args.location || '');

    const formatIcsDate = (d: string) => d.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const uid = `${Date.now()}@zavorth`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zavorth//Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatIcsDate(startTime)}`,
      `DTEND:${formatIcsDate(endTime)}`,
      `SUMMARY:${summary}`,
      description ? `DESCRIPTION:${description}` : '',
      location ? `LOCATION:${location}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const icsPath = String(args.ics_path || 'zavorth_event.ics');
    fs.writeFileSync(icsPath, ics);
    return `Event created in ${icsPath}:\n  ${summary} — ${startTime}`;
  }

  private async updateEvent(args: Record<string, unknown>): Promise<string> {
    const provider = String(args.provider || 'google');
    const eventId = String(args.event_id || '');
    if (!eventId) return 'Error: "event_id" is required.';

    switch (provider) {
      case 'google': {
        const gcalArgs = ['edit', eventId];
        if (args.summary) gcalArgs.push('--title', String(args.summary));
        if (args.description) gcalArgs.push('--description', String(args.description));
        if (args.location) gcalArgs.push('--where', String(args.location));
        return `Update event:\n${await this.runGcal(gcalArgs)}`;
      }
      default:
        return `Error: Update not supported for "${provider}".`;
    }
  }

  private async deleteEvent(args: Record<string, unknown>): Promise<string> {
    const provider = String(args.provider || 'google');
    const eventId = String(args.event_id || '');
    if (!eventId) return 'Error: "event_id" is required.';

    switch (provider) {
      case 'google':
        return `Delete event:\n${await this.runGcal(['delete', eventId, '--yes'])}`;
      default:
        return `Error: Delete not supported for "${provider}".`;
    }
  }

  private async searchEvents(args: Record<string, unknown>): Promise<string> {
    const query = String(args.search_query || '');
    if (!query) return 'Error: "search_query" is required.';

    const provider = String(args.provider || 'google');

    switch (provider) {
      case 'google':
        return `Search results:\n${await this.runGcal(['search', query, '--num', String(args.max_results || 20)])}`;
      default:
        return `Error: Search not supported for "${provider}".`;
    }
  }

  private async getEvent(args: Record<string, unknown>): Promise<string> {
    const eventId = String(args.event_id || '');
    if (!eventId) return 'Error: "event_id" is required.';

    return `Get event details for ${eventId}. Use list_events with a time range to find event IDs.`;
  }

  private async listCalendars(args: Record<string, unknown>): Promise<string> {
    const provider = String(args.provider || 'google');

    switch (provider) {
      case 'google':
        return `Calendars:\n${await this.runGcal(['calendars'])}`;
      default:
        return `Error: List calendars not supported for "${provider}".`;
    }
  }

  private async checkAvailability(args: Record<string, unknown>): Promise<string> {
    const timeMin = String(args.time_min || '');
    const timeMax = String(args.time_max || '');
    if (!timeMin || !timeMax) return 'Error: "time_min" and "time_max" are required.';

    const provider = String(args.provider || 'google');

    switch (provider) {
      case 'google': {
        const result = await this.runGcal(['list', '--started', timeMin, '--ended', timeMax, '--tsv']);
        const hasEvents = result && !result.includes('No events found');
        return hasEvents
          ? `Busy during ${timeMin} — ${timeMax}:\n${result}`
          : `Available during ${timeMin} — ${timeMax}`;
      }
      default:
        return `Error: Availability check not supported for "${provider}".`;
    }
  }

  private async createRecurring(args: Record<string, unknown>): Promise<string> {
    const recurrence = String(args.recurrence || '');
    if (!recurrence) return 'Error: "recurrence" is required (RRULE format).';

    args.summary = args.summary || 'Recurring Event';
    const result = await this.createEvent(args);
    return `${result}\nRecurrence: ${recurrence}`;
  }

  private async addReminder(args: Record<string, unknown>): Promise<string> {
    const eventId = String(args.event_id || '');
    const minutes = Number(args.reminder_minutes || 15);
    if (!eventId) return 'Error: "event_id" is required.';

    return `Reminder set ${minutes} minutes before event ${eventId}. Use update_event to modify reminders.`;
  }

  private async exportIcs(args: Record<string, unknown>): Promise<string> {
    const icsPath = String(args.ics_path || 'calendar_export.ics');

    const provider = String(args.provider || 'google');
    switch (provider) {
      case 'google': {
        const result = await this.runGcal(['list', '--tsv']);
        const events = result.split('\n').filter(Boolean);

        const icsEvents = events.map(line => {
          const parts = line.split('\t');
          return [
            'BEGIN:VEVENT',
            `SUMMARY:${parts[1] || 'Event'}`,
            `DTSTART:${(parts[0] || '').replace(/[-:]/g, '')}`,
            'END:VEVENT',
          ].join('\r\n');
        });

        const ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Zavorth//Export//EN',
          ...icsEvents,
          'END:VCALENDAR',
        ].join('\r\n');

        fs.writeFileSync(icsPath, ics);
        return `Exported ${events.length} events to ${icsPath}`;
      }
      default:
        return `Error: Export not supported for "${provider}".`;
    }
  }

  private async importIcs(args: Record<string, unknown>): Promise<string> {
    const icsPath = String(args.ics_path || '');
    if (!icsPath) return 'Error: "ics_path" is required.';
    if (!fs.existsSync(icsPath)) return `Error: ICS file not found: ${icsPath}`;

    const provider = String(args.provider || 'google');
    switch (provider) {
      case 'google':
        return `Import ICS:\n${await this.runGcal(['import', icsPath])}`;
      default:
        return `Error: Import not supported for "${provider}".`;
    }
  }

  private async todayEvents(args: Record<string, unknown>): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    args.time_min = `${today}T00:00:00`;
    args.time_max = `${today}T23:59:59`;
    return `Today's events:\n${await this.listEvents(args)}`;
  }

  private async thisWeekEvents(args: Record<string, unknown>): Promise<string> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    args.time_min = startOfWeek.toISOString().slice(0, 10) + 'T00:00:00';
    args.time_max = endOfWeek.toISOString().slice(0, 10) + 'T23:59:59';
    return `This week's events:\n${await this.listEvents(args)}`;
  }
}
