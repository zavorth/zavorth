import { TerminalTheme } from '../src/cli/presentation/TerminalTheme.js';
import { TerminalSpinner } from '../src/cli/presentation/TerminalSpinner.js';
import { TerminalPanel } from '../src/cli/presentation/TerminalPanel.js';
import { TerminalMarkdown } from '../src/cli/presentation/TerminalMarkdown.js';
import { TerminalDiff } from '../src/cli/presentation/TerminalDiff.js';
import { TerminalPrompt } from '../src/cli/presentation/TerminalPrompt.js';
import chalk from 'chalk';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.clear();

  // 1. Title/Header
  const header = `
â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•— â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•— â–ˆâ–ˆâ•—   â–ˆâ–ˆâ•— â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•— â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•— â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•—â–ˆâ–ˆâ•—  â–ˆâ–ˆâ•—
â•šâ•â•â–ˆâ–ˆâ–ˆâ•”â•â–ˆâ–ˆâ•”â•â•â–ˆâ–ˆâ•—â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘â–ˆâ–ˆâ•”â•â•â•â–ˆâ–ˆâ•—â–ˆâ–ˆâ•”â•â•â–ˆâ–ˆâ•—â•šâ•â•â–ˆâ–ˆâ•”â•â•â•â–ˆâ–ˆâ•‘  â–ˆâ–ˆâ•‘
  â–ˆâ–ˆâ–ˆâ•”â• â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•‘â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•”â•   â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•‘
 â–ˆâ–ˆâ–ˆâ•”â•  â–ˆâ–ˆâ•”â•â•â–ˆâ–ˆâ•‘â•šâ–ˆâ–ˆâ•— â–ˆâ–ˆâ•”â•â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘â–ˆâ–ˆâ•”â•â•â–ˆâ–ˆâ•—   â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•”â•â•â–ˆâ–ˆâ•‘
â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•—â–ˆâ–ˆâ•‘  â–ˆâ–ˆâ•‘ â•šâ–ˆâ–ˆâ–ˆâ–ˆâ•”â• â•šâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ•”â•â–ˆâ–ˆâ•‘  â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘   â–ˆâ–ˆâ•‘  â–ˆâ–ˆâ•‘
â•šâ•â•â•â•â•â•â•â•šâ•â•  â•šâ•â•  â•šâ•â•â•â•   â•šâ•â•â•â•â•â• â•šâ•â•  â•šâ•â•   â•šâ•â•   â•šâ•â•  â•šâ•â•
`;
  console.log(TerminalTheme.colors.primary(header));
  console.log(TerminalTheme.colors.primary.bold('   PREMIUM CLI PRESENTATION LAYER - DEMONSTRATION'));
  console.log(TerminalTheme.colors.dim('â”€'.repeat(70)));
  console.log();

  // 2. Spinner Demo
  console.log(TerminalTheme.colors.primaryLight.bold('1. Spinners (Async Task Indicators)'));
  const spinner = new TerminalSpinner();

  spinner.start('Iniciando anÃ¡lise de seguranÃ§a do repositÃ³rio...');
  await sleep(1500);

  spinner.update('Verificando chaves de API expostas no cÃ³digo...');
  await sleep(1500);

  spinner.succeed('Nenhuma chave de API exposta encontrada no repositÃ³rio!');
  console.log();

  // 3. Semantic Panels/Boxes Demo
  console.log(TerminalTheme.colors.primaryLight.bold('2. Semantic Panels (Semantic wrappers with clean hierarchy)'));

  TerminalPanel.info(
    'O Zavorth opera em modo Governed-Dev. AÃ§Ãµes destrutivas ou alteraÃ§Ã£o de cÃ³digo exigem sua aprovaÃ§Ã£o explÃ­cita e deixam recibos assinados no histÃ³rico.',
    'Zavorth Security Policy'
  );
  await sleep(800);

  TerminalPanel.success(
    'Sandbox gVisor ativado e saudÃ¡vel.\nCPU: 2 Cores\nMemory: 512MB RAM\nVolume mount: /workspace (read-write-governed)',
    'Sandbox Status'
  );
  await sleep(800);

  TerminalPanel.warning(
    'Acesso a rede externa bloqueado para subprocessos nÃ£o autorizados.\nPara permitir uma rota externa temporÃ¡ria, utilize o comando `/trust-mesh`.',
    'Sandbox Firewalls'
  );
  await sleep(800);

  TerminalPanel.error(
    'Falha ao conectar com o provedor Telegram.\nVerifique seu TELEGRAM_BOT_TOKEN no arquivo .env ou execute `zavorth doctor`.',
    'Connection Error'
  );
  console.log();
  await sleep(800);

  // 4. Markdown Rendering Demo
  console.log(TerminalTheme.colors.primaryLight.bold('3. Rendered Markdown (With highlight, blocks, lists)'));
  const markdownText = `
# RelatÃ³rio de Auditoria de SeguranÃ§a

### Vulnerabilidades Encontradas
* **Severidade Alta**: InjeÃ§Ã£o de prompt detectada na biblioteca \`query-engine\`
* **Severidade MÃ©dia**: PermissÃµes de escrita excessivas no arquivo \`package.json\`

### AÃ§Ãµes Recomendadas
1. Atualizar \`zavorth-core\` para a versÃ£o \`v1.1.2\`
2. Executar o comando:
   \`\`\`bash
   npm run security:harden
   \`\`\`

> **Nota de SeguranÃ§a**: Para mais informaÃ§Ãµes, acesse [Zavorth Trust docs](https://zavorth.security/docs)
`;
  TerminalMarkdown.print(markdownText);
  console.log();
  await sleep(800);

  // 5. Visual Diffs Demo
  console.log(TerminalTheme.colors.primaryLight.bold('4. Visual Diffs (Clear green/red diffs for change previews)'));
  const oldCode = `const jwt = require('jsonwebtoken');

function validateToken(token) {
  // TODO: Implement verification
  return true;
}`;
  const newCode = `const jwt = require('jsonwebtoken');
const config = require('./config');

function validateToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256']
    });
  } catch (err) {
    console.error('Invalid token:', err.message);
    return null;
  }
}`;

  TerminalDiff.print(oldCode, newCode, { fileName: 'src/auth/jwt.js', contextLines: 3 });
  console.log();
  await sleep(800);

  // 6. Interactive Prompts Demo
  console.log(TerminalTheme.colors.primaryLight.bold('5. Interactive Prompts (Confirm, Input, Select)'));

  if (process.stdout.isTTY) {
    const confirm = await TerminalPrompt.confirm('Deseja aplicar as correÃ§Ãµes sugeridas no arquivo src/auth/jwt.js?', true);
    console.log(TerminalTheme.colors.dim(`Resposta selecionada: ${confirm ? 'Sim' : 'NÃ£o'}`));

    if (confirm) {
      const selected = await TerminalPrompt.select('Selecione o ambiente para o deploy:', ['development', 'staging', 'production']);
      console.log(TerminalTheme.colors.dim(`Ambiente selecionado: ${selected}`));
    }
  } else {
    console.log(TerminalTheme.colors.dim('[Ambiente NÃ£o-Interativo: Pulando prompts interativos reais]'));
    console.log(TerminalTheme.colors.primary('â¯ Deseja aplicar as correÃ§Ãµes sugeridas no arquivo src/auth/jwt.js? (y/N)'));
    console.log(TerminalTheme.colors.primary('â¯ Selecione o ambiente para o deploy: (Use arrow keys)'));
    console.log(TerminalTheme.colors.dim('  â¯ development\n    staging\n    production'));
  }

  console.log();
  console.log(TerminalTheme.colors.success.bold('âœ” DemonstraÃ§Ã£o concluÃ­da com sucesso!'));
}

main().catch(console.error);
