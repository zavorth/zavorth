import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MnemosMemoryLifecycleService } from '../../src/services/MnemosMemoryLifecycleService';

describe('MnemosMemoryLifecycleService', () => {
  it('classifies memory markdown into hot, warm, cold and archive tiers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-lifecycle-'));
    const memory = path.join(root, 'memory');
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, '2026-05-24.md'), '# Today\nFresh context\n', 'utf8');
    fs.writeFileSync(path.join(memory, '2026-05-01.md'), '# Warm\nWeekly context\n', 'utf8');
    fs.writeFileSync(path.join(memory, '2026-03-01.md'), '# Cold\nMonthly context\n', 'utf8');
    fs.writeFileSync(path.join(memory, '2025-01-01.md'), '# Archive\nOld context\n', 'utf8');

    const service = new MnemosMemoryLifecycleService({
      projectRoot: root,
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });
    const snapshot = service.buildSnapshot({ apply: true });

    expect(snapshot.summary).toEqual({ hot: 1, warm: 1, cold: 1, archive: 1 });
    expect(fs.existsSync(path.join(memory, 'summaries', 'weekly', '2026-W18.md'))).toBe(true);
    expect(fs.existsSync(path.join(memory, 'summaries', 'monthly', '2026-03.md'))).toBe(true);
    expect(fs.existsSync(path.join(memory, 'archive', 'INDEX.md'))).toBe(true);
  });
});
