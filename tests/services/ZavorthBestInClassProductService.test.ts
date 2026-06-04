import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_BEST_IN_CLASS_PRODUCT_CONTRACT_VERSION,
  ZavorthBestInClassProductService,
} from '../../src/services/ZavorthBestInClassProductService.js';

describe('ZavorthBestInClassProductService', () => {
  let referenceRoot: string;

  beforeEach(() => {
    referenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-best-reference-fixture-'));
    seedReferenceFixture(referenceRoot);
  });

  afterEach(() => {
    fs.rmSync(referenceRoot, { recursive: true, force: true });
  });

  it('certifies research autonomy, personal product surfaces and governance together', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthBestInClassProductService({
      projectRoot,
      referenceRoot,
      env: {
        XAI_API_KEY: 'xai-secret-that-must-not-appear',
      },
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_BEST_IN_CLASS_PRODUCT_CONTRACT_VERSION);
    expect(snapshot.generatedAt).toBe('2026-06-01T12:00:00.000Z');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      axes: 3,
      readyAxes: 3,
      blockedAxes: 0,
      attentionAxes: 0,
    }));
    expect(snapshot.axes.map((axis) => axis.id)).toEqual([
      'research-autonomy',
      'personal-product',
      'governance',
    ]);
    expect(snapshot.productGates).toEqual({
      tuiDaily: 'ready',
      zCanvasLive: 'ready',
      satelliteUsable: 'ready',
      wakeSetupReady: 'ready',
      cleanInstallReady: 'ready',
    });
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noSilentMutation: true,
      noRawSecretsSerialized: true,
      a2uiCannotTouchHost: true,
      wakeIsOptInTtlBound: true,
      satellitePairingUsesOpaqueCodes: true,
      cleanInstallDoesNotAutoMigrate: true,
    }));
    expect(JSON.stringify(snapshot)).not.toContain('xai-secret-that-must-not-appear');
  });

  it('renders a concise operator report with the product QA command', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthBestInClassProductService({
      projectRoot,
      referenceRoot,
      env: {},
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const report = service.renderText(await service.buildSnapshot());

    expect(report).toContain('Zavorth Best-in-Class Product');
    expect(report).toContain('research-autonomy');
    expect(report).toContain('personal-product');
    expect(report).toContain('z-canvas-live');
    expect(report).toContain('qa:zavorth-best-in-class-product');
  });
});

function seedReferenceFixture(root: string): void {
  for (const file of [
    'reference_cli/goals.py',
    'cli.py',
    'tests/reference_cli/test_goals.py',
    'reference_state.py',
    'tools/session_search_tool.py',
    'tests/tools/test_session_search.py',
    'reference_cli/kanban_db.py',
    'reference_cli/kanban.py',
    'tools/kanban_tools.py',
    'tools/mcp_tool.py',
    'reference_cli/mcp_catalog.py',
    'tools/skills_hub.py',
    'tools/x_search_tool.py',
    'tools/xai_http.py',
    'reference_cli/proxy/adapters/xai.py',
    'agent/google_oauth.py',
    'agent/skill_commands.py',
    'tools/skills_guard.py',
  ]) {
    const fullPath = path.join(root, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, '# reference fixture\n', 'utf8');
  }
  fs.mkdirSync(path.join(root, 'optional-skills'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tui_gateway'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ui-tui'), { recursive: true });
}
