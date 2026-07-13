import fs from 'node:fs';
import path from 'node:path';

const root = 'src/domain/surface/presentation/shared-surface';
const map = [
  ["errorMessage(error, 'Could not build the Desktop Resource Plane right now.')", "errorMessage(error, tSurface('error_desktop_plane'))"],
  ["errorMessage(error, 'Could not resolve mode escalation right now.')", "errorMessage(error, tSurface('error_mode_escalation'))"],
  ["errorMessage(error, 'Could not change the product mode right now.')", "errorMessage(error, tSurface('error_product_mode'))"],
  ["errorMessage(error, 'Could not operate the Workspace Optimizer right now.')", "errorMessage(error, tSurface('error_workspace_optimizer'))"],
  ["errorMessage(error, 'Could not operate the Companion Control Plane right now.')", "errorMessage(error, tSurface('error_companion_plane'))"],
  ["errorMessage(error, 'Could not operate the AI Gateway right now.')", "errorMessage(error, tSurface('error_ai_gateway'))"],
  ["errorMessage(error, 'Could not run the plugin plane action right now.')", "errorMessage(error, tSurface('error_plugin_plane'))"],
  ["errorMessage(error, 'Could not run the Channel Mesh action right now.')", "errorMessage(error, tSurface('error_channel_mesh'))"],
  ["errorMessage(error, 'Could not run the remote plane action right now.')", "errorMessage(error, tSurface('error_remote_plane'))"],
  ["errorMessage(error, 'Could not build the learning plane right now.')", "errorMessage(error, tSurface('error_learning_plane'))"],
  ["errorMessage(error, 'Could not build the memory plane right now.')", "errorMessage(error, tSurface('error_memory_plane'))"],
  ["errorMessage(error, 'Could not query layered memory right now.')", "errorMessage(error, tSurface('error_layered_memory'))"],
  ["errorMessage(error, 'Could not build the session plane right now.')", "errorMessage(error, tSurface('error_session_plane'))"],
  ["errorMessage(error, 'Could not prepare ZavorthBridge for mobile use right now.')", "errorMessage(error, tSurface('error_bridge_mobile'))"],
  ["errorMessage(error, 'Could not run the guided tenant action right now.')", "errorMessage(error, tSurface('error_tenant_action'))"],
  ["errorMessage(error, 'Could not operate Codex Remote right now.')", "errorMessage(error, tSurface('error_codex_remote'))"],
  ["errorMessage(error, 'Could not open the guided flow for this plugin right now.')", "errorMessage(error, tSurface('error_plugin_flow'))"],
  ["errorMessage(error, 'Could not open the guided flow for this transport right now.')", "errorMessage(error, tSurface('error_transport_flow'))"],
  ["errorMessage(error, 'Could not open the guided flow for this channel right now.')", "errorMessage(error, tSurface('error_channel_flow'))"],
  ["'Could not build the session plane right now.'", "tSurface('error_session_plane')"],
  ["message || 'Could not run the hub action right now.'", "message || tSurface('error_hub_action')"],
  ["'Approval: pending.'", "tSurface('approval_pending')"],
  ["'Permission not found.'", "tSurface('permission_not_found')"],
  [
    "`Capability ${input.label} awaiting approval.`",
    "tSurface('capability_awaiting', { label: input.label })",
  ],
  [
    "'No recent workflow matched this context. Use /workflow resume <wf-id> if you want to be more explicit.'",
    "tSurface('no_recent_workflow')",
  ],
];

const importLine = "import { tSurface } from '../../../../i18n/surface.js';";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  let used = false;
  for (const [from, to] of map) {
    if (!text.includes(from)) continue;
    text = text.split(from).join(to);
    used = true;
  }
  if (!used || text === orig) continue;

  if (!text.includes("i18n/surface.js")) {
    const lines = text.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
      text = lines.join('\n');
    }
  }

  fs.writeFileSync(file, text);
  changed += 1;
  console.log('updated', file);
}
console.log(JSON.stringify({ files: changed }, null, 2));
