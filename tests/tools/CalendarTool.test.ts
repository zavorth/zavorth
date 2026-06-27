
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CalendarTool } from '../../src/tools/CalendarTool';

describe('CalendarTool', () => {
  let tool: CalendarTool;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-test-'));
    tool = new CalendarTool({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('calendar_event');
  });

  it('returns error when action is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'invalid' });
    expect(result).toContain('Erro');
    expect(result).toContain('invalida');
  });

  it('creates an event', async () => {
    const result = await tool.execute({
      action: 'create',
      title: 'Team Meeting',
      start_time: '2026-06-20T10:00:00Z',
      end_time: '2026-06-20T11:00:00Z',
      description: 'Weekly sync',
      location: 'Room 101',
      attendees: '["alice@example.com", "bob@example.com"]',
      reminder_minutes: 15,
    });

    expect(result).toContain('Evento criado com sucesso');
    expect(result).toContain('Team Meeting');
    expect(result).toContain('Room 101');
    expect(result).toContain('alice@example.com');
    expect(result).toContain('15 minutos');
  });

  it('returns error when title is missing for create', async () => {
    const result = await tool.execute({
      action: 'create',
      start_time: '2026-06-20T10:00:00Z',
      end_time: '2026-06-20T11:00:00Z',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('title');
  });

  it('returns error when start_time is missing for create', async () => {
    const result = await tool.execute({
      action: 'create',
      title: 'Event',
      end_time: '2026-06-20T11:00:00Z',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('start_time');
  });

  it('returns error for invalid start_time format', async () => {
    const result = await tool.execute({
      action: 'create',
      title: 'Event',
      start_time: 'not-a-date',
      end_time: '2026-06-20T11:00:00Z',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('start_time');
  });

  it('returns error when end_time is before start_time', async () => {
    const result = await tool.execute({
      action: 'create',
      title: 'Event',
      start_time: '2026-06-20T11:00:00Z',
      end_time: '2026-06-20T10:00:00Z',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('end_time');
  });

  it('lists events', async () => {
    await tool.execute({
      action: 'create',
      title: 'Event A',
      start_time: '2026-06-20T10:00:00Z',
      end_time: '2026-06-20T11:00:00Z',
    });
    await tool.execute({
      action: 'create',
      title: 'Event B',
      start_time: '2026-06-21T10:00:00Z',
      end_time: '2026-06-21T11:00:00Z',
    });

    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('2 evento(s)');
    expect(result).toContain('Event A');
    expect(result).toContain('Event B');
  });

  it('returns message when listing empty calendar', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('Nenhum evento');
  });

  it('creates an iCal file', async () => {
    await tool.execute({
      action: 'create',
      title: 'iCal Test',
      start_time: '2026-06-20T10:00:00Z',
      end_time: '2026-06-20T11:00:00Z',
    });

    const files = fs.readdirSync(tempDir);
    const icsFile = files.find((f) => f.endsWith('.ics'));
    expect(icsFile).toBeDefined();

    const icalContent = fs.readFileSync(path.join(tempDir, icsFile!), 'utf-8');
    expect(icalContent).toContain('BEGIN:VCALENDAR');
    expect(icalContent).toContain('SUMMARY:iCal Test');
    expect(icalContent).toContain('END:VCALENDAR');
  });

  it('deletes an event', async () => {
    await tool.execute({
      action: 'create',
      title: 'To Delete',
      start_time: '2026-06-20T10:00:00Z',
      end_time: '2026-06-20T11:00:00Z',
    });

    const result = await tool.execute({ action: 'delete', title: 'To Delete' });
    expect(result).toContain('removido com sucesso');
  });

  it('returns error when deleting non-existent event', async () => {
    const result = await tool.execute({ action: 'delete', title: 'NonExistent' });
    expect(result).toContain('Erro');
    expect(result).toContain('nao encontrado');
  });
});
