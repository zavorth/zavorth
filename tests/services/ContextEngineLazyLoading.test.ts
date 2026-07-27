import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Context Engine — Lazy Loading Integration', () => {
  describe('AGENTS.md lazy loading instructions', () => {
    it('should instruct loading only AGENTS.md at startup', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      const startupSection = agentsMd.match(/## Session Startup[\s\S]*-(-=##|$)/);
      expect(startupSection).not.toBeNull();

      const content = startupSection![0];
      expect(content).toContain('Read `AGENTS.md`');
      expect(content).not.toContain('Read `MEMORY.md`');
    });

    it('should have on-demand loading table for all config files', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('On-Demand Config Loading');

      const configFiles = [
        'IDENTITY.md', 'SOUL.md', 'USER.md', 'RULES.md',
        'DOMAIN.md', 'KNOWLEDGE.md', 'TOOLS.md', 'ERROR-HANDLING.md',
        'OUTPUT-FORMAT.md', 'PROACTIVITY.md', 'MULTI-MODAL.md',
        'TEAM-CONTEXT.md', 'LEARNING-STYLE.md', 'TIME-AUTOMATION.md',
        'TOOL-POLICY.md', 'WORKFLOWS.md',
      ];

      for (const file of configFiles) {
        expect(agentsMd).toContain(`\`${file}\``);
      }
    });

    it('should have rules about missing files and caching', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('skip it silently');
      expect(agentsMd).toContain('remember the key points');
    });
  });

  describe('Security rules', () => {
    it('should have Red Lines section', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('## Red Lines');
    });

    it('should protect Red Lines from config override', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('may never override');
      expect(agentsMd).toContain('Red Lines');
    });
  });

  describe('Token savings validation', () => {
    it('should have lazy loading section that reduces startup tokens', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');

      // Before: multiple files loaded at startup
      // After: one file loaded at startup (AGENTS.md)
      const startupSection = agentsMd.match(/## Session Startup[\s\S]*-(-=##|$)/);
      const content = startupSection![0];

      // Should NOT have instructions to read all config files
      expect(content).not.toMatch(/Read `IDENTITY\.md`.*Read `SOUL\.md`.*Read `USER\.md`/s);
    });
  });

  describe('InfiniteMemoryCompressor config protection', () => {
    it('should have pushConfigMessage method', () => {
      const compressorPath = path.join(PROJECT_ROOT, 'src/runtime/sessions/v2/InfiniteMemoryCompressor.ts');
      const content = fs.readFileSync(compressorPath, 'utf-8');
      expect(content).toContain('pushConfigMessage');
    });

    it('should have isCriticalMessage method', () => {
      const compressorPath = path.join(PROJECT_ROOT, 'src/runtime/sessions/v2/InfiniteMemoryCompressor.ts');
      const content = fs.readFileSync(compressorPath, 'utf-8');
      expect(content).toContain('isCriticalMessage');
    });

    it('should protect [CONFIG:] messages from compression', () => {
      const compressorPath = path.join(PROJECT_ROOT, 'src/runtime/sessions/v2/InfiniteMemoryCompressor.ts');
      const content = fs.readFileSync(compressorPath, 'utf-8');
      expect(content).toContain('isCriticalMessage(msg)');
    });
  });
});
