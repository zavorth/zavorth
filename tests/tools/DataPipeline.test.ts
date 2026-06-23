import fs from 'fs';
import os from 'os';
import path from 'path';
import { DataPipelineService } from '../../src/services/plugins/DataPipelineService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-'));

describe('DataPipelineService', () => {
  let svc: DataPipelineService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DataPipelineService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates pipeline', () => { expect(svc.createPipeline('test', 'desc')).toContain('created'); });
  it('lists pipelines', () => { svc.createPipeline('test', 'desc'); expect(svc.listPipelines()).toContain('test'); });
  it('gets pipeline info', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.getPipeline(id)).toContain('test'); });
  it('adds step', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.addStep(id, 'extract', { source: 'test.json' })).toContain('added'); });
  it('deletes pipeline', () => { svc.createPipeline('test', 'desc'); const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || ''; expect(svc.deletePipeline(id)).toContain('deleted'); });
  it('returns error for non-existent pipeline', () => { expect(svc.getPipeline('nonexistent')).toContain('Error'); });
  it('gets stats', () => { svc.createPipeline('test', 'desc'); expect(svc.getStats()).toContain('Pipelines: 1'); });

  it('runs extract pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });

  it('runs filter pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'filter', { field: 'age', operator: 'gt', value: 27 });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });

  it('runs sort pipeline', async () => {
    const data = [{ name: 'Bob', age: 25 }, { name: 'Alice', age: 30 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'sort', { field: 'age', order: 'asc' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });

  it('runs aggregate pipeline', async () => {
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
    fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(data));
    svc.createPipeline('test', 'desc');
    const id = svc.listPipelines().match(/pipeline_\w+/)?.[0] || '';
    svc.addStep(id, 'extract', { source: path.join(dir, 'input.json'), format: 'json' });
    svc.addStep(id, 'aggregate', { field: 'age', operation: 'avg' });
    const r = await svc.runPipeline(id);
    expect(r).toContain('completed');
  });
});
