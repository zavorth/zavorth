const fs = require('fs');
const path = require('path');

const testFiles = fs.readdirSync('tests/tools')
  .filter(f => f.endsWith('.test.ts') && (f.startsWith('Zavorth') || f.startsWith('Memory') || f.startsWith('Diagnostics') || f.startsWith('Achievements') || f.startsWith('Skin') || f.startsWith('Trajectory') || f.startsWith('Kanban') || f.startsWith('Active') || f.startsWith('High') || f.startsWith('Medium') || f.startsWith('Low') || f.startsWith('Tools') || f.startsWith('Plugins')))
  .map(f => path.join('tests/tools', f));

const replacements = [
  ["'Erro'", "'Error'"],
  ["'invalido'", "'invalid'"],
  ["'enviada'", "'sent'"],
  ["'ja existe'", "'already exists'"],
  ["'atualizado'", "'updated'"],
  ["'cancelada'", "'cancelled'"],
  ["'pendente'", "'pending'"],
  ["'desabilitado'", "'disabled'"],
  ["'DESABILITADO'", "'DISABLED'"],
  ["'maximo'", "'maximum'"],
  ["'Nenhum resultado'", "'No results'"],
  ["'1 resultado'", "'1 result'"],
  ["'Politicas'", "'Policies'"],
  ["'Auditoria'", "'Audit'"],
  ["'Teste'", "'Test'"],
  ["'criada'", "'created'"],
  ["'delegada'", "'delegated'"],
  ["'Nenhuma'", "'No'"],
  ["'nenhuma'", "'none'"],
  ["'nenhum'", "'none'"],
  ["'criado'", "'created'"],
  ["'deletado'", "'deleted'"],
  ["'deletada'", "'deleted'"],
  ["'atualizada'", "'updated'"],
  ["'habilitado'", "'enabled'"],
  ["'habilitada'", "'enabled'"],
  ["'desabilitada'", "'disabled'"],
  ["'adicionado'", "'added'"],
  ["'adicionada'", "'added'"],
  ["'movido'", "'moved'"],
  ["'bloqueado'", "'blocked'"],
  ["'desbloqueado'", "'unblocked'"],
  ["'registrado'", "'recorded'"],
  ["'Memorizado'", "'Remembered'"],
  ["'esquecida'", "'forgotten'"],
  ["'promovida'", "'promoted'"],
  ["'rebaixada'", "'demoted'"],
  ["'Consolidacao'", "'Consolidation'"],
  ["'Sessao'", "'Session'"],
  ["'Voz'", "'Voice'"],
  ["'Perfil'", "'Profile'"],
  ["'Memoria'", "'Memory'"],
  ["'Colecao'", "'Collection'"],
  ["'Tarefa'", "'Task'"],
  ["'Quadro'", "'Board'"],
  ["'Cartao'", "'Card'"],
  ["'Estatisticas'", "'Statistics'"],
  ["'Verificacao'", "'Verification'"],
  ["'Rodando'", "'Running'"],
  ["'Pendentes'", "'Pending'"],
  ["'Completas'", "'Completed'"],
  ["'Falharam'", "'Failed'"],
  ["'Canceladas'", "'Cancelled'"],
  ["'Configurado'", "'Configured'"],
  ["'Conectado'", "'Connected'"],
  ["'agendados'", "'scheduled'"],
  ["'duracao'", "'duration'"],
  ["'Duracao'", "'Duration'"],
  ["'resultado'", "'result'"],
  ["'falha'", "'failure'"],
  ["'invalida'", "'invalid'"],
  ["'nenhuma'", "'none'"],
  ["'nenhum'", "'none'"],
  ["'Nenhum'", "'No'"],
  ["'Nenhuma'", "'No'"],
  ["'1 dias'", "'1 days'"],
  ["'instalado'", "'installed'"],
  ["'removido'", "'removed'"],
  ["'removida'", "'removed'"],
  ["'adicionada'", "'added'"],
  ["'desabilitada'", "'disabled'"],
  ["'Flush completo'", "'Flush complete'"],
  ["'completos'", "'complete'"],
  ["'confianca'", "'confidence'"],
  ["'documentos'", "'documents'"],
  ["'colecoes'", "'collections'"],
  ["'inserido'", "'inserted'"],
  ["'deletado'", "'deleted'"],
  ["'deletada'", "'deleted'"],
  ["'nao encontrado'", "'not found'"],
  ["'nao encontrada'", "'not found'"],
  ["'Erro no'", "'Error in'"],
  ["'Erro:'", "'Error:'"],
];

let totalFixed = 0;
for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    totalFixed++;
    console.log('Fixed:', path.basename(file));
  }
}
console.log('\nTotal test files fixed:', totalFixed);
