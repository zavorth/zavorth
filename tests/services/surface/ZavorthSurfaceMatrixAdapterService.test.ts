import { ZavorthSurfaceMatrixAdapterService } from '../../../src/services/surface/ZavorthSurfaceMatrixAdapterService';
import { ZavorthKanbanBoardService } from '../../../src/services/kanban/ZavorthKanbanBoardService';
import { ZavorthDiagramRendererService } from '../../../src/services/diagram/ZavorthDiagramRendererService';

describe('ZavorthSurfaceMatrixAdapterService', () => {
  let adapter: ZavorthSurfaceMatrixAdapterService;
  let kanbanService: ZavorthKanbanBoardService;
  let diagramService: ZavorthDiagramRendererService;

  beforeEach(() => {
    adapter = new ZavorthSurfaceMatrixAdapterService();
    kanbanService = new ZavorthKanbanBoardService();
    diagramService = new ZavorthDiagramRendererService();
  });

  it('should project Kanban board state into CLI, Web DTO, and Chat Markdown formats', () => {
    kanbanService.createTask({ title: 'Build Microservice', priority: 'URGENT' });
    const state = kanbanService.getBoardState();

    // 1. Web Dashboard projection
    const webProj = adapter.projectKanbanBoard(state, 'WEB_DASHBOARD');
    expect(webProj.format).toBe('STRUCTURED_JSON');
    expect((webProj.contentPayload as any).totalTasks).toBe(1);

    // 2. Chat Gateway projection
    const chatProj = adapter.projectKanbanBoard(state, 'DISCORD_GATEWAY');
    expect(chatProj.format).toBe('MARKDOWN');
    expect(chatProj.contentText).toContain('Zavorth Swarm Kanban Matrix');
    expect(chatProj.contentText).toContain('Build Microservice');

    // 3. CLI Terminal projection
    const cliProj = adapter.projectKanbanBoard(state, 'CLI_TERMINAL');
    expect(cliProj.format).toBe('ANSI_TEXT');
    expect(cliProj.contentText).toContain('Zavorth Swarm Matrix');
  });

  it('should project Diagrams and Power Status across all surface targets', () => {
    const diag = diagramService.renderAscii({
      nodes: [{ id: 'A', label: 'Node A' }, { id: 'B', label: 'Node B' }],
      edges: [{ source: 'A', target: 'B' }],
    });

    const webDiag = adapter.projectDiagram(diag, 'WEB_DASHBOARD');
    expect(webDiag.format).toBe('STRUCTURED_JSON');
    expect((webDiag.contentPayload as any).boxes.length).toBe(2);

    const chatDiag = adapter.projectDiagram(diag, 'TELEGRAM_GATEWAY');
    expect(chatDiag.format).toBe('MARKDOWN');
    expect(chatDiag.contentText).toContain('Node A');

    const powerProj = adapter.projectPowerAndTelemetry(
      { powerSource: 'AC_POWER', batteryPercent: 100, isCharging: true, isLowBattery: false },
      { maxConcurrentSubagents: 8, isThrottled: false, recommendedDelayMs: 0 },
      'DISCORD_GATEWAY'
    );
    expect(powerProj.contentText).toContain('AC Power');
  });
});
