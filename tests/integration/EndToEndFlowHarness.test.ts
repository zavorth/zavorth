import {
  ZavorthEndToEndFlowHarness,
  STAGE33_FLOW_FIXTURES,
} from './harness/ZavorthEndToEndFlowHarness';

describe('Approval gate3 end-to-end flow harness', () => {
  it('runs Telegram command -> parser -> task -> gateway -> executor -> response', async () => {
    const harness = new ZavorthEndToEndFlowHarness();

    const result = await harness.sendTelegram(STAGE33_FLOW_FIXTURES.telegramCommand);

    expect(result.task).toEqual(expect.objectContaining({
      command_type: '/task',
      status: 'completed',
      executor_used: 'local_executor',
    }));
    expect(result.replies.map((reply) => reply.text).join('\n')).toContain('Completed');
    expect(harness.executorCalls).toContainEqual(expect.objectContaining({
      taskId: result.task?.task_id,
      executor: 'local_executor',
      status: 'completed',
    }));
    expect(harness.eventsForTask(result.task).map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'task.created',
      'executor.started',
      'task.completed',
    ]));
    expect(result.task?.metadata.correlation.traceId).toMatch(/^approval-gate3-trace-/);
  });

  it('covers permission request -> approve/reject -> resumed or stopped execution', async () => {
    const harness = new ZavorthEndToEndFlowHarness();

    const approvalStart = await harness.sendTelegram(STAGE33_FLOW_FIXTURES.permissionRequest);
    const approvalId = approvalStart.task?.metadata.pendingPermissionId;
    expect(approvalStart.task?.status).toBe('waiting_approval');
    expect(approvalStart.replies[0]?.text).toContain('Approval required');

    await harness.sendTelegram(`/approve ${approvalId}`);
    const approvedPermission = harness.permissions.get(approvalId);
    const approvedTask = approvalStart.task ? harness.tasks.get(approvalStart.task.task_id) : null;
    expect(approvedPermission?.status).toBe('approved');
    expect(approvedTask).toEqual(expect.objectContaining({
      status: 'completed',
      approval_status: 'approved',
      executor_used: 'approved_executor',
    }));
    expect(harness.eventsForTask(approvedTask).map((event) => event.eventType)).toContain('permission.approved');

    const rejectionStart = await harness.sendTelegram(STAGE33_FLOW_FIXTURES.permissionRequest);
    const rejectionId = rejectionStart.task?.metadata.pendingPermissionId;
    await harness.sendTelegram(`/reject ${rejectionId}`);
    const rejectedPermission = harness.permissions.get(rejectionId);
    const rejectedTask = rejectionStart.task ? harness.tasks.get(rejectionStart.task.task_id) : null;
    expect(rejectedPermission?.status).toBe('rejected');
    expect(rejectedTask).toEqual(expect.objectContaining({
      status: 'rejected',
      approval_status: 'rejected',
    }));
    expect(harness.eventsForTask(rejectedTask).map((event) => event.eventType)).toContain('permission.rejected');
  });

  it('repairs ExternalExecutor workspace mismatch and reexecutes in the corrected workspace', async () => {
    const harness = new ZavorthEndToEndFlowHarness();

    const result = await harness.sendTelegram(STAGE33_FLOW_FIXTURES.externalExecutorWorkspaceMismatch);

    expect(result.task).toEqual(expect.objectContaining({
      status: 'completed',
      executor_used: 'external_executor',
      result_summary: 'ExternalExecutor reexecutou no workspace correto.',
    }));
    expect(result.task?.metadata.externalExecutorWorkspaceRepair).toEqual(expect.objectContaining({
      detected: true,
      from: 'C:/tmp/outside-workspace',
      to: '<repo>',
    }));
    expect(harness.executorCalls.filter((call) => call.executor === 'external_executor')).toEqual([
      expect.objectContaining({ attempt: 1, status: 'workspace_mismatch' }),
      expect.objectContaining({ attempt: 2, status: 'completed' }),
    ]);
    expect(harness.eventsForTask(result.task).map((event) => event.eventType)).toContain('external_executor.workspace_mismatch');
    expect(result.replies[0]?.text).toContain('Workspace corrigido');
  });

  it('retries ZavorthBridge timeout and falls back without external host dependencies', async () => {
    const harness = new ZavorthEndToEndFlowHarness();

    const result = await harness.sendTelegram(STAGE33_FLOW_FIXTURES.zavorthBridgeTimeout);

    expect(result.task).toEqual(expect.objectContaining({
      status: 'completed',
      executor_used: 'local_executor',
      fallback_used: true,
      error_summary: 'ZavorthBridge excedeu timeout duas vezes; fallback local usado.',
    }));
    expect(harness.executorCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ executor: 'zavorthBridge', attempt: 1, status: 'timeout' }),
      expect.objectContaining({ executor: 'zavorthBridge', attempt: 2, status: 'timeout' }),
      expect.objectContaining({ executor: 'local_executor', attempt: 1, status: 'completed' }),
    ]));
    expect(harness.eventsForTask(result.task).filter((event) => event.eventType === 'zavorthBridge.timeout')).toHaveLength(2);
    expect(result.replies[0]?.text).toContain('fallback local completed');
  });

  it('shares web session state and control approval over the same permission plane', async () => {
    const harness = new ZavorthEndToEndFlowHarness();
    const sessionId = 'approval-gate3-web-session';

    const start = await harness.sendWeb(sessionId, STAGE33_FLOW_FIXTURES.webApproval);
    const approvalId = start.task?.metadata.pendingPermissionId;
    const beforeApproval = harness.getControlSnapshot(sessionId);

    expect(start.session.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: STAGE33_FLOW_FIXTURES.webApproval }),
      expect.objectContaining({ role: 'assistant', content: expect.stringContaining('Approval required') }),
    ]));
    expect(beforeApproval.approvalPlane.pending).toEqual([
      expect.objectContaining({ permission_id: approvalId, status: 'pending' }),
    ]);

    const resolved = await harness.resolveControlApproval(sessionId, approvalId, 'approve');
    const afterApproval = harness.getControlSnapshot(sessionId);

    expect(resolved.permission.status).toBe('approved');
    expect(resolved.task).toEqual(expect.objectContaining({
      status: 'completed',
      approval_status: 'approved',
    }));
    expect(afterApproval.approvalPlane.pending).toEqual([]);
    expect(afterApproval.session.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', content: expect.stringContaining('execution resumed') }),
    ]));
    expect(harness.eventsForTask(resolved.task).map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'permission.requested',
      'permission.approved',
      'task.completed',
    ]));
  });
});
