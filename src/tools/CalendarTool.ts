
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface CalendarEvent {
  uid: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  location: string | null;
  attendees: string[];
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export class CalendarTool extends BaseTool {
  public readonly name = 'calendar_event';

  public readonly description =
    'Manage calendar events.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'create', 'list', 'update', 'delete'.",
      },
      title: {
        type: 'string',
        description: 'Event title.',
      },
      start_time: {
        type: 'string',
        description: 'Start date/time (ISO 8601).',
      },
      end_time: {
        type: 'string',
        description: 'Data/hora de fim (ISO 8601).',
      },
      description: {
        type: 'string',
        description: 'Descricao do evento.',
      },
      location: {
        type: 'string',
        description: 'Local do evento.',
      },
      attendees: {
        type: 'string',
        description: 'JSON array of participant emails.',
      },
      reminder_minutes: {
        type: 'number',
        description: 'Reminder minutes before the event.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'calendar');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const validActions = ['create', 'list', 'update', 'delete'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'create':
          return this.createEvent(args);
        case 'list':
          return this.listEvents(args);
        case 'update':
          return this.updateEvent(args);
        case 'delete':
          return this.deleteEvent(args);
        default:
          return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Calendar] delete operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Calendar error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private eventsPath(): string {
    return path.join(this.storageDir, 'events.json');
  }

  private loadEvents(): CalendarEvent[] {
    const filePath = this.eventsPath();
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CalendarEvent[];
  }

  private saveEvents(events: CalendarEvent[]): void {
    fs.writeFileSync(this.eventsPath(), JSON.stringify(events, null, 2), 'utf-8');
  }

  private createEvent(args: Record<string, unknown>): string {
    const title = String(args.title || '');
    if (!title) return 'Error: "title" is required for create.';

    const startTime = String(args.start_time || '');
    if (!startTime) return 'Error: "start_time" is required for create.';

    const endTime = String(args.end_time || '');
    if (!endTime) return 'Error: "end_time" is required for create.';

    if (isNaN(Date.parse(startTime))) return 'Error: "start_time" is invalid. Use formato ISO 8601.';
    if (isNaN(Date.parse(endTime))) return 'Error: "end_time" is invalid. Use formato ISO 8601.';

    if (new Date(endTime) <= new Date(startTime)) {
      return 'Error: "end_time" must be after "start_time".';
    }

    let attendees: string[] = [];
    if (typeof args.attendees === 'string') {
      try {
        attendees = JSON.parse(args.attendees);
      } catch (error: unknown) {logger.warn('[Calendar] JSON parse failed', error); return 'Error: JSON de attendees is invalid.'; }
    }

    const event: CalendarEvent = {
      uid: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      start_time: startTime,
      end_time: endTime,
      description: String(args.description || ''),
      location: typeof args.location === 'string' ? args.location : null,
      attendees,
      reminder_minutes: typeof args.reminder_minutes === 'number' ? args.reminder_minutes : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const events = this.loadEvents();
    events.push(event);
    this.saveEvents(events);

    const ical = this.toICal(event);
    const icalPath = path.join(this.storageDir, `${event.uid}.ics`);
    fs.writeFileSync(icalPath, ical, 'utf-8');

    const lines: string[] = [];
    lines.push(`Event created successfully.`);
    lines.push(`  - UID: ${event.uid}`);
        lines.push(`  - Title: ${event.title}`);
    lines.push(`  - Inicio: ${event.start_time}`);
    lines.push(`  - Fim: ${event.end_time}`);
    if (event.location) lines.push(`  - Local: ${event.location}`);
    if (event.attendees.length > 0) lines.push(` ? Participantes: ${event.attendees.join(', ')}`);
    if (event.reminder_minutes !== null) lines.push(` ? Lembrete: ${event.reminder_minutes} minutos before`);
    lines.push(`  - iCal: ${icalPath}`);

    return lines.join('\n');
  }

  private listEvents(_args: Record<string, unknown>): string {
    const events = this.loadEvents();
    if (events.length === 0) return 'No events on the calendar.';

    const sorted = [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const lines: string[] = [`Calendario: ${sorted.length} evento(s)`];
    for (const event of sorted) {
      lines.push(`  - ${event.uid}: ${event.title}`);
      lines.push(`    ${event.start_time} - ${event.end_time}`);
      if (event.location) lines.push(`    Local: ${event.location}`);
    }

    return lines.join('\n');
  }

  private updateEvent(args: Record<string, unknown>): string {
    const uid = String(args.title || '');
    const events = this.loadEvents();

    const event = events.find((e) => e.uid === uid || e.title === uid);
    if (!event) return `Error: event "${uid}" not found.`;

    if (typeof args.title === 'string' && args.title !== event.uid) event.title = args.title;
    if (typeof args.start_time === 'string') {
      if (isNaN(Date.parse(args.start_time))) return 'Error: "start_time" is invalid.';
      event.start_time = args.start_time;
    }
    if (typeof args.end_time === 'string') {
      if (isNaN(Date.parse(args.end_time))) return 'Error: "end_time" is invalid.';
      event.end_time = args.end_time;
    }
    if (typeof args.description === 'string') event.description = args.description;
    if (typeof args.location === 'string') event.location = args.location;
    if (typeof args.reminder_minutes === 'number') event.reminder_minutes = args.reminder_minutes;
    event.updated_at = new Date().toISOString();

    this.saveEvents(events);
    return `Evento "${event.uid}" updated successfully.`;
  }

  private deleteEvent(args: Record<string, unknown>): string {
    const uid = String(args.title || '');
    const events = this.loadEvents();
    const index = events.findIndex((e) => e.uid === uid || e.title === uid);

    if (index === -1) return `Error: event "${uid}" not found.`;

    const removed = events.splice(index, 1)[0];
    this.saveEvents(events);

    const icalPath = path.join(this.storageDir, `${removed.uid}.ics`);
    if (fs.existsSync(icalPath)) {
      fs.unlinkSync(icalPath);
    }

    return `Evento "${removed.uid}" (${removed.title}) removed successfully.`;
  }

  private toICal(event: CalendarEvent): string {
    const formatDT = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zavorth//CalendarTool//EN',
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTART:${formatDT(event.start_time)}`,
      `DTEND:${formatDT(event.end_time)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
    ];

    if (event.location) lines.push(`LOCATION:${event.location}`);
    for (const attendee of event.attendees) {
      lines.push(`ATTENDEE:mailto:${attendee}`);
    }
    if (event.reminder_minutes !== null) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`TRIGGER:-PT${event.reminder_minutes}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
  }
}
