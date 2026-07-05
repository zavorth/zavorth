import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Config Loading — Extended Coverage', () => {
  describe('AGENTS.md structure', () => {
    it('should have proper markdown heading hierarchy', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('## Session Startup');
      expect(content).toContain('## On-Demand Config Loading');
      expect(content).toContain('## Personalization Architecture');
      expect(content).toContain('## Red Lines');
      expect(content).toContain('## Memory');
    });

    it('should list all 16 config files in the on-demand table', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      const files = [
        'IDENTITY.md', 'SOUL.md', 'USER.md', 'RULES.md',
        'DOMAIN.md', 'KNOWLEDGE.md', 'TOOLS.md', 'ERROR-HANDLING.md',
        'OUTPUT-FORMAT.md', 'PROACTIVITY.md', 'MULTI-MODAL.md',
        'TEAM-CONTEXT.md', 'LEARNING-STYLE.md', 'TIME-AUTOMATION.md',
        'TOOL-POLICY.md', 'WORKFLOWS.md',
      ];
      for (const file of files) {
        expect(content).toContain(`\`${file}\``);
      }
    });

    it('should have "When to read" column for each config file', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('When to read');
    });

    it('should have "What it contains" column', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('What it contains');
    });
  });

  describe('Config file integrity', () => {
    const configFiles = [
      'IDENTITY.md', 'SOUL.md', 'USER.md', 'RULES.md',
      'DOMAIN.md', 'KNOWLEDGE.md', 'TOOLS.md', 'ERROR-HANDLING.md',
      'OUTPUT-FORMAT.md', 'PROACTIVITY.md', 'MULTI-MODAL.md',
      'TEAM-CONTEXT.md', 'LEARNING-STYLE.md', 'TIME-AUTOMATION.md',
      'TOOL-POLICY.md', 'WORKFLOWS.md',
    ];

    for (const file of configFiles) {
      it(`${file} should have heading`, () => {
        const content = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf-8');
        expect(content.startsWith('#')).toBe(true);
      });

      it(`${file} should be non-empty`, () => {
        const stat = fs.statSync(path.join(PROJECT_ROOT, file));
        expect(stat.size).toBeGreaterThan(100);
      });
    }
  });

  describe('On-demand loading rules', () => {
    it('should have skip rule for missing files', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('skip it silently');
    });

    it('should have caching rule', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('remember the key points');
    });

    it('should have "Start light" instruction', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('Start light');
    });
  });

  describe('Security rules', () => {
    it('should have "Do not exfiltrate private data"', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('Do not exfiltrate private data');
    });

    it('should have "Prefer recoverable actions"', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('Prefer recoverable actions');
    });

    it('should have config override protection', () => {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('may never override');
    });
  });
});
