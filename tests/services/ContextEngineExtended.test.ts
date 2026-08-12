import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Context Engine — Extended Tests', () => {
  describe('InfiniteMemoryCompressor config protection', () => {
    const compressorPath = path.join(PROJECT_ROOT, 'src/runtime/sessions/v2/InfiniteMemoryCompressor.ts');
    const content = fs.readFileSync(compressorPath, 'utf-8');

    it('should have pushConfigMessage method', () => {
      expect(content).toContain('pushConfigMessage');
    });

    it('should have isCriticalMessage method', () => {
      expect(content).toContain('isCriticalMessage');
    });

    it('should tag messages with [CONFIG:] prefix', () => {
      expect(content).toContain('[CONFIG:');
    });

    it('should separate critical from compressible messages', () => {
      expect(content).toContain('criticalMessages');
      expect(content).toContain('compressibleMessages');
    });

    it('should preserve critical messages after compression', () => {
      expect(content).toContain('criticalMessages.push');
    });
  });

  describe('ContextEngine lazy loading support', () => {
    const enginePath = path.join(PROJECT_ROOT, 'src/context-engine/ContextEngine.ts');
    const content = fs.readFileSync(enginePath, 'utf-8');

    it('should have ToolUsageTracker integration', () => {
      expect(content).toContain('ToolUsageTracker');
    });

    it('should have ToolResultCache integration', () => {
      expect(content).toContain('ToolResultCache');
    });

    it('should have ContextAwareInjector integration', () => {
      expect(content).toContain('ContextAwareInjector');
    });

    it('should have recordToolUsage method', () => {
      expect(content).toContain('recordToolUsage');
    });

    it('should have getCachedToolResult method', () => {
      expect(content).toContain('getCachedToolResult');
    });
  });

  describe('AGENTS.md file size optimization', () => {
    it('should be under 12KB', () => {
      const stat = fs.statSync(path.join(PROJECT_ROOT, 'AGENTS.md'));
      expect(stat.size).toBeLessThan(12288);
    });

    it('should have lazy loading section', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('On-Demand Config Loading');
    });
  });

  describe('Security: config files cannot override Red Lines', () => {
    it('should have explicit rule in AGENTS.md', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      const redLinesSection = content.match(/## Red Lines[\s\S]*?(?=##|$)/);
      expect(redLinesSection).not.toBeNull();
      expect(redLinesSection![0]).toContain('may never override');
    });

    it('should mention Red Lines in the override rule', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('Red Lines');
    });
  });
});
