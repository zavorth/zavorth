import fs from 'fs';
import os from 'os';
import path from 'path';
import { SecurityAuditTrailService } from '../../src/monitoring/SecurityAuditTrailService.js';

describe('SecurityAuditTrailService', () => {
  it('persists a hash-chained audit trail and operational status without leaking raw input', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-audit-trail-'));
    const trailDir = path.join(root, 'trail');
    const statusFile = path.join(root, 'security-audit-last.json');
    const service = new SecurityAuditTrailService({
      trailDir,
      statusFile,
      now: () => new Date('2026-04-03T22:00:00.000Z'),
    });

    const first = service.append({
      timestamp: '2026-04-03T22:00:00.000Z',
      event_type: 'APPROVAL_DECISION',
      task_id: 'task-1',
      user_id: '42',
      user_input: '/approve task-1',
      intent: 'ship',
      plan_id: null,
      risk_level: 2,
      policy_decision: 'REQUIRES_CONFIRMATION',
      policy_violations: null,
      operational_mode: 'OPERATOR',
      executor: 'external_executor',
      execution_success: null,
      execution_summary: 'Operator approved task execution.',
      metadata: {
        action: 'approve',
      },
    });
    const second = service.append({
      timestamp: '2026-04-03T22:01:00.000Z',
      event_type: 'PERMISSION_DECISION',
      task_id: 'task-1',
      user_id: '42',
      user_input: '/perm approve perm-1',
      intent: null,
      plan_id: null,
      risk_level: 0,
      policy_decision: 'REQUIRES_CONFIRMATION',
      policy_violations: null,
      operational_mode: 'OPERATOR',
      executor: 'codex',
      execution_success: null,
      execution_summary: 'Permission approve: codex/workspace_access',
      metadata: {
        action: 'approve',
        permission_id: 'perm-1',
      },
    });

    expect(first.totalEvents).toBe(1);
    expect(second.totalEvents).toBe(2);
    expect(second.latestChainHash).toBeTruthy();

    const records = fs.readFileSync(path.join(trailDir, 'events.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const ledger = JSON.parse(fs.readFileSync(path.join(trailDir, 'ledger.json'), 'utf8')) as any;
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8')) as any;

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual(expect.objectContaining({
      sequence: 1,
      event_type: 'APPROVAL_DECISION',
      previous_chain_hash: null,
      payload_hash: expect.any(String),
      metadata_hash: expect.any(String),
    }));
    expect(records[1]).toEqual(expect.objectContaining({
      sequence: 2,
      event_type: 'PERMISSION_DECISION',
      previous_chain_hash: records[0].chain_hash,
    }));
    expect(records[0]).not.toHaveProperty('user_input');
    expect(records[1]).not.toHaveProperty('execution_summary');
    expect(ledger).toEqual(expect.objectContaining({
      totalEvents: 2,
      latestEventType: 'PERMISSION_DECISION',
      latestTaskId: 'task-1',
      latestChainHash: records[1].chain_hash,
    }));
    expect(status).toEqual(expect.objectContaining({
      ok: true,
      totalEvents: 2,
      latestEventType: 'PERMISSION_DECISION',
      latestTaskId: 'task-1',
      latestChainHash: records[1].chain_hash,
    }));
  });

  it('records a failed status snapshot when append persistence degrades', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-audit-trail-failure-'));
    const statusFile = path.join(root, 'security-audit-last.json');
    const service = new SecurityAuditTrailService({
      trailDir: path.join(root, 'trail'),
      statusFile,
      now: () => new Date('2026-04-03T22:05:00.000Z'),
    });

    service.recordFailure(new Error('disk unavailable'));

    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8')) as any;
    expect(status).toEqual(expect.objectContaining({
      ok: false,
      summary: expect.stringContaining('disk unavailable'),
    }));
  });
});
