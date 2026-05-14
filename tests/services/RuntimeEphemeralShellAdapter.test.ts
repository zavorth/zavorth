import fs from 'fs';
import os from 'os';
import path from 'path';
import { RuntimeEphemeralShellAdapter } from '../../src/services/RuntimeEphemeralShellAdapter';

describe('RuntimeEphemeralShellAdapter', () => {
  it('runs in a temporary workspace with a sanitized environment and removes it afterwards', async () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ephemeral-test-'));
    const adapter = new RuntimeEphemeralShellAdapter(basePath);

    const result = await adapter.execute({
      file: process.execPath,
      args: [
        '-e',
        [
          "const fs = require('fs');",
          "fs.writeFileSync('marker.txt', process.cwd(), 'utf8');",
          "console.log(process.env.ZAVORTH_EPHEMERAL_EXECUTION);",
          "console.log(process.cwd());",
        ].join(''),
      ],
      timeoutMs: 5000,
      auditSeed: 'ephemeral-test',
    });

    expect(result.stdout).toContain('true');
    expect(result.stdout).toContain(basePath);
    expect(result.workspaceRemoved).toBe(true);
    expect(fs.readdirSync(basePath).filter((entry) => entry.startsWith('run-'))).toEqual([]);

    fs.rmSync(basePath, { recursive: true, force: true });
  });
});
