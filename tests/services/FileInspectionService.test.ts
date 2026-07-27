import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileInspectionService } from '../../src/services/FileInspectionService';

describe('FileInspectionService', () => {
  it('compares two text files and returns a compact diff summary', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspect-compare-'));
    const left = path.join(tempDir, 'left.txt');
    const right = path.join(tempDir, 'right.txt');
    fs.writeFileSync(left, 'linthere is 1\nlinthere is 2\n', 'utf8');
    fs.writeFileSync(right, 'linthere is 1\nlinthere is 3\n', 'utf8');

    try {
      const service = new FileInspectionService({
        workspaceDir: tempDir,
        workspaceRootDir: tempDir,
      });

      const plan = await service.prepare(`compare "${left}" e "${right}"`);

      expect(plan.kind).toBe('result');
      expect((plan as any).text).toContain('Comparison between left.txt e right.txt');
      expect((plan as any).text).toContain('-linthere is 2');
      expect((plan as any).text).toContain('+linthere is 3');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('lists changed files using natural time filters', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspect-changes-'));
    const recent = path.join(tempDir, 'recent.html');
    fs.writeFileSync(recent, '<html></html>', 'utf8');
    fs.utimesSync(recent, new Date(), new Date());

    try {
      const service = new FileInspectionService({
        workspaceDir: tempDir,
        workspaceRootDir: tempDir,
      });

      const plan = await service.prepare('o que mudou hoje na workspace');

      expect(plan.kind).toBe('result');
      expect((plan as any).text).toContain('Files alterados de hoje');
      expect((plan as any).text).toContain('recent.html');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('requests permission when the explicit path exists outside the allowed roots', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspect-workspace-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspect-outside-'));
    const outsideFile = path.join(outsideDir, 'outside.html');
    fs.writeFileSync(outsideFile, '<html>outside</html>', 'utf8');

    try {
      const service = new FileInspectionService({
        workspaceDir,
        workspaceRootDir: workspaceDir,
      });

      const plan = await service.prepare(`compare "${outsideFile}" e "${outsideFile}"`);

      expect(plan.kind).toBe('permission');
      expect((plan as any).requestedPath).toBe(outsideDir);
      expect((plan as any).reason).toContain('inspecao local');
    } finally {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
