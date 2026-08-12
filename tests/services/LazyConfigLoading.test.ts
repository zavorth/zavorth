import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Lazy Config Loading', () => {
  describe('AGENTS.md should use on-demand loading', () => {
    it('should contain "On-Demand Config Loading" section', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('On-Demand Config Loading');
    });

    it('should NOT instruct reading all config files at startup', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');

      // Find the Session Startup section
      const startupSection = agentsMd.match(/## Session Startup[\s\S]*?(?=##|$)/);
      expect(startupSection).not.toBeNull();

      const startupContent = startupSection![0];

      // Should only instruct reading AGENTS.md and MEMORY.md at startup
      expect(startupContent).toContain('Read `AGENTS.md`');
      expect(startupContent).toContain('Read `MEMORY.md`');

      // Should NOT instruct reading all these at startup:
      expect(startupContent).not.toMatch(/Read `IDENTITY\.md`/);
      expect(startupContent).not.toMatch(/Read `SOUL\.md`/);
      expect(startupContent).not.toMatch(/Read `USER\.md`/);
      expect(startupContent).not.toMatch(/Read `RULES\.md`/);
      expect(startupContent).not.toMatch(/Read `DOMAIN\.md`/);
      expect(startupContent).not.toMatch(/Read `KNOWLEDGE\.md`/);
    });

    it('should have lazy loading instructions for each config file', () => {
      const agentsMd = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');

      const configFiles = [
        'IDENTITY.md',
        'SOUL.md',
        'USER.md',
        'RULES.md',
        'DOMAIN.md',
        'KNOWLEDGE.md',
        'TOOLS.md',
        'ERROR-HANDLING.md',
        'OUTPUT-FORMAT.md',
        'PROACTIVITY.md',
        'MULTI-MODAL.md',
        'TEAM-CONTEXT.md',
        'LEARNING-STYLE.md',
        'TIME-AUTOMATION.md',
        'TOOL-POLICY.md',
        'WORKFLOWS.md',
      ];

      for (const file of configFiles) {
        expect(agentsMd).toContain(`\`${file}\``);
      }
    });
  });

  describe('Config files should still exist and be readable', () => {
    const configFiles = [
      'IDENTITY.md',
      'SOUL.md',
      'USER.md',
      'RULES.md',
      'DOMAIN.md',
      'KNOWLEDGE.md',
      'TOOLS.md',
      'ERROR-HANDLING.md',
      'OUTPUT-FORMAT.md',
      'PROACTIVITY.md',
      'MULTI-MODAL.md',
      'TEAM-CONTEXT.md',
      'LEARNING-STYLE.md',
      'TIME-AUTOMATION.md',
      'TOOL-POLICY.md',
      'WORKFLOWS.md',
    ];

    for (const file of configFiles) {
      it(`should have ${file} with content`, () => {
        const filePath = path.join(PROJECT_ROOT, file);
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(100);
      });
    }
  });

  describe('Token savings estimation', () => {
    it('should calculate approximate token savings', () => {
      const configFiles = [
        'IDENTITY.md', 'SOUL.md', 'USER.md', 'RULES.md',
        'DOMAIN.md', 'KNOWLEDGE.md', 'TOOLS.md', 'ERROR-HANDLING.md',
        'OUTPUT-FORMAT.md', 'PROACTIVITY.md', 'MULTI-MODAL.md',
        'TEAM-CONTEXT.md', 'LEARNING-STYLE.md', 'TIME-AUTOMATION.md',
        'TOOL-POLICY.md', 'WORKFLOWS.md',
      ];

      let totalBytes = 0;
      for (const file of configFiles) {
        const filePath = path.join(PROJECT_ROOT, file);
        if (fs.existsSync(filePath)) {
          totalBytes += fs.statSync(filePath).size;
        }
      }

      // Approximate tokens (1 token ≈ 4 bytes for English)
      const estimatedTokens = Math.ceil(totalBytes / 4);

      console.log(`\nToken savings analysis:`);
      console.log(`Total config bytes: ${totalBytes}`);
      console.log(`Estimated tokens (if all loaded at startup): ${estimatedTokens}`);
      console.log(`With lazy loading (avg 3 files per session): ~${Math.ceil(estimatedTokens * 0.2)} tokens`);
      console.log(`Savings: ~${Math.ceil(estimatedTokens * 0.8)} tokens per session\n`);

      expect(estimatedTokens).toBeGreaterThan(0);
    });
  });
});
