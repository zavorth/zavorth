/**
 * Smoke test: LLM Tool-Calling Integration
 *
 * Verifies that EchoOrchestrator exposes every verified Action Harness action
 * as provider-safe ToolDefinitions that the LLM can discover and invoke.
 *
 * Usage:
 *   node scripts/smoke-llm-tool-calling.mjs
 */

import { ZavorthEchoOrchestrator } from '../dist/echo/orchestrator/ZavorthEchoOrchestrator.js';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const pass = (label) => console.log(`  ${GREEN}ok${RESET}  ${label}`);
const fail = (label) => console.log(`  ${RED}no${RESET}  ${label}`);

function header(title) {
  console.log(`\n${BOLD}-- ${title} --${RESET}`);
}

let failures = 0;

function assert(condition, label) {
  if (condition) pass(label);
  else {
    fail(label);
    failures += 1;
  }
}

const orchestrator = new ZavorthEchoOrchestrator({ startBackgroundBridges: false });

header('1. Verified Action Harness tools registered in EchoOrchestrator');
{
  const allTools = orchestrator.listAllTools();
  const allNames = allTools.map((tool) => tool.name);
  const expectedTools = [
    'web_search',
    'web_fetch_url',
    'browser_open',
    'browser_screenshot',
    'browser_extract',
    'browser_click',
    'browser_type',
    'browser_form_submit',
    'workspace_read_file',
    'workspace_list_directory',
    'workspace_search_files',
    'workspace_diff_file',
    'workspace_create_file',
    'workspace_write_file',
    'workspace_patch_file',
    'shell_preview_command',
    'shell_run_allowlisted',
    'sandbox_run_code',
    'sandbox_run_tests',
    'channels_status',
    'channels_draft',
    'channels_send_approved',
    'mcp_list',
    'mcp_inspect',
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
    'capabilities_parity_standard',
    'capabilities_parity_zavorth',
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
  ];

  for (const name of expectedTools) {
    assert(allNames.includes(name), `tool "${name}" is registered`);
  }

  console.log(`     -> Total tools: ${allTools.length} (${expectedTools.length} verified Action Harness checks)`);
}

header('2. WEB category filtering works');
{
  const webTools = orchestrator.getSchemasForCategory('WEB');
  const webNames = webTools.map((tool) => tool.name);
  assert(webNames.includes('web_search'), 'web_search in WEB category');
  assert(webNames.includes('web_fetch_url'), 'web_fetch_url in WEB category');
  assert(webNames.includes('browser_open'), 'browser_open in WEB category');
}

header('2b. INTERNAL category includes non-web verified actions');
{
  const internalTools = orchestrator.getSchemasForCategory('INTERNAL');
  const internalNames = internalTools.map((tool) => tool.name);
  assert(internalNames.includes('workspace_read_file'), 'workspace_read_file in INTERNAL category');
  assert(internalNames.includes('shell_run_allowlisted'), 'shell_run_allowlisted in INTERNAL category');
  assert(internalNames.includes('sandbox_run_code'), 'sandbox_run_code in INTERNAL category');
  assert(internalNames.includes('channels_draft'), 'channels_draft in INTERNAL category');
  assert(internalNames.includes('mcp_preview'), 'mcp_preview in INTERNAL category');
  assert(internalNames.includes('capabilities_hidden_scan'), 'capabilities_hidden_scan in INTERNAL category');
  assert(internalNames.includes('skills_absorb'), 'skills_absorb in INTERNAL category');
  assert(internalNames.includes('agents_external_invoke'), 'agents_external_invoke in INTERNAL category');
  assert(internalNames.includes('workflows_run'), 'workflows_run in INTERNAL category');
  assert(internalNames.includes('video_generate'), 'video_generate in INTERNAL category');
  assert(internalNames.includes('email_smtp_send'), 'email_smtp_send in INTERNAL category');
  assert(internalNames.includes('database_sqlite_query'), 'database_sqlite_query in INTERNAL category');
  assert(internalNames.includes('gmail_search'), 'gmail_search in INTERNAL category');
  assert(internalNames.includes('media_image_generate'), 'media_image_generate in INTERNAL category');
  assert(internalNames.includes('memory_deep_review'), 'memory_deep_review in INTERNAL category');
  assert(internalNames.includes('documents_extract'), 'documents_extract in INTERNAL category');
  assert(internalNames.includes('computer_vision'), 'computer_vision in INTERNAL category');
  assert(internalNames.includes('plugins_sdk_status'), 'plugins_sdk_status in INTERNAL category');
  assert(internalNames.includes('terminal_backends_execute'), 'terminal_backends_execute in INTERNAL category');
  assert(internalNames.includes('voice_synthesize_live'), 'voice_synthesize_live in INTERNAL category');
}

header('3. ToolDefinitions have correct schema for LLM function calling');
{
  const allTools = orchestrator.listAllTools();
  for (const tool of allTools) {
    assert(/^[a-zA-Z0-9_-]+$/.test(tool.name), `${tool.name} is provider-safe`);
  }

  const webSearch = allTools.find((tool) => tool.name === 'web_search');
  assert(webSearch?.parameters?.properties?.query !== undefined, 'web_search has query parameter');
  assert(webSearch?.parameters?.required?.includes('query'), 'web_search query is required');
  assert(webSearch?.dangerLevel === 'safe', 'web_search dangerLevel=safe');
  assert(webSearch?.requiresPermission === false, 'web_search requiresPermission=false');

  const browserOpen = allTools.find((tool) => tool.name === 'browser_open');
  assert(browserOpen?.dangerLevel === 'moderate', 'browser_open dangerLevel=moderate');
  assert(browserOpen?.requiresPermission === true, 'browser_open requiresPermission=true');

  const browserClick = allTools.find((tool) => tool.name === 'browser_click');
  assert(browserClick?.dangerLevel === 'dangerous', 'browser_click dangerLevel=dangerous');
  assert(browserClick?.requiresPermission === true, 'browser_click requiresPermission=true');

  const workspaceCreate = allTools.find((tool) => tool.name === 'workspace_create_file');
  assert(workspaceCreate?.parameters?.properties?.filepath !== undefined, 'workspace_create_file has filepath parameter');
  assert(workspaceCreate?.requiresPermission === true, 'workspace_create_file requiresPermission=true');

  const shellRun = allTools.find((tool) => tool.name === 'shell_run_allowlisted');
  assert(shellRun?.parameters?.properties?.command !== undefined, 'shell_run_allowlisted has command parameter');
  assert(shellRun?.requiresPermission === true, 'shell_run_allowlisted requiresPermission=true');

  const mcpPreview = allTools.find((tool) => tool.name === 'mcp_preview');
  assert(mcpPreview?.dangerLevel === 'safe', 'mcp_preview dangerLevel=safe');

  const mcpExecute = allTools.find((tool) => tool.name === 'mcp_execute_quarantined');
  assert(mcpExecute?.requiresPermission === true, 'mcp_execute_quarantined requiresPermission=true');

  const hiddenScan = allTools.find((tool) => tool.name === 'capabilities_hidden_scan');
  assert(hiddenScan?.dangerLevel === 'safe', 'capabilities_hidden_scan dangerLevel=safe');
  assert(hiddenScan?.requiresPermission === false, 'capabilities_hidden_scan requiresPermission=false');

  const hiddenExpose = allTools.find((tool) => tool.name === 'capabilities_hidden_expose');
  assert(hiddenExpose?.requiresPermission === true, 'capabilities_hidden_expose requiresPermission=true');

  const externalInvoke = allTools.find((tool) => tool.name === 'agents_external_invoke');
  assert(externalInvoke?.requiresPermission === true, 'agents_external_invoke requiresPermission=true');

  const gmailSearch = allTools.find((tool) => tool.name === 'gmail_search');
  assert(gmailSearch?.requiresPermission === true, 'gmail_search requiresPermission=true');

  const docsExtract = allTools.find((tool) => tool.name === 'documents_extract');
  assert(docsExtract?.requiresPermission === false, 'documents_extract requiresPermission=false');

  const mediaGenerate = allTools.find((tool) => tool.name === 'media_image_generate');
  assert(mediaGenerate?.requiresPermission === true, 'media_image_generate requiresPermission=true');

  const memoryReview = allTools.find((tool) => tool.name === 'memory_deep_review');
  assert(memoryReview?.requiresPermission === false, 'memory_deep_review requiresPermission=false');

  const iotPublish = allTools.find((tool) => tool.name === 'devices_iot_mqtt_publish');
  assert(iotPublish?.requiresPermission === true, 'devices_iot_mqtt_publish requiresPermission=true');

  const videoGenerate = allTools.find((tool) => tool.name === 'video_generate');
  assert(videoGenerate?.requiresPermission === true, 'video_generate requiresPermission=true');

  const codeReview = allTools.find((tool) => tool.name === 'code_review');
  assert(codeReview?.requiresPermission === false, 'code_review requiresPermission=false');

  const smtpSend = allTools.find((tool) => tool.name === 'email_smtp_send');
  assert(smtpSend?.dangerLevel === 'dangerous', 'email_smtp_send dangerLevel=dangerous');
  assert(smtpSend?.requiresPermission === true, 'email_smtp_send requiresPermission=true');

  const pluginLifecycle = allTools.find((tool) => tool.name === 'plugins_sdk_lifecycle');
  assert(pluginLifecycle?.requiresPermission === true, 'plugins_sdk_lifecycle requiresPermission=true');

  const terminalExecute = allTools.find((tool) => tool.name === 'terminal_backends_execute');
  assert(terminalExecute?.dangerLevel === 'dangerous', 'terminal_backends_execute dangerLevel=dangerous');
  assert(terminalExecute?.requiresPermission === true, 'terminal_backends_execute requiresPermission=true');

  const voiceLive = allTools.find((tool) => tool.name === 'voice_synthesize_live');
  assert(voiceLive?.requiresPermission === true, 'voice_synthesize_live requiresPermission=true');
}

header('4. Direct web execution via ActionHarness pipeline');
{
  try {
    const result = await orchestrator.executePipeline(
      'pesquise sobre IA open source',
      'web_search',
      { query: 'AI open source 2026' },
      { sessionId: 'smoke-test' },
    );
    assert(result.response.includes('OK:'), 'web_search executed successfully via pipeline');
    assert(!JSON.stringify(result).match(/Authorization|Bearer|api_key/i), 'web_search leaked no credential marker');
  } catch (error) {
    fail(`web_search pipeline threw: ${error.message}`);
    failures += 1;
  }
}

header('4b. Direct workspace read execution via ActionHarness pipeline');
{
  try {
    const result = await orchestrator.executePipeline(
      'leia package.json',
      'workspace_read_file',
      { filepath: 'package.json' },
      { sessionId: 'smoke-test' },
    );
    assert(result.response.includes('OK:'), 'workspace_read_file executed successfully via pipeline');
    assert(!JSON.stringify(result).match(/Authorization|Bearer|api_key/i), 'workspace read leaked no credential marker');
  } catch (error) {
    fail(`workspace_read_file pipeline threw: ${error.message}`);
    failures += 1;
  }
}

header('4c. Approval-gated shell execution remains blocked without approval');
{
  try {
    const result = await orchestrator.executePipeline(
      'rode git status',
      'shell_run_allowlisted',
      { command: 'git status' },
      { sessionId: 'smoke-test' },
    );
    assert(result.response.includes('FALHA') && result.response.includes('requires user approval'), 'shell_run_allowlisted requires approval');
  } catch (error) {
    fail(`shell_run_allowlisted approval test threw: ${error.message}`);
    failures += 1;
  }
}

header('4d. MCP preview stays non-executing');
{
  try {
    const result = await orchestrator.executePipeline(
      'preview mcp',
      'mcp_preview',
      { server: 'docs', tool: 'search' },
      { sessionId: 'smoke-test' },
    );
    assert(result.response.includes('OK:'), 'mcp_preview executes as non-live preview/read action');
    assert(JSON.stringify(result).includes('"executionEnabled":false'), 'mcp_preview reports execution disabled');
  } catch (error) {
    fail(`mcp_preview test threw: ${error.message}`);
    failures += 1;
  }
}

header('4e. New high-risk tools remain approval-gated');
{
  try {
    const click = await orchestrator.executePipeline(
      'clique no botao',
      'browser_click',
      { selector: 'button[type="submit"]' },
      { sessionId: 'smoke-test' },
    );
    assert(click.response.includes('FALHA') && click.response.includes('requires user approval'), 'browser_click requires approval');

    const send = await orchestrator.executePipeline(
      'envie mensagem',
      'channels_send_approved',
      { channel: 'slack', message: 'hello' },
      { sessionId: 'smoke-test' },
    );
    assert(send.response.includes('FALHA') && send.response.includes('requires user approval'), 'channels_send_approved requires approval');

    const mcpExecute = await orchestrator.executePipeline(
      'execute mcp',
      'mcp_execute_quarantined',
      { server: 'docs', tool: 'search', args: {} },
      { sessionId: 'smoke-test' },
    );
    assert(mcpExecute.response.includes('FALHA') && mcpExecute.response.includes('requires user approval'), 'mcp_execute_quarantined requires approval');

    const expose = await orchestrator.executePipeline(
      'exponha a capacidade de skills',
      'capabilities_hidden_expose',
      { id: 'skills.absorption' },
      { sessionId: 'smoke-test' },
    );
    assert(expose.response.includes('FALHA') && expose.response.includes('requires user approval'), 'capabilities_hidden_expose requires approval');

    const absorb = await orchestrator.executePipeline(
      'absorva skill',
      'skills_absorb',
      { sourcePath: 'skills/example', dryRun: true },
      { sessionId: 'smoke-test' },
    );
    assert(absorb.response.includes('FALHA') && absorb.response.includes('requires user approval'), 'skills_absorb requires approval');

    const invoke = await orchestrator.executePipeline(
      'chame agente externo',
      'agents_external_invoke',
      { profileId: 'codex', prompt: 'status' },
      { sessionId: 'smoke-test' },
    );
    assert(invoke.response.includes('FALHA') && invoke.response.includes('requires user approval'), 'agents_external_invoke requires approval');

    const workflow = await orchestrator.executePipeline(
      'rode workflow',
      'workflows_run',
      { script: 'qa:zavorth-capability-usage-docs' },
      { sessionId: 'smoke-test' },
    );
    assert(workflow.response.includes('FALHA') && workflow.response.includes('requires user approval'), 'workflows_run requires approval');

    const gmail = await orchestrator.executePipeline(
      'pesquise meu gmail',
      'gmail_search',
      { query: 'zavorth' },
      { sessionId: 'smoke-test' },
    );
    assert(gmail.response.includes('FALHA') && gmail.response.includes('requires user approval'), 'gmail_search requires approval');

    const image = await orchestrator.executePipeline(
      'gere imagem',
      'media_image_generate',
      { prompt: 'native power pack' },
      { sessionId: 'smoke-test' },
    );
    assert(image.response.includes('FALHA') && image.response.includes('requires user approval'), 'media_image_generate requires approval');

    const canvas = await orchestrator.executePipeline(
      'render canvas',
      'canvas_render',
      { title: 'Smoke', content: 'Native power packs' },
      { sessionId: 'smoke-test' },
    );
    assert(canvas.response.includes('FALHA') && canvas.response.includes('requires user approval'), 'canvas_render requires approval');

    const computerVision = await orchestrator.executePipeline(
      'veja tela',
      'computer_vision',
      { task: 'describe screen' },
      { sessionId: 'smoke-test' },
    );
    assert(computerVision.response.includes('FALHA') && computerVision.response.includes('requires user approval'), 'computer_vision requires approval');

    const iotPublish = await orchestrator.executePipeline(
      'publique mqtt',
      'devices_iot_mqtt_publish',
      { topic: 'zavorth/smoke', message: 'hello' },
      { sessionId: 'smoke-test' },
    );
    assert(iotPublish.response.includes('FALHA') && iotPublish.response.includes('requires user approval'), 'devices_iot_mqtt_publish requires approval');

    const video = await orchestrator.executePipeline(
      'gere video',
      'video_generate',
      { prompt: 'smoke video' },
      { sessionId: 'smoke-test' },
    );
    assert(video.response.includes('FALHA') && video.response.includes('requires user approval'), 'video_generate requires approval');

    const email = await orchestrator.executePipeline(
      'envie email',
      'email_smtp_send',
      { to: 'dest@example.com', subject: 'Smoke', body: 'Hello' },
      { sessionId: 'smoke-test' },
    );
    assert(email.response.includes('FALHA') && email.response.includes('requires user approval'), 'email_smtp_send requires approval');

    const database = await orchestrator.executePipeline(
      'query sqlite',
      'database_sqlite_query',
      { query: 'SELECT 1 AS value' },
      { sessionId: 'smoke-test' },
    );
    assert(database.response.includes('FALHA') && database.response.includes('requires user approval'), 'database_sqlite_query requires approval');
  } catch (error) {
    fail(`high-risk approval smoke threw: ${error.message}`);
    failures += 1;
  }
}

header('5. SSRF protection still works through adapter path');
{
  try {
    const result = await orchestrator.executePipeline(
      'fetch this url',
      'web_fetch_url',
      { url: 'http://127.0.0.1/secret' },
      { sessionId: 'smoke-test' },
    );
    assert(result.response.includes('FALHA') || result.response.includes('BLOCO'), 'SSRF blocked through adapter pipeline path');
  } catch (error) {
    fail(`SSRF test threw: ${error.message}`);
    failures += 1;
  }
}

console.log('');
if (failures === 0) {
  console.log(`${GREEN}${BOLD}ok LLM tool-calling integration operational for verified Action Harness surface.${RESET}`);
} else {
  console.log(`${RED}${BOLD}no ${failures} check(s) failed.${RESET}`);
  process.exit(1);
}
