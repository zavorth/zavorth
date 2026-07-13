/**
 * Normalize Portuguese mock fixtures in tests to English (pass-through expectations).
 * Does not change NLP tests that intentionally assert bilingual understanding.
 */
import fs from 'node:fs';
import path from 'node:path';

const pairs = [
  ["'Automacao criada com entrega no app.'", "'Automation created with in-app delivery.'"],
  ['Automacao criada com entrega no app.', 'Automation created with in-app delivery.'],
  ["'Gateway pronto.'", "'Gateway ready.'"],
  ['Gateway pronto.', 'Gateway ready.'],
  ["'Node Mesh pronto.'", "'Node Mesh ready.'"],
  ['Node Mesh pronto.', 'Node Mesh ready.'],
  ["'Surface domain pronto'", "'Surface domain ready'"],
  ['Surface domain pronto', 'Surface domain ready'],
  ["'Gateway pronto via dominio.'", "'Gateway ready via domain.'"],
  ['Gateway pronto via dominio.', 'Gateway ready via domain.'],
  ["'Registry pronto.'", "'Registry ready.'"],
  ['Registry pronto.', 'Registry ready.'],
  ["'Ecossistema pronto.'", "'Ecosystem ready.'"],
  ['Ecossistema pronto.', 'Ecosystem ready.'],
  ["'Session plane pronto.'", "'Session plane ready.'"],
  ['Session plane pronto.', 'Session plane ready.'],
  ["'Memory plane pronto.'", "'Memory plane ready.'"],
  ['Memory plane pronto.', 'Memory plane ready.'],
  ["'Platform plane pronto.'", "'Platform plane ready.'"],
  ['Platform plane pronto.', 'Platform plane ready.'],
  ["'Channel mesh pronto.'", "'Channel mesh ready.'"],
  ['Channel mesh pronto.', 'Channel mesh ready.'],
  ["'Node pronto.'", "'Node ready.'"],
  ['Node pronto.', 'Node ready.'],
  ["'Transport pronto.'", "'Transport ready.'"],
  ['Transport pronto.', 'Transport ready.'],
  ["'Remote transports prontos.'", "'Remote transports ready.'"],
  ['Remote transports prontos.', 'Remote transports ready.'],
  ["'Security mesh pronto.'", "'Security mesh ready.'"],
  ['Security mesh pronto.', 'Security mesh ready.'],
  ["'Catalog sync pronto.'", "'Catalog sync ready.'"],
  ['Catalog sync pronto.', 'Catalog sync ready.'],
  ["'1 pendente.'", "'1 pending.'"],
  ['1 pendente.', '1 pending.'],
  ["'1 pendente de onboarding.'", "'1 pending onboarding.'"],
  ['1 pendente de onboarding.', '1 pending onboarding.'],
  ["'1 compartilhado | 1 pendente de onboarding'", "'1 shared | 1 pending onboarding'"],
  ['1 compartilhado | 1 pendente de onboarding', '1 shared | 1 pending onboarding'],
  ["'Providers prontos agora'", "'Providers ready now'"],
  ['Providers prontos agora', 'Providers ready now'],
  ["'Remoto do ZavorthBridge pronto para celular via LAN.'", "'ZavorthBridge remote ready for mobile via LAN.'"],
  ['Remoto do ZavorthBridge pronto para celular via LAN.', 'ZavorthBridge remote ready for mobile via LAN.'],
  ["'Fila: 0 pendente(s) / 0 claimed.'", "'Queue: 0 pending / 0 claimed.'"],
  ['Fila: 0 pendente(s) / 0 claimed.', 'Queue: 0 pending / 0 claimed.'],
  ["'Mutacao fica pendente'", "'Mutation stays pending'"],
  ['Mutacao fica pendente', 'Mutation stays pending'],
  ["'Uma automacao ativa.'", "'One active automation.'"],
  ["'Rotina diaria registrada.'", "'Daily routine registered.'"],
  ["'Aguardar a primeira execucao.'", "'Wait for the first run.'"],
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, out);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      out.push(p);
    }
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;
for (const file of walk('tests')) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  let n = 0;
  for (const [from, to] of pairs) {
    if (!text.includes(from)) continue;
    const c = text.split(from).length - 1;
    text = text.split(from).join(to);
    n += c;
  }
  if (text !== orig) {
    fs.writeFileSync(file, text);
    filesChanged += 1;
    replacements += n;
    console.log(file, n);
  }
}
console.log(JSON.stringify({ filesChanged, replacements }, null, 2));
