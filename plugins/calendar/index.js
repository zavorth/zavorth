const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');

function register(ctx) {
  const logger = ctx.getLogger();
  const workspace = ctx.getWorkspacePath();
  const storePath = path.join(workspace, '.zavorth', 'calendar', 'events.json');

  function ensureStore() {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      fs.writeFileSync(storePath, `${JSON.stringify({ events: [] }, null, 2)}\n`, 'utf8');
    }
  }

  function readEvents() {
    try {
      ensureStore();
      const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      return Array.isArray(raw.events) ? raw.events : [];
    } catch {
      return [];
    }
  }

  function writeEvents(events) {
    ensureStore();
    fs.writeFileSync(storePath, `${JSON.stringify({ events }, null, 2)}\n`, 'utf8');
  }

  function softCalendarTool() {
    try {
      const req = createRequire(__filename);
      const candidates = [
        path.resolve(workspace, 'dist/tools/CalendarTool.js'),
        path.resolve(workspace, 'src/tools/CalendarTool.js'),
        path.resolve(__dirname, '../../dist/tools/CalendarTool.js'),
        path.resolve(__dirname, '../../src/tools/CalendarTool.js'),
      ];
      for (const candidate of candidates) {
        try {
          const mod = req(candidate);
          const Ctor = mod.CalendarTool || mod.default;
          if (typeof Ctor === 'function') {
            return new Ctor({
              storageDir: path.join(workspace, '.zavorth', 'calendar', 'tool-store'),
            });
          }
        } catch {
          /* next */
        }
      }
    } catch {
      /* soft-fail */
    }
    return null;
  }

  ctx.bindCapability('calendar.status', async () => {
    try {
      const events = readEvents();
      const tool = softCalendarTool();
      return {
        output: {
          ok: true,
          storePath,
          eventCount: events.length,
          calendarToolAvailable: Boolean(tool),
          message: tool
            ? 'CalendarTool available; local store also active.'
            : 'Using local file store under .zavorth/calendar/events.json.',
        },
      };
    } catch (error) {
      logger.warn('calendar.status failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('calendar.list', async ({ input }) => {
    try {
      const limit = Math.max(1, Math.min(200, Number((input && input.limit) || 50) || 50));
      const tool = softCalendarTool();
      if (tool && typeof tool.execute === 'function') {
        try {
          const raw = await tool.execute({ action: 'list' });
          return {
            output: {
              ok: true,
              backend: 'CalendarTool',
              result: raw,
              events: readEvents().slice(0, limit),
            },
          };
        } catch {
          /* fall through to local store */
        }
      }
      const events = readEvents().slice(0, limit);
      return {
        output: {
          ok: true,
          backend: 'local-file',
          events,
          count: events.length,
          storePath,
        },
      };
    } catch (error) {
      logger.warn('calendar.list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          events: [],
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  ctx.bindCapability('calendar.create', async ({ input }) => {
    try {
      const title = String((input && (input.title || input.name)) || '').trim();
      const start = String((input && (input.start || input.start_time || input.begin)) || '').trim();
      const end = String((input && (input.end || input.end_time || input.finish)) || '').trim();
      if (!title || !start) {
        return {
          output: {
            ok: false,
            reason: 'title and start are required',
          },
        };
      }

      let approved = input && input.approved === true;
      if (!approved && typeof ctx.requestPermission === 'function') {
        approved = await ctx.requestPermission(
          'filesystem.write',
          `Create calendar event: ${title}`,
        );
      }

      const event = {
        id: `evt-${randomUUID()}`,
        title,
        start,
        end: end || start,
        description: String((input && input.description) || ''),
        createdAt: new Date().toISOString(),
      };

      if (!approved) {
        return {
          output: {
            ok: true,
            dryRun: true,
            needsApproval: true,
            preview: event,
            message: 'Dry-run only. Pass approved=true to persist the event.',
          },
        };
      }

      const events = readEvents();
      events.push(event);
      writeEvents(events);

      const tool = softCalendarTool();
      if (tool && typeof tool.execute === 'function') {
        try {
          await tool.execute({
            action: 'create',
            title,
            start_time: start,
            end_time: end || start,
            description: event.description,
          });
        } catch {
          /* soft-fail tool mirror */
        }
      }

      return {
        output: {
          ok: true,
          dryRun: false,
          event,
          storePath,
        },
        artifacts: [storePath],
      };
    } catch (error) {
      logger.warn('calendar.create failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        output: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });
}

module.exports = { register };
