import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromTest = createRequire(__filename);
const PLUGIN_INDEX = path.resolve(__dirname, '../../plugins/calendar/index.js');

function createMockCtx(workspace: string) {
  const capabilities = new Map<string, (args: any) => Promise<any>>();
  return {
    capabilities,
    ctx: {
      bindCapability(id: string, handler: (args: any) => Promise<any>) {
        capabilities.set(id, handler);
      },
      getLogger() {
        return { debug() {}, info() {}, warn() {}, error() {} };
      },
      getWorkspacePath() {
        return workspace;
      },
      async requestPermission() {
        return false;
      },
      emit() {},
    },
  };
}

describe('calendar behavior', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('create dry-run by default and list after approved create', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cal-'));
    tempRoots.push(root);
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = requireFromTest(PLUGIN_INDEX);
    const mock = createMockCtx(root);
    mod.register(mock.ctx);

    const status = await mock.capabilities.get('calendar.status')!({ input: {} });
    expect(status.output.ok).toBe(true);

    const dry = await mock.capabilities.get('calendar.create')!({
      input: {
        title: 'Standup',
        start: '2026-07-12T10:00:00Z',
        end: '2026-07-12T10:30:00Z',
      },
    });
    expect(dry.output.ok).toBe(true);
    expect(dry.output.dryRun).toBe(true);
    expect(dry.output.needsApproval).toBe(true);

    const emptyList = await mock.capabilities.get('calendar.list')!({ input: {} });
    expect(emptyList.output.ok).toBe(true);
    expect(emptyList.output.events).toEqual([]);

    const created = await mock.capabilities.get('calendar.create')!({
      input: {
        title: 'Standup',
        start: '2026-07-12T10:00:00Z',
        end: '2026-07-12T10:30:00Z',
        approved: true,
      },
    });
    expect(created.output.ok).toBe(true);
    expect(created.output.dryRun).toBe(false);
    expect(created.output.event.title).toBe('Standup');

    const listed = await mock.capabilities.get('calendar.list')!({ input: {} });
    expect(listed.output.events.length).toBe(1);
    expect(listed.output.events[0].title).toBe('Standup');

    const storePath = path.join(root, '.zavorth', 'calendar', 'events.json');
    expect(fs.existsSync(storePath)).toBe(true);
  });
});
