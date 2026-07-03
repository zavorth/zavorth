import pc from 'picocolors';
import figlet from 'figlet';

// Configuração de Cores "Zavorth/Amber"
const theme = {
  primary: pc.yellow,
  secondary: (text: string) => pc.yellow(pc.dim(text)),
  accent: pc.cyan,
  dim: pc.dim,
  error: pc.red,
  success: pc.green
};

// Box Drawing Characters
const box = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
  ls: '├', rs: '┤', ts: '┬', bs: '┴', cs: '┼'
};

function renderHeader() {
  console.clear();
  
  // Renderizar o nome ZAVORTH usando figlet
  const logo = figlet.textSync('ZAVORTH-OS', {
    font: 'Slant',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });
  
  // Aplicar um efeito de degradê/sombra amarela no logo
  console.log(theme.primary(logo));
}

function renderMainInterface() {
  const width = process.stdout.columns || 100;
  
  // Linha superior com versão
  const versionInfo = ` Zavorth OS v1.1.0 (2026.05.13) • upstream 8a9b2c3 `;
  const topBar = theme.secondary(box.h.repeat((width - versionInfo.length) / 2)) 
               + theme.primary(versionInfo) 
               + theme.secondary(box.h.repeat((width - versionInfo.length) / 2));
  console.log(topBar);

  // Escudo ASCII esquerdo (estilo Zavorth mark)
  const shield = [
    `       .█████.       `,
    `      █████████      `,
    `  .███████████████.  `,
    ` ▀▀███████████████▀▀ `,
    `      █████████      `,
    `       ▀█████▀       `,
    `         ███         `,
    `         ███         `,
    `        .███.        `,
  ];

  // Ferramentas e Habilidades (Coluna Direita)
  const capabilities = [
    theme.primary('Available Capabilities (Gateways)'),
    `  policy: ${theme.dim('broker_check, receipt_issue, vault_access')}`,
    `  mesh:   ${theme.dim('telegram_send, whatsapp_notify, satellite_ping')}`,
    `  exec:   ${theme.dim('stitch_run, bash_sandboxed, apply_patch')}`,
    `  vision: ${theme.dim('browser_cdp, computer_use, screen_capture')}`,
    `  ${theme.dim('(and 8 more capabilities...)')}`,
    ``,
    theme.primary('Available Subagents (Skills)'),
    `  trust-plane:  ${theme.dim('policy-broker, cognitive-firewall')}`,
    `  development:  ${theme.dim('coder, qa-auditor, repo-map')}`,
    `  security:     ${theme.dim('prompt-injection-defense, code-review')}`,
    `  ops:          ${theme.dim('incident-triage, zavorthControl-ops')}`,
    `  research:     ${theme.dim('document-analysis, web-research-governed')}`,
    ``,
    `  ${theme.dim('24 tools • 5 profiles • /help for commands')}`
  ];

  // Imprimir Lado a Lado
  const maxLines = Math.max(shield.length, capabilities.length);
  for (let i = 0; i < maxLines; i++) {
    const left = shield[i] || '                     ';
    const right = capabilities[i] || '';
    
    // Adicionando informações da sessão abaixo do escudo
    let leftInfo = '';
    if (i === shield.length + 1) leftInfo = theme.primary('mode: governed-dev');
    if (i === shield.length + 2) leftInfo = theme.secondary('user: zavorth-owner');
    if (i === shield.length + 3) leftInfo = theme.dim('session: 20260513_1502');

    console.log(`  ${theme.secondary(left)}   ${leftInfo.padEnd(30)} ${right}`);
  }

  // Linha Separadora
  console.log(theme.secondary(box.h.repeat(width)));
}

function renderChatArea() {
  console.log(theme.dim('Welcome to Zavorth OS! Type your command or /help.'));
  console.log(theme.accent('✦ Tip: Run `zavorth doctor --advanced` to verify sandbox integrity.\n'));
  
  console.log(theme.primary('▲ Policy Broker enabled: All mutating actions require visual receipts.'));
  console.log(theme.secondary('----------------------------------------------------------------------\n'));
  
  console.log(theme.primary('● user'));
  console.log('Implement a new JWT validation middleware.\n');
  
  console.log(theme.secondary(box.h.repeat(30)));
  
  console.log(theme.primary('⚡ Zavorth (Planner)'));
  console.log('Understood. I will plan the implementation and request an audit before writing to the workspace.\n');
}

function renderStatusBar() {
  const width = process.stdout.columns || 100;
  
  const statusParts = [
    ` ⚡ ${theme.primary('zavorth-v1')}`,
    theme.secondary(' | '),
    theme.dim('budget: '),
    theme.success('$0.04/$5.00'),
    theme.secondary(' | '),
    `[${theme.primary('████████          ')}] 45%`,
    theme.secondary(' | '),
    theme.dim('12s'),
    theme.secondary(' | '),
    theme.dim('mem: 45MB ')
  ];
  
  const statusStr = statusParts.join('');
  const rawLength = statusStr.replace(/\x1b\[\d+m/g, '').length; // Remove ANSI color codes for length calc
  
  console.log(theme.secondary(box.ls + box.h.repeat(width - 2) + box.rs));
  console.log(statusStr);
  console.log(theme.secondary(box.bl + box.h.repeat(width - 2) + box.br));
  
  // Prompt input line
  process.stdout.write(theme.primary('❯ '));
}

// Executar
renderHeader();
renderMainInterface();
renderChatArea();
renderStatusBar();
