import fs from 'fs';
import os from 'os';
import path from 'path';
import { HostIdentityService } from '../../src/services/HostIdentityService';

describe('HostIdentityService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-id-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('authorizes the first run and detects the current host as trusted', () => {
    const stateFile = path.join(tempDir, 'host.json');
    const service = new HostIdentityService(stateFile);

    const status = service.getStatus();

    expect(status.firstRun).toBe(true);
    expect(status.authorized).toBe(true);
    expect(fs.existsSync(stateFile)).toBe(true);
  });
});
