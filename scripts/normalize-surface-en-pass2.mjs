/**
 * Pass 2: remaining shared-surface user-facing Portuguese → English.
 * Skips pure NLP regex lines (does not rewrite /\b.../ patterns).
 */
import fs from 'node:fs';
import path from 'node:path';

const pairs = [
  // Errors / failures
  ['Nao consegui determinar o plugin ou a acao desejada nesse fluxo guiado.', 'Could not determine the plugin or desired action for this guided flow.'],
  ['Nao consegui abrir o fluxo guiado desse plugin agora.', 'Could not open the guided flow for this plugin right now.'],
  ['Nao encontrei plugins suficientes para instalar nesse passo.', 'Not enough plugins to install in this step.'],
  ['Nao consegui executar a acao do hub agora.', 'Could not run the hub action right now.'],
  ['Nao consegui determinar o transporte ou a acao desejada nesse fluxo guiado.', 'Could not determine the transport or desired action for this guided flow.'],
  ['Nao consegui abrir o fluxo guiado desse transporte agora.', 'Could not open the guided flow for this transport right now.'],
  ['Nao encontrei transportes suficientes para preparar nesse passo.', 'Not enough transports to prepare in this step.'],
  ['Nao consegui preparar o ZavorthBridge para uso no celular agora.', 'Could not prepare ZavorthBridge for mobile use right now.'],
  ['Nao encontrei um workflow recente com esse contexto. Use /workflow resume <wf-id> se quiser ser mais explicito.', 'No recent workflow matched this context. Use /workflow resume <wf-id> if you want to be more explicit.'],
  ['Nao consegui operar o workflow agora.', 'Could not operate the workflow right now.'],
  ['Nao encontrei essa permissao.', 'Permission not found.'],
  ['Nao consegui operar o selfmod agora.', 'Could not operate selfmod right now.'],
  ['Nao encontrei tenant para "', 'No tenant found for "'],
  ['Use /tenants para ver a governanca completa observada pelo runtime.', 'Use /tenants to see full governance observed by the runtime.'],
  ['Nao encontrei um team com id "', 'No team found with id "'],
  ['Use /teams para ver os fluxos compostos disponiveis.', 'Use /teams to see available composite flows.'],
  ['Nao consegui executar a acao guiada do tenant agora.', 'Could not run the guided tenant action right now.'],

  // Status / UI labels
  ['aguardando approval.', 'awaiting approval.'],
  ['CLI pronto:', 'CLI ready:'],
  ["'sim'", "'yes'"],
  ["'nao'", "'no'"],
  ['Transportes remotos prontos:', 'Ready remote transports:'],
  ['Codex Remote segue no modo full-user-visible: a aprovacao aparece nesta mesma surface.', 'Codex Remote stays full-user-visible: approval appears on this same surface.'],
  ['prontos no Channel Mesh', 'ready on Channel Mesh'],
  ['modos prontos', 'modes ready'],
  ['Transportes:', 'Transports:'],
  ['prontos:', 'ready:'],
  ['em preparo:', 'partial:'],
  ['desativados:', 'disabled:'],
  ['QR pronto: use a imagem no zavorthControl/API local para escanear com seguranca.', 'QR ready: use the image in local zavorthControl/API to scan safely.'],
  ['- QR pronto: use a imagem no zavorthControl/API local para escanear com seguranca.', '- QR ready: use the image in local zavorthControl/API to scan safely.'],
  ["Approval: pendente.", 'Approval: pending.'],
  ['Core pronto:', 'Core ready:'],
  ['Extensoes prontas:', 'Extensions ready:'],
  ['Pendentes:', 'Pending:'],
  ['publicos:', 'public:'],
  ['shared prontos:', 'shared ready:'],

  // Presentation help
  ['Pedidos naturais como "mostre as permissoes pendentes" e "aprove a permissao perm-123" agora tambem abrem o permission plane.', 'Natural requests like "show pending permissions" and "approve permission perm-123" also open the permission plane.'],
  ['Pedidos naturais como "aprove a tarefa task-123", "aprove a ultima tarefa pendente" e "rejeite a tarefa de onboarding do discord" agora usam o fluxo canonico de task approval.', 'Natural requests like "approve task task-123", "approve the latest pending task", and "reject the discord onboarding task" now use the canonical task approval flow.'],
  ['/approve <task_id> e /reject <task_id> para decidir tarefas pendentes no fluxo canonico.', '/approve <task_id> and /reject <task_id> to decide pending tasks in the canonical flow.'],

  // Watch mode usage
  ["'Uso:'", "'Usage:'"],
  ['Uso:', 'Usage:'],

  // Task NL
  ['mais recente com approval pendente', 'latest with pending approval'],

  // Access pack leftovers (status ternary labels sometimes remain as ready/pending)
  ['Dependencias:', 'Dependencies:'],
  ['Local:', 'Local:'],
  ['Remoto:', 'Remote:'],
  ['Caminho remoto oficial:', 'Official remote path:'],
  ['Acesso remoto oficial:', 'Official remote access:'],
  ['Ao vivo:', 'Live:'],

  // Generic remaining
  ['Nao consegui ', 'Could not '],
  ['Nao encontrei ', 'Could not find '],
  [' agora.', ' right now.'],
];

const root = 'src/domain/surface/presentation/shared-surface';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;
const report = [];

for (const file of walk(root)) {
  // Keep NLP-only support files: only rewrite reply/error strings, not regex sources.
  // Still apply pairs carefully — regex alternations with PT words stay if not in pairs.
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  let n = 0;
  for (const [from, to] of pairs) {
    if (!text.includes(from)) continue;
    const count = text.split(from).length - 1;
    text = text.split(from).join(to);
    n += count;
  }
  if (text !== orig) {
    fs.writeFileSync(file, text);
    filesChanged += 1;
    replacements += n;
    report.push({ file, n });
  }
}

console.log(JSON.stringify({ filesChanged, replacements, report }, null, 2));
