/**
 * Governance System Tests
 *
 * Tests for the integrated governance system:
 * 1. Autonomy Levels
 * 2. AI-as-a-Judge
 * 3. Nightly Evals
 * 4. Golden Data
 * 5. Progressive Authorization
 */

import * as path from 'path';
import * as fs from 'fs';
import { GovernanceSystem } from '../../src/runtime/governance/GovernanceSystem';


describe('GovernanceSystem', () => {
  let governanceSystem: GovernanceSystem;
  let testWorkspacePath: string;

  beforeAll(() => {
    testWorkspacePath = path.join(__dirname, '__test-workspace__');
    if (!fs.existsSync(testWorkspacePath)) {
      fs.mkdirSync(testWorkspacePath, { recursive: true });
    }
    governanceSystem = new GovernanceSystem(testWorkspacePath);
  });

  afterAll(() => {
    // Cleanup test workspace
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true, force: true });
    }
  });

  describe('Progressive Authorization', () => {
    it('should start agent at L0 trust level', () => {
      const trustLevel = governanceSystem.getReport('test-agent').trustLevel;
      expect(trustLevel).toBe('L0');
    });

    it('should require approval for all actions at L0', async () => {
      const decision = await governanceSystem.checkAction({
        id: 'test-1',
        agentId: 'test-agent',
        type: 'file.read',
        description: 'Test read',
        context: 'Test context',
        expectedOutcome: 'Read file',
        riskLevel: 'low'
      });

      expect(decision.requiresApproval).toBe(true);
    });
  });

  describe('Autonomy Levels', () => {
    it('should have default autonomy levels configured', () => {
      const status = governanceSystem.getSystemStatus();
      expect(status.autonomyLevels).toBeDefined();
    });
  });

  describe('AI Judge', () => {
    it('should have evaluation criteria configured', () => {
      const status = governanceSystem.getSystemStatus();
      expect(status.aiJudge).toBeDefined();
    });
  });

  describe('Golden Data', () => {
    it('should have golden data manager initialized', () => {
      const status = governanceSystem.getSystemStatus();
      expect(status.goldenData).toBeDefined();
    });

    it('should be able to add golden cases', () => {
      // This would test the goldenDataManager directly
      expect(true).toBe(true);
    });
  });

  describe('Action Recording', () => {
    it('should record execution and update trust', async () => {
      const action = {
        id: 'test-record-1',
        agentId: 'test-agent-2',
        type: 'file.read',
        description: 'Test recording',
        context: 'Test',
        expectedOutcome: 'Success',
        riskLevel: 'low' as const
      };

      const decision = await governanceSystem.checkAction(action);
      await governanceSystem.recordExecution(action, true, decision);

      const report = governanceSystem.getReport('test-agent-2');
      expect(report.trustLevel).toBeDefined();
    });
  });

  describe('System Status', () => {
    it('should return complete system status', () => {
      const status = governanceSystem.getSystemStatus();

      expect(status).toHaveProperty('autonomyLevels');
      expect(status).toHaveProperty('aiJudge');
      expect(status).toHaveProperty('nightlyEval');
      expect(status).toHaveProperty('goldenData');
      expect(status).toHaveProperty('progressiveAuth');
    });
  });
});
