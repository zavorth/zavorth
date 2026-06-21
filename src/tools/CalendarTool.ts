import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';

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
    'Gerencia eventos de calendario.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'create', 'list', 'update', 'delete'.",
      },
      title: {
        type: 'string',
        description: 'Titulo do evento.',
      },
      start_time: {
        type: 'string',
        description: 'Data/hora de inicio (ISO 8601).',
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
        description: 'JSON array de emails dos participantes.',
      },
      reminder_minutes: {
        type: 'number',
        description: 'Minutos antes do evento para lembrete.',
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
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['create', 'list', 'update', 'delete'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
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
          return `Erro: acao "${action}" nao implementada.`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no calendario: ${message}`;
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
    if (!title) return 'Erro: "title" e obrigatorio para create.';

    const startTime = String(args.start_time || '');
    if (!startTime) return 'Erro: "start_time" e obrigatorio para create.';

    const endTime = String(args.end_time || '');
    if (!endTime) return 'Erro: "end_time" e obrigatorio para create.';

    if (isNaN(Date.parse(startTime))) return 'Erro: "start_time" invalido. Use formato ISO 8601.';
    if (isNaN(Date.parse(endTime))) return 'Erro: "end_time" invalido. Use formato ISO 8601.';

    if (new Date(endTime) <= new Date(startTime)) {
      return 'Erro: "end_time" deve ser posterior a "start_time".';
    }

    let attendees: string[] = [];
    if (typeof args.attendees === 'string') {
      try {
        attendees = JSON.parse(args.attendees);
      } catch {
        return 'Erro: JSON de attendees invalido.';
      }
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
    lines.push(`Evento criado com sucesso.`);
    lines.push(`  - UID: ${event.uid}`);
    lines.push(`  - Titulo: ${event.title}`);
    lines.push(`  - Inicio: ${event.start_time}`);
    lines.push(`  - Fim: ${event.end_time}`);
    if (event.location) lines.push(`  - Local: ${event.location}`);
    if (event.attendees.length > 0) lines.push(`  - Participantes: ${event.attendees.join(', ')}`);
    if (event.reminder_minutes !== null) lines.push(`  - Lembrete: ${event.reminder_minutes} minutos antes`);
    lines.push(`  - iCal: ${icalPath}`);

    return lines.join('\n');
  }

  private listEvents(args: Record<string, unknown>): string {
    const events = this.loadEvents();
    if (events.length === 0) return 'Nenhum evento no calendario.';

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
    if (!event) return `Erro: evento "${uid}" nao encontrado.`;

    if (typeof args.title === 'string' && args.title !== event.uid) event.title = args.title;
    if (typeof args.start_time === 'string') {
      if (isNaN(Date.parse(args.start_time))) return 'Erro: "start_time" invalido.';
      event.start_time = args.start_time;
    }
    if (typeof args.end_time === 'string') {
      if (isNaN(Date.parse(args.end_time))) return 'Erro: "end_time" invalido.';
      event.end_time = args.end_time;
    }
    if (typeof args.description === 'string') event.description = args.description;
    if (typeof args.location === 'string') event.location = args.location;
    if (typeof args.reminder_minutes === 'number') event.reminder_minutes = args.reminder_minutes;
    event.updated_at = new Date().toISOString();

    this.saveEvents(events);
    return `Evento "${event.uid}" atualizado com sucesso.`;
  }

  private deleteEvent(args: Record<string, unknown>): string {
    const uid = String(args.title || '');
    const events = this.loadEvents();
    const index = events.findIndex((e) => e.uid === uid || e.title === uid);

    if (index === -1) return `Erro: evento "${uid}" nao encontrado.`;

    const removed = events.splice(index, 1)[0];
    this.saveEvents(events);

    const icalPath = path.join(this.storageDir, `${removed.uid}.ics`);
    if (fs.existsSync(icalPath)) {
      fs.unlinkSync(icalPath);
    }

    return `Evento "${removed.uid}" (${removed.title}) removido com sucesso.`;
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
