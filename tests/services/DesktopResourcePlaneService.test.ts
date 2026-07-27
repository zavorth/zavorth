import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DesktopResourcePlaneService } from '../../src/services/DesktopResourcePlaneService.js';

describe('DesktopResourcePlaneService', () => {
  it('collects, persists and renders a desktop resource snapshot', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-desktop-plane-'));
    const latestFilePath = path.join(tempDir, 'desktop-resource-latest.json');
    const historyFilePath = path.join(tempDir, 'desktop-resource-history.jsonl');
    const service = new DesktopResourcePlaneService({
      latestFilePath,
      historyFilePath,
      collector: {
        collect: jest.fn(async () => ({
          generatedAt: '2026-04-14T14:00:00.000Z',
          host: {
            hostname: 'WORKSTATION',
            platform: 'win32',
            totalVisibleMemoryMb: 8192,
            freePhysicalMemoryMb: 1024,
            totalPhysicalMemoryMb: 8192,
            memoryLoadPercent: 87,
          },
          processes: [
            {
              pid: 10,
              processName: 'node',
              executablePath: 'C:/Program Files/nodejs/node.exe',
              commandLine: 'node C:\\workspace\\Zavorth\\dist\\index.js',
              cpuSeconds: 14,
              workingSetMb: 220,
              pagedMemoryMb: 240,
              privateMemoryMb: 200,
              readTransferMb: 4,
              writeTransferMb: 3,
              mainWindowTitle: null,
              startTime: '2026-04-14T13:59:00.000Z',
              responding: true,
            },
            {
              pid: 20,
              processName: 'Docker Desktop',
              executablePath: 'C:/Program Files/Docker/Docker/Docker Desktop.exe',
              commandLine: 'Docker Desktop.exe',
              cpuSeconds: 8,
              workingSetMb: 320,
              pagedMemoryMb: 300,
              privateMemoryMb: 280,
              readTransferMb: 2,
              writeTransferMb: 1,
              mainWindowTitle: 'Docker Desktop',
              startTime: '2026-04-14T13:58:00.000Z',
              responding: true,
            },
          ],
          wsl: {
            ok: true,
            message: 'WSL active.',
            warnings: [],
            distros: [
              {
                name: 'Ubuntu-24.04',
                state: 'Running',
                version: '2',
                isDefault: true,
              },
            ],
          },
          docker: {
            detected: true,
            status: 'idle',
            runningContainerCount: 0,
            contextName: 'desktop-linux',
            warnings: [],
          },
        })),
      } as any,
    });

    const snapshot = await service.inspectLive();
    const report = service.renderReport(snapshot);

    expect(snapshot.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'zavorth',
          owner: 'zavorth',
        }),
        expect.objectContaining({
          id: 'docker-desktop',
          owner: 'companion',
        }),
      ]),
    );
    expect(snapshot.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'hibernate',
          controlId: 'docker-desktop',
        }),
      ]),
    );
    expect(report).toContain('Desktop Resource Plane');
    expect(report).toContain('Docker Desktop');
    expect(fs.existsSync(latestFilePath)).toBe(true);
    expect(fs.existsSync(historyFilePath)).toBe(true);
  });

  it('keeps host memory meaningful and surfaces restricted collection warnings', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-desktop-plane-restricted-'));
    const latestFilePath = path.join(tempDir, 'desktop-resource-latest.json');
    const historyFilePath = path.join(tempDir, 'desktop-resource-history.jsonl');
    const service = new DesktopResourcePlaneService({
      latestFilePath,
      historyFilePath,
      collector: {
        collect: jest.fn(async () => ({
          generatedAt: '2026-04-14T15:00:00.000Z',
          host: {
            hostname: 'WORKSTATION',
            platform: 'win32',
            totalVisibleMemoryMb: 8192,
            freePhysicalMemoryMb: 2048,
            totalPhysicalMemoryMb: 8192,
            memoryLoadPercent: 75,
          },
          processes: [],
          wsl: {
            ok: false,
            message: 'Failed to query WSL: spawn EPERM',
            warnings: [],
            distros: [],
          },
          docker: {
            detected: false,
            status: 'unavailable',
            runningContainerCount: null,
            contextName: null,
            warnings: ['spawn EPERM'],
          },
        })),
      } as any,
    });

    const snapshot = await service.inspectLive();

    expect(snapshot.host.totalVisibleMemoryMb).toBe(8192);
    expect(snapshot.host.usedPhysicalMemoryMb).toBe(6144);
    expect(snapshot.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('not conseguiu enumerar processos'),
      expect.stringContaining('WSL not pode ser consultado agora'),
      expect.stringContaining('Docker not pode ser consultado agora'),
    ]));
    expect(snapshot.recommendations).toEqual(expect.arrayContaining([
      expect.stringContaining('sem sandbox'),
      expect.stringContaining('diagnosticar WSL'),
      expect.stringContaining('diagnosticar Docker Desktop'),
    ]));
  });

  it('compacts older desktop resource history while keeping recent snapshots full', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-desktop-plane-history-'));
    const latestFilePath = path.join(tempDir, 'desktop-resource-latest.json');
    const historyFilePath = path.join(tempDir, 'desktop-resource-history.jsonl');
    let sample = 0;
    const service = new DesktopResourcePlaneService({
      latestFilePath,
      historyFilePath,
      collector: {
        collect: jest.fn(async () => {
          sample += 1;
          return {
            generatedAt: `2026-04-14T16:0${sample}:00.000Z`,
            host: {
              hostname: 'WORKSTATION',
              platform: 'win32',
              totalVisibleMemoryMb: 8192,
              freePhysicalMemoryMb: 2048,
              totalPhysicalMemoryMb: 8192,
              memoryLoadPercent: 75,
            },
            processes: Array.from({ length: 6 }, (_, index) => ({
              pid: 1000 + sample * 10 + index,
              processName: index === 0 ? 'node' : `worker-${index}`,
              executablePath: `C:/apps/worker-${index}.exe`,
              commandLine: `worker-${index} --sample=${sample} --payload=${'x'.repeat(120)}`,
              cpuSeconds: 10 + index,
              workingSetMb: 80 + index * 20,
              pagedMemoryMb: 70 + index * 10,
              privateMemoryMb: 60 + index * 8,
              readTransferMb: index,
              writeTransferMb: index,
              mainWindowTitle: null,
              startTime: '2026-04-14T15:59:00.000Z',
              responding: true,
            })),
            wsl: {
              ok: true,
              message: 'WSL active.',
              warnings: [],
              distros: [],
            },
            docker: {
              detected: false,
              status: 'stopped' as const,
              runningContainerCount: 0,
              contextName: null,
              warnings: [],
            },
          };
        }),
      } as any,
    });

    await service.inspectLive();
    await service.inspectLive();
    await service.inspectLive();

    const entries = fs.readFileSync(historyFilePath, 'utf8')
      .trim()
      .split(/\r-\n/)
      .map((line) => JSON.parse(line));

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual(expect.objectContaining({
      compacted: true,
      compactionVersion: 1,
    }));
    expect(entries[0].items).toBeUndefined();
    expect(entries[0].groups[0].itemIds).toBeUndefined();
    expect(entries[0].groups[0].sampleItemIds).toEqual(expect.any(Array));
    expect(entries[1].items).toEqual(expect.any(Array));
    expect(entries[2].items).toEqual(expect.any(Array));
  });
});
