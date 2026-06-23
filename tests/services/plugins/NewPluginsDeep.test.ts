import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemorySupermemoryService } from '../../src/services/plugins/MemorySupermemoryService';
import { MemoryByteroverService } from '../../src/services/plugins/MemoryByteroverService';
import { MemoryHindsightService } from '../../src/services/plugins/MemoryHindsightService';
import { MemoryHolographicService } from '../../src/services/plugins/MemoryHolographicService';
import { MemoryRetainDBService } from '../../src/services/plugins/MemoryRetainDBService';
import { CompanionIOSService } from '../../src/services/plugins/CompanionIOSService';
import { CompanionAndroidService } from '../../src/services/plugins/CompanionAndroidService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-deep-'));

describe('MemorySupermemoryService', () => {
  let svc: MemorySupermemoryService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemorySupermemoryService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('stores a memory', () => { const r = svc.remember('TypeScript is great'); expect(r).toBeTruthy(); });
  it('recalls by query', () => { svc.remember('TypeScript is great'); const r = svc.recall('TypeScript'); expect(r).toContain('TypeScript'); });
  it('gets stats', () => { svc.remember('test'); const r = svc.getStats(); expect(r).toBeTruthy(); });
  it('consolidates memories', () => { svc.remember('a'); svc.remember('b'); const r = svc.consolidate(); expect(r).toBeTruthy(); });
});

describe('MemoryByteroverService', () => {
  let svc: MemoryByteroverService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryByteroverService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('stores a memory', () => { const r = svc.remember('User prefers dark mode', { category: 'preference' }); expect(r).toBeTruthy(); });
  it('recalls by query', () => { svc.remember('User prefers dark mode'); const r = svc.recall('dark mode'); expect(r).toContain('dark'); });
  it('gets stats', () => { svc.remember('test'); const r = svc.getStats(); expect(r).toBeTruthy(); });
});

describe('MemoryHindsightService', () => {
  let svc: MemoryHindsightService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryHindsightService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('records a decision', () => { const r = svc.remember('Decided to use PostgreSQL', { category: 'fact' }); expect(r).toBeTruthy(); });
  it('recalls decisions', () => { svc.remember('Decided to use PostgreSQL'); const r = svc.recall('PostgreSQL'); expect(r).toContain('PostgreSQL'); });
  it('gets stats', () => { const r = svc.getStats(); expect(r).toBeTruthy(); });
});

describe('MemoryHolographicService', () => {
  let svc: MemoryHolographicService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryHolographicService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('stores memory', () => { const r = svc.remember('Meeting at 3pm'); expect(r).toBeTruthy(); });
  it('recalls by query', () => { svc.remember('Meeting at 3pm'); const r = svc.recall('meeting'); expect(r).toContain('Meeting'); });
  it('gets stats', () => { const r = svc.getStats(); expect(r).toBeTruthy(); });
});

describe('MemoryRetainDBService', () => {
  let svc: MemoryRetainDBService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryRetainDBService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('stores with retention', () => { const r = svc.remember('Temp data', { category: 'event' }); expect(r).toBeTruthy(); });
  it('recalls stored data', () => { svc.remember('Temp data'); const r = svc.recall('Temp'); expect(r).toContain('Temp'); });
  it('gets stats', () => { const r = svc.getStats(); expect(r).toBeTruthy(); });
});

describe('CompanionIOSService', () => {
  let svc: CompanionIOSService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CompanionIOSService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('has getStats method', () => { expect(typeof svc.getStats).toBe('function'); });
});

describe('CompanionAndroidService', () => {
  let svc: CompanionAndroidService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CompanionAndroidService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('has getStats method', () => { expect(typeof svc.getStats).toBe('function'); });
});
