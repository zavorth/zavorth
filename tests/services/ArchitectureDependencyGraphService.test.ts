import fs from 'fs';
import os from 'os';
import path from 'path';
import { ArchitectureDependencyGraphService } from '../../src/observability/ArchitectureDependencyGraphService.js';

describe('ArchitectureDependencyGraphService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('reports cross-domain violations, fan-in/fan-out and migration status', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-arch-graph-'));
    tempDirs.push(root);
    const srcRoot = path.join(root, 'src');
    fs.mkdirSync(path.join(srcRoot, 'domain', 'execution', 'application'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'execution', 'domain'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'execution', 'infrastructure'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'execution', 'presentation'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'sessions', 'application'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'sessions', 'domain'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'sessions', 'infrastructure'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'domain', 'sessions', 'presentation'), { recursive: true });
    fs.mkdirSync(path.join(srcRoot, 'services'), { recursive: true });

    fs.writeFileSync(path.join(srcRoot, 'domain', 'execution', 'ExecutionFacade.ts'), 'export class ExecutionFacade {}\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'execution', 'application', 'ExecutionUseCases.ts'), "import { SessionsFacade } from '../../sessions/SessionsFacade.js';\nexport const value = SessionsFacade;\n");
    fs.writeFileSync(path.join(srcRoot, 'domain', 'execution', 'domain', 'ExecutionDomainTypes.ts'), 'export type ExecutionType = { ok: boolean };\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'execution', 'infrastructure', 'ExecutionAdapter.ts'), 'export class ExecutionAdapter {}\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'execution', 'presentation', 'ExecutionPresenter.ts'), 'export class ExecutionPresenter {}\n');

    fs.writeFileSync(path.join(srcRoot, 'domain', 'sessions', 'SessionsFacade.ts'), 'export class SessionsFacade {}\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'sessions', 'application', 'SessionPlaneUseCases.ts'), 'export const sessionUseCase = true;\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'sessions', 'domain', 'SessionDomainTypes.ts'), 'export type SessionType = { id: string };\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'sessions', 'infrastructure', 'SessionAdapter.ts'), 'export class SessionAdapter {}\n');
    fs.writeFileSync(path.join(srcRoot, 'domain', 'sessions', 'presentation', 'SessionPresenter.ts'), 'export class SessionPresenter {}\n');

    fs.writeFileSync(
      path.join(srcRoot, 'services', 'ConsumerService.ts'),
      "import { ExecutionFacade } from '../domain/execution/ExecutionFacade.js';\nexport const facade = new ExecutionFacade();\n",
    );

    const snapshot = new ArchitectureDependencyGraphService({
      now: () => new Date('2026-04-18T03:00:00.000Z'),
      workspaceRoot: root,
      srcRoot,
    }).buildSnapshot();

    expect(snapshot.summary.crossDomainViolations).toBe(1);
    expect(snapshot.violations[0]?.importerDomain).toBe('execution');
    expect(snapshot.violations[0]?.targetDomain).toBe('sessions');
    expect(snapshot.moduleHotspots.some((entry) => entry.id === 'domain/execution')).toBe(true);
    expect(snapshot.entrypointHotspots.some((entry) => entry.path === 'services/ConsumerService.ts')).toBe(true);
    expect(snapshot.domainMigration.find((entry) => entry.id === 'execution')?.stage).toBe('adopted');
    expect(snapshot.domainMigration.find((entry) => entry.id === 'execution')?.serviceConsumers).toBe(1);
  });
});
