import fs from 'fs';
import os from 'os';
import path from 'path';
import { TrajectoryResearchService } from '../../src/services/plugins/TrajectoryResearchService';

describe('TrajectoryResearchService', () => {
  let service: TrajectoryResearchService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-test-'));
    service = new TrajectoryResearchService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a trajectory', () => {
    const result = service.createTrajectory({
      session_id: 'session1',
      task: 'Research TypeScript performance',
      method: 'Benchmark comparison',
    });
    expect(result).toContain('created');
    expect(result).toContain('res_');
  });

  it('adds steps to trajectory', () => {
    service.createTrajectory({ session_id: 's1', task: 'Test', method: 'Manual' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.addStep(id, {
      action: 'Run benchmark',
      tool_used: 'sandbox_execution',
      result_summary: 'Benchmark completed',
      duration_ms: 1500,
      success: true,
    });
    expect(result).toContain('Passo 1');
  });

  it('adds evidence', () => {
    service.createTrajectory({ session_id: 's1', task: 'Test', method: 'Manual' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.addEvidence(id, 'Performance improved by 50%');
    expect(result).toContain('1');
  });

  it('adds citations', () => {
    service.createTrajectory({ session_id: 's1', task: 'Test', method: 'Manual' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.addCitation(id, {
      source: 'https://example.com',
      title: 'TypeScript Performance',
      relevance: 0.9,
    });
    expect(result).toContain('1');
  });

  it('concludes a trajectory', () => {
    service.createTrajectory({ session_id: 's1', task: 'Test', method: 'Manual' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.concludeTrajectory(id, 'TypeScript is fast', 'confirmed');
    expect(result).toContain('concluida');
    expect(result).toContain('confirmed');
  });

  it('gets trajectory details', () => {
    service.createTrajectory({ session_id: 's1', task: 'Detailed Test', method: 'Automated' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.getTrajectory(id);
    expect(result).toContain('Detailed Test');
    expect(result).toContain('Automated');
  });

  it('lists trajectories', () => {
    service.createTrajectory({ session_id: 's1', task: 'Task 1', method: 'M1' });
    service.createTrajectory({ session_id: 's1', task: 'Task 2', method: 'M2' });
    const result = service.listTrajectories();
    expect(result).toContain('2');
  });

  it('filters by outcome', () => {
    service.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    service.createTrajectory({ session_id: 's1', task: 'T2', method: 'M2' });
    const result = service.listTrajectories({ outcome: 'confirmed' });
    expect(result).toContain('No');
  });

  it('creates a report', () => {
    service.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const trajs = service.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);

    const result = service.createReport({
      title: 'Performance Report',
      trajectory_ids: [id],
      findings: ['TS is fast'],
      methodology: 'Benchmarking',
      conclusions: ['Use TS'],
    });
    expect(result).toContain('created');
  });

  it('gets stats', () => {
    service.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const result = service.getStats();
    expect(result).toContain('1');
  });

  it('exports for training', () => {
    service.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const result = service.exportForTraining('jsonl');
    expect(result).toContain('task');
  });

  it('returns error for non-existent trajectory', () => {
    const result = service.getTrajectory('nonexistent');
    expect(result).toContain('not found');
  });
});
