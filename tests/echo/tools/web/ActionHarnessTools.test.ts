import { buildVerifiedActionHarnessTools } from '../../../../src/echo/tools/web/ActionHarnessTools';
import { ToolSchemaHelper } from '../../../../src/echo/types/ToolSchemaHelper';

jest.mock('../../../../src/runtime/actions/ZavorthActionGateway', () => ({
  ZavorthActionGateway: class MockGateway {
    listActions = jest.fn();
    apply = jest.fn().mockResolvedValue({ ok: true, summary: 'mock', lines: [], data: {} });
  },
}));

describe('buildVerifiedActionHarnessTools', () => {
  it('exposes every verified llm-facing Action Harness action as a provider-safe tool', () => {
    const tools = buildVerifiedActionHarnessTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining([
      'web_search',
      'web_fetch_url',
      'browser_open',
      'browser_click',
      'browser_type',
      'browser_form_submit',
      'workspace_read_file',
      'workspace_create_file',
      'workspace_patch_file',
      'shell_preview_command',
      'shell_run_allowlisted',
      'sandbox_run_code',
      'channels_draft',
      'channels_send_approved',
      'mcp_preview',
      'mcp_execute_quarantined',
      'capabilities_hidden_scan',
      'capabilities_hidden_inspect',
      'capabilities_hidden_expose',
      'skills_catalog_list',
      'skills_catalog_inspect',
      'skills_absorb',
      'agents_external_list',
      'agents_external_invoke',
      'workflows_list',
      'workflows_run',
      'capabilities_reference_agent',
      'capabilities_reference_workspace',
      'video_generate',
      'kanban_board',
      'skills_feedback',
      'trajectories_batch',
      'terminal_backend',
      'email_smtp_send',
      'calendar_local_event',
      'code_review',
      'database_sqlite_query',
      'google_workspace_status',
      'gmail_search',
      'gmail_draft',
      'gmail_send',
      'google_drive_search',
      'google_drive_read_file',
      'google_calendar_list',
      'google_calendar_create',
      'google_calendar_update',
      'google_tasks_list',
      'google_tasks_create',
      'google_tasks_update',
      'media_status',
      'media_image_generate',
      'media_image_analyze',
      'media_speech_synthesize',
      'memory_deep_review',
      'memory_deep_resolve',
      'memory_deep_correct',
      'memory_deep_forget',
      'documents_extract',
      'wiki_search',
      'canvas_render',
      'computer_screenshot',
      'computer_vision',
      'computer_media_control',
      'devices_iot_status',
      'devices_iot_mqtt_publish',
      'plugins_sdk_status',
      'plugins_sdk_lifecycle',
      'channels_long_tail_status',
      'channels_long_tail_draft',
      'kanban_dispatch_multi_agent',
      'terminal_backends_status',
      'terminal_backends_execute',
      'voice_backends_status',
      'voice_synthesize_live',
      'interop_acp_codex_status',
      'packaging_nix_termux_status',
      // expanded fabric / absorb surface
      'plugins_absorb',
      'mcp_intake',
      'capabilities_absorb',
      'workspace_import',
      'reach_inventory',
      'power_inventory',
      'product_inventory',
      'workspace_list_directory',
      'workspace_write_file',
      'browser_screenshot',
      'sandbox_run_tests',
      'mcp_list',
    ]));
    expect(names).toHaveLength(107);
    expect(new Set(names).size).toBe(names.length);
  });

  it('serializes all verified Action Harness tools with provider-compatible function names', () => {
    const definitions = ToolSchemaHelper.toToolDefinitions(buildVerifiedActionHarnessTools());

    expect(definitions.length).toBe(107);
    for (const definition of definitions) {
      expect(definition.name).toMatch(/^[a-zA-Z0-9_-]+$/);
    }
  });

  it('keeps dangerous or approval-gated verified actions permission-gated in the LLM surface', () => {
    const tools = buildVerifiedActionHarnessTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

    expect(byName.workspace_read_file.requiresPermission).toBe(false);
    expect(byName.workspace_create_file.requiresPermission).toBe(true);
    expect(byName.shell_run_allowlisted.requiresPermission).toBe(true);
    expect(byName.sandbox_run_code.requiresPermission).toBe(true);
    expect(byName.channels_draft.requiresPermission).toBe(false);
    expect(byName.channels_send_approved.requiresPermission).toBe(true);
    expect(byName.mcp_preview.requiresPermission).toBe(false);
    expect(byName.mcp_execute_quarantined.requiresPermission).toBe(true);
    expect(byName.browser_click.requiresPermission).toBe(true);
    expect(byName.browser_type.requiresPermission).toBe(true);
    expect(byName.browser_form_submit.requiresPermission).toBe(true);
    expect(byName.capabilities_hidden_scan.requiresPermission).toBe(false);
    expect(byName.capabilities_hidden_inspect.requiresPermission).toBe(false);
    expect(byName.capabilities_hidden_expose.requiresPermission).toBe(true);
    expect(byName.skills_catalog_list.requiresPermission).toBe(false);
    expect(byName.skills_absorb.requiresPermission).toBe(true);
    expect(byName.agents_external_list.requiresPermission).toBe(false);
    expect(byName.agents_external_invoke.requiresPermission).toBe(true);
    expect(byName.workflows_list.requiresPermission).toBe(false);
    expect(byName.workflows_run.requiresPermission).toBe(true);
    expect(byName.capabilities_reference_agent.requiresPermission).toBe(false);
    expect(byName.capabilities_reference_workspace.requiresPermission).toBe(false);
    expect(byName.video_generate.requiresPermission).toBe(true);
    expect(byName.kanban_board.requiresPermission).toBe(true);
    expect(byName.skills_feedback.requiresPermission).toBe(true);
    expect(byName.trajectories_batch.requiresPermission).toBe(true);
    expect(byName.terminal_backend.requiresPermission).toBe(true);
    expect(byName.email_smtp_send.requiresPermission).toBe(true);
    expect(byName.calendar_local_event.requiresPermission).toBe(true);
    expect(byName.code_review.requiresPermission).toBe(false);
    expect(byName.database_sqlite_query.requiresPermission).toBe(true);
    expect(byName.google_workspace_status.requiresPermission).toBe(false);
    expect(byName.gmail_search.requiresPermission).toBe(true);
    expect(byName.gmail_send.requiresPermission).toBe(true);
    expect(byName.google_drive_search.requiresPermission).toBe(true);
    expect(byName.google_calendar_create.requiresPermission).toBe(true);
    expect(byName.media_status.requiresPermission).toBe(false);
    expect(byName.media_image_generate.requiresPermission).toBe(true);
    expect(byName.memory_deep_review.requiresPermission).toBe(false);
    expect(byName.memory_deep_correct.requiresPermission).toBe(true);
    expect(byName.documents_extract.requiresPermission).toBe(false);
    expect(byName.wiki_search.requiresPermission).toBe(false);
    expect(byName.canvas_render.requiresPermission).toBe(true);
    expect(byName.computer_screenshot.requiresPermission).toBe(true);
    expect(byName.computer_vision.requiresPermission).toBe(true);
    expect(byName.devices_iot_status.requiresPermission).toBe(false);
    expect(byName.devices_iot_mqtt_publish.requiresPermission).toBe(true);
    expect(byName.plugins_sdk_status.requiresPermission).toBe(false);
    expect(byName.plugins_sdk_lifecycle.requiresPermission).toBe(true);
    expect(byName.channels_long_tail_status.requiresPermission).toBe(false);
    expect(byName.channels_long_tail_draft.requiresPermission).toBe(false);
    expect(byName.kanban_dispatch_multi_agent.requiresPermission).toBe(true);
    expect(byName.terminal_backends_status.requiresPermission).toBe(false);
    expect(byName.terminal_backends_execute.requiresPermission).toBe(true);
    expect(byName.voice_backends_status.requiresPermission).toBe(false);
    expect(byName.voice_synthesize_live.requiresPermission).toBe(true);
    expect(byName.interop_acp_codex_status.requiresPermission).toBe(false);
    expect(byName.packaging_nix_termux_status.requiresPermission).toBe(false);
  });
});
