import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_PRODUCT_EXCELLENCE_CONTRACT_VERSION,
  ZavorthProductExcellenceService,
} from '../../src/services/ZavorthProductExcellenceService.js';

describe('ZavorthProductExcellenceService', () => {
  let evidenceRoot: string;

  beforeEach(() => {
    evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-excellence-evidence-fixture-'));
    seedEvidenceFixture(evidenceRoot);
  });

  afterEach(() => {
    fs.rmSync(evidenceRoot, { recursive: true, force: true });
  });

  it('certifies research autonomy, personal product surfaces and governance together', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const service = new ZavorthProductExcellenceService({
      projectRoot,
      evidenceRoot,
      env: {
        XAI_API_KEY: 'xai-secret-that-must-not-appear',
      },
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(ZAVORTH_PRODUCT_EXCELLENCE_CONTRACT_VERSION);
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
    const service = new ZavorthProductExcellenceService({
      projectRoot,
      evidenceRoot,
      env: {},
      now: () => new Date('2026-06-01T12:00:00.000Z'),
    });

    const report = service.renderText(await service.buildSnapshot());

    expect(report).toContain('Zavorth Product Excellence');
    expect(report).toContain('research-autonomy');
    expect(report).toContain('personal-product');
    expect(report).toContain('z-canvas-live');
    expect(report).toContain('qa:zavorth-product-excellence');
  });

  it('uses the current satellite pairing command in product projections', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-product-excellence-commands-'));
    try {
      const snapshot = await new ZavorthProductExcellenceService({
        projectRoot: root,
        now: () => new Date('2026-06-02T12:00:00.000Z'),
      }).buildSnapshot();

      expect(snapshot.commands.satellite).toBe('zavorth satellite pairing');
      expect(JSON.stringify(snapshot)).not.toContain('zavorth apps --action pairing.qr');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function seedEvidenceFixture(root: string): void {
  for (const file of [
    'baseline_cli/goals.py',
    'cli.py',
    'tests/baseline_cli/test_goals.py',
    'tools/session_search_tool.py',
    'tests/tools/test_session_search.py',
    'baseline_cli/kanban_db.py',
    'baseline_cli/kanban.py',
    'tools/kanban_tools.py',
    'tools/mcp_tool.py',
    'baseline_cli/mcp_catalog.py',
    'tools/skills_hub.py',
    'tools/x_search_tool.py',
    'tools/xai_http.py',
    'baseline_cli/proxy/adapters/xai.py',
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
