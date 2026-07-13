/**
 * One-shot: normalize high-visibility Portuguese user-facing strings to English.
 * Does NOT touch NLP regex files / intentional bilingual heuristics.
 */
import fs from 'node:fs';
import path from 'node:path';

const pairs = [
  ['Nao consegui processar learn-skill agora.', 'Could not process learn-skill right now.'],
  ['Nao consegui montar o Desktop Resource Plane agora.', 'Could not build the Desktop Resource Plane right now.'],
  ['Nao consegui resolver o mode escalation agora.', 'Could not resolve mode escalation right now.'],
  ['Nao consegui trocar o product mode agora.', 'Could not change the product mode right now.'],
  ['Nao consegui operar o Workspace Optimizer agora.', 'Could not operate the Workspace Optimizer right now.'],
  ['Nao consegui operar o Companion Control Plane agora.', 'Could not operate the Companion Control Plane right now.'],
  ['Nao consegui operar o AIGateway agora.', 'Could not operate the AI Gateway right now.'],
  ['Nao consegui executar a acao do plugin plane agora.', 'Could not run the plugin plane action right now.'],
  ['Nao consegui executar a acao do Channel Mesh agora.', 'Could not run the Channel Mesh action right now.'],
  ['Nao consegui executar a acao do plano remoto agora.', 'Could not run the remote plane action right now.'],
  ['Nao consegui montar o learning plane agora.', 'Could not build the learning plane right now.'],
  ['Nao consegui montar o memory plane agora.', 'Could not build the memory plane right now.'],
  ['Nao consegui consultar a layered memory agora.', 'Could not query layered memory right now.'],
  [
    'Nao consegui determinar o canal ou a acao desejada nesse fluxo guiado.',
    'Could not determine the channel or desired action for this guided flow.',
  ],
  ['Nao consegui abrir o fluxo guiado desse canal agora.', 'Could not open the guided flow for this channel right now.'],
  ['Nao encontrei um plano de setup para', 'Could not find a setup plan for'],
  ['Nao consegui resolver o modo de setup de', 'Could not resolve the setup mode for'],
  ['Nao encontrei canais suficientes para preparar nesse passo.', 'Not enough channels to prepare in this step.'],
  ['Nao encontrei perfis suficientes para preparar nesse passo.', 'Not enough profiles to prepare in this step.'],
  ['Nao consegui operar o Codex Remote agora.', 'Could not operate Codex Remote right now.'],
  ['Nao consegui montar o preview', 'Could not build the preview'],
  ['Nao encontrei esse preview. Gere um novo antes de aplicar.', 'Preview not found. Generate a new one before applying.'],
  [
    'Esse preview foi gerado por outro usuario autorizado e nao pode ser aplicado aqui.',
    'This preview was created by another authorized user and cannot be applied here.',
  ],
  ['Esse preview expirou. Gere um novo antes de aplicar.', 'This preview expired. Generate a new one before applying.'],
  ['Nao consegui aplicar esse preview.', 'Could not apply this preview.'],
  ['Nao consegui concluir o rollback.', 'Could not complete the rollback.'],
  [
    'Nao consegui identificar qual permissao voce queria aprovar.',
    'Could not identify which permission you wanted to approve.',
  ],
  [
    'Nao consegui identificar qual tarefa voce queria retomar.',
    'Could not identify which task you wanted to resume.',
  ],
  [
    'Nao consegui identificar qual workflow voce queria retomar.',
    'Could not identify which workflow you wanted to resume.',
  ],
  [
    'Nao consegui identificar qual etapa do workflow voce queria reiniciar.',
    'Could not identify which workflow step you wanted to restart.',
  ],
  [
    'Nao consegui identificar qual workflow voce queria encerrar.',
    'Could not identify which workflow you wanted to stop.',
  ],
  ['Nao consegui gerar um plano automatico de autoreparo:', 'Could not generate an automatic auto-repair plan:'],
  ['Nao consegui gerar o preview seguro do patch:', 'Could not generate a safe patch preview:'],
  ['Nao consegui identificar os dois arquivos para comparar.', 'Could not identify the two files to compare.'],
  ['Nao consegui encerrar o workflow', 'Could not stop the workflow'],
  ['erro desconhecido', 'unknown error'],
  ['nenhuma variavel obrigatoria pendente', 'no required variables pending'],
  ['Aprovacoes do Codex Remote', 'Codex Remote approvals'],
  ['Nenhuma aprovacao pendente no momento.', 'No pending approvals at the moment.'],
  ['aprovacoes pendentes:', 'pending approvals:'],
  ['Mode escalation pendente:', 'Pending mode escalation:'],
  ["'pronto'", "'ready'"],
  ["'pendente'", "'pending'"],
  ["'validado'", "'validated'"],
  ["'ausente'", "'missing'"],
  ['nao configurado', 'not configured'],
  ['npm install pendente', 'npm install pending'],
  ['Nenhum passo pendente. O bootstrap esta fechado.', 'No pending steps. Bootstrap is complete.'],
  ['Etapas oficiais ainda pendentes:', 'Official steps still pending:'],
  [
    'Nenhum bloqueio foi encontrado pelos adapters read-only atuais.',
    'No blockers found by the current read-only adapters.',
  ],
  [
    'O arquivo mudou desde que o preview foi gerado. Para evitar aplicar um patch obsoleto, gere um preview novo.',
    'The file changed since the preview was generated. Generate a new preview to avoid applying a stale patch.',
  ],
  ['Gere um novo changeset antes de aplicar.', 'Generate a new changeset before applying.'],
  [
    'Informe dois caminhos entre aspas ou caminhos absolutos.',
    'Provide two quoted paths or absolute paths.',
  ],
  ['Motivo:', 'Reason:'],
  ['atencao:', 'attention:'],
  ['pendencias:', 'pending:'],
  ['Candidatos:', 'Candidates:'],
  ['pendentes:', 'pending:'],
  ['aprovados:', 'approved:'],
  ['Replay visivel:', 'Visible replay:'],
  ['tarefa(s)', 'task(s)'],
  ['workflow(s)', 'workflow(s)'],
  ['Ultimo erro:', 'Last error:'],
  ['sem erro recente', 'no recent error'],
  ['Ao vivo:', 'Live:'],
  ['alcancaveis por endpoint:', 'endpoint-reachable:'],
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

function applyPairs(file) {
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
    return n;
  }
  return 0;
}

const roots = [
  'src/domain/surface/presentation/shared-surface',
  'src/services/selfmod-command',
];
const extraFiles = [
  'src/services/ComposerActionService.ts',
  'src/services/AutoRepairService.ts',
  'src/services/EngineeringCoreService.ts',
  'src/services/FileInspectionService.ts',
  'src/services/MultiAgentPipeline.ts',
  'src/services/CapabilityAutopilotReadinessService.ts',
];

let filesChanged = 0;
let replacements = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    // Skip natural-language intent / channel helpers that intentionally speak PT for UX flows?
    // Natural packs still have operator replies - convert for consistency.
    const n = applyPairs(file);
    if (n > 0) {
      filesChanged += 1;
      replacements += n;
    }
  }
}

for (const file of extraFiles) {
  const n = applyPairs(file);
  if (n > 0) {
    filesChanged += 1;
    replacements += n;
  }
}

console.log(JSON.stringify({ filesChanged, replacements }, null, 2));
