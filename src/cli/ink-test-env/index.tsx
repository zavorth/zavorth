import readline from 'node:readline';
import { Box, Text, render, useApp } from 'ink';
import { useEffect } from 'react';

type Tone = 'primary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger';

type Command = {
  name: string;
  aliases: string[];
  run: () => void | Promise<void>;
};

type CatalogRow = {
  label: string;
  items: string[];
};

const VERSION = 'v1.1.0';

const ANSI: Record<Tone | 'reset' | 'bold' | 'dim', string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  primary: '\x1b[38;2;255;184;108m',
  muted: '\x1b[38;2;98;114;164m',
  accent: '\x1b[38;2;139;233;253m',
  success: '\x1b[38;2;80;250;123m',
  warning: '\x1b[38;2;241;250;140m',
  danger: '\x1b[38;2;255;110;110m',
};

const COLORS = {
  gold: '#FFD166',
  amber: '#FFB86C',
  blue: '#7B8CCB',
  green: '#50FA7B',
  text: '#F8F8F2',
  dim: '#6272A4',
};

const WORDMARK = [
  'ZZZZZZ   AAAAA   V     V  OOOOO   RRRRR   TTTTTTT  H   H',
  '   ZZ   A     A  V     V  O   O   R    R     T     H   H',
  '  ZZ    AAAAAAA   V   V   O   O   RRRRR      T     HHHHH',
  ' ZZ     A     A    V V    O   O   R   R      T     H   H',
  'ZZZZZZ  A     A     V     OOOOO   R    R     T     H   H',
];

const FOX = [
  '        /\\   /\\',
  '       /  \\_/  \\',
  '      /  o   o  \\',
  '     ( ==  ^  == )',
  '      )  policy  (',
  '   .-/ governed \\-.',
  '  /__ receipts on__\\',
];

const TOOL_ROWS: CatalogRow[] = [
  { label: 'policy', items: ['broker_check', 'receipt_issue', 'vault_access'] },
  { label: 'mesh', items: ['telegram', 'whatsapp', 'discord', 'signal', 'imessage'] },
  { label: 'exec', items: ['sandbox_shell', 'apply_patch', 'workspace_preview'] },
  { label: 'vision', items: ['browser_view', 'screen_capture', 'adb_observe'] },
  { label: 'memory', items: ['session', 'persistent', 'skill_memory', 'fts_search'] },
  { label: 'skills', items: ['trusted_prompt', 'intake_preview', 'bridge_dry_run'] },
];

const SKILL_ROWS: CatalogRow[] = [
  { label: 'code', items: ['repo_review', 'release_notes', 'patch_summary'] },
  { label: 'security', items: ['secret_scan', 'prompt_injection_review', 'policy_audit'] },
  { label: 'docs', items: ['pdf_summary', 'readme_polish', 'api_notes'] },
  { label: 'ops', items: ['doctor', 'provider_probe', 'channel_status'] },
  { label: 'learning', items: ['memory_intake', 'skill_candidate', 'generalize_pattern'] },
  { label: 'subagents', items: ['planner', 'researcher', 'builder', 'security', 'qa'] },
];

const AGENTS: CatalogRow[] = [
  { label: 'planner', items: ['mission split', 'risk map', 'approval plan'] },
  { label: 'researcher', items: ['read-only scan', 'web evidence', 'source notes'] },
  { label: 'builder', items: ['approved patch', 'rollback path', 'receipt'] },
  { label: 'security', items: ['secret guard', 'policy review', 'abuse test'] },
  { label: 'qa', items: ['checks', 'smoke', 'regression summary'] },
];

const RECEIPTS: CatalogRow[] = [
  { label: 'read', items: ['workspace preview', 'runtime projection'] },
  { label: 'write', items: ['approval required', 'rollback path'] },
  { label: 'blocked', items: ['external actions', 'live mutations'] },
  { label: 'proof', items: ['policy receipt', 'artifact summary'] },
];

function supportsColor(): boolean {
  return !process.env.NO_COLOR && process.stdout.isTTY !== false;
}

function color(text: string, tone: Tone, bold = false): string {
  if (!supportsColor()) return text;
  return `${bold ? ANSI.bold : ''}${ANSI[tone]}${text}${ANSI.reset}`;
}

function dim(text: string): string {
  if (!supportsColor()) return text;
  return `${ANSI.dim}${ANSI.muted}${text}${ANSI.reset}`;
}

function printRows(title: string, rows: CatalogRow[]): void {
  const nameWidth = Math.max(...rows.map(({ label }) => label.length), 8);
  console.log(color(title, 'primary', true));
  for (const row of rows) {
    console.log(`  ${color(row.label.padEnd(nameWidth), 'muted')}  ${row.items.join(', ')}`);
  }
}

function AutoExit({ children }: { children: JSX.Element }): JSX.Element {
  const { exit } = useApp();
  useEffect(() => {
    const handle = setImmediate(() => exit());
    return () => clearImmediate(handle);
  }, [exit]);
  return children;
}

function Wordmark(): JSX.Element {
  return (
    <Box flexDirection="column">
      {WORDMARK.map((line) => (
        <Text key={line} color={COLORS.gold} bold>
          {line}
        </Text>
      ))}
    </Box>
  );
}

function FoxPanel(): JSX.Element {
  return (
    <Box flexDirection="column" width={28}>
      <Box flexDirection="column" alignItems="center">
        {FOX.map((line) => (
          <Text key={line} color={COLORS.amber}>
            {line}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color={COLORS.blue}>model:</Text> <Text color={COLORS.text}>zavorth-v1</Text>
        </Text>
        <Text>
          <Text color={COLORS.blue}>mode:</Text> <Text color={COLORS.text}>governed-dev</Text>
        </Text>
        <Text>
          <Text color={COLORS.blue}>surface:</Text> <Text color={COLORS.text}>terminal cockpit</Text>
        </Text>
      </Box>
    </Box>
  );
}

function Catalog({ title, rows }: { title: string; rows: CatalogRow[] }): JSX.Element {
  return (
    <Box flexDirection="column">
      <Text color={COLORS.gold} bold>
        {title}
      </Text>
      {rows.map((row) => (
        <Text key={row.label}>
          <Text color={COLORS.blue}>{row.label.padEnd(10)}  </Text>
          <Text color={COLORS.text}>{row.items.join(', ')}</Text>
        </Text>
      ))}
    </Box>
  );
}

function StatusBar(): JSX.Element {
  return (
    <Box borderStyle="single" borderColor={COLORS.blue} paddingX={1} width="100%">
      <Text>
        <Text color={COLORS.gold} bold>
          zavorth-v1
        </Text>
        <Text color={COLORS.blue}> | </Text>
        <Text color={COLORS.text}>budget $0.04/$5.00</Text>
        <Text color={COLORS.blue}> | </Text>
        <Text color={COLORS.green}>risk low</Text>
        <Text color={COLORS.blue}> | </Text>
        <Text color={COLORS.text}>mem 45MB</Text>
      </Text>
    </Box>
  );
}

function Cockpit(): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Wordmark />
      <Box justifyContent="space-between" width="100%">
        <Text color={COLORS.dim}>Runtime {VERSION} | local-first | receipts on | governed execution</Text>
        <Text color={COLORS.gold}>Zavorth Agent OS / Command Runtime</Text>
      </Box>
      <Box marginY={1} borderStyle="single" borderColor={COLORS.gold} paddingX={2} paddingY={1} width="100%">
        <FoxPanel />
        <Box marginLeft={3} flexDirection="column" flexGrow={1}>
          <Catalog title="Available Tools" rows={TOOL_ROWS} />
          <Box marginTop={1}>
            <Catalog title="Available Skills" rows={SKILL_ROWS} />
          </Box>
          <Box marginTop={1}>
            <Text color={COLORS.gold}>Profile:</Text>
            <Text color={COLORS.text}> governed-dev</Text>
          </Box>
          <Text color={COLORS.dim}>24 tools | 30 skills | 5 profiles | /help for commands</Text>
        </Box>
      </Box>
      <Box borderStyle="single" borderColor={COLORS.blue} paddingX={1} paddingY={1} width="100%">
        <Catalog title="Subagent Deck" rows={AGENTS} />
      </Box>
      <Box marginTop={1} borderStyle="single" borderColor={COLORS.blue} paddingX={1} paddingY={1} width="100%">
        <Box flexDirection="column">
          <Catalog title="Receipt Preview" rows={RECEIPTS} />
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color={COLORS.gold}>[mission]</Text> preview only; no mutation runs from this shell
            </Text>
            <Text>
              <Text color={COLORS.green}>[policy]</Text> writes, network and device control require scoped approval
            </Text>
            <Text>
              <Text color={COLORS.green}>[dashboard]</Text> use /dashboard for the main gateway
            </Text>
          </Box>
        </Box>
      </Box>
      <Box marginTop={1}>
        <StatusBar />
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color={COLORS.gold} bold>
            Welcome to Zavorth OS.
          </Text>
          <Text color={COLORS.text}> Type a mission or </Text>
          <Text color={COLORS.gold}>/help</Text>
          <Text color={COLORS.text}> for commands. This preview renders once and never redraws in a loop.</Text>
        </Text>
      </Box>
    </Box>
  );
}

async function renderCockpit(): Promise<void> {
  const instance = render(
    <AutoExit>
      <Cockpit />
    </AutoExit>,
    {
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );
  await instance.waitUntilExit();
}

function printHelp(): void {
  printRows('Commands', [
    { label: '/overview', items: ['show capability mesh'] },
    { label: '/agents', items: ['show governed subagent deck'] },
    { label: '/skills', items: ['show governed skill memory and skill catalog'] },
    { label: '/receipts', items: ['show receipt preview'] },
    { label: '/doctor', items: ['show local readiness summary'] },
    { label: '/dashboard', items: ['show main gateway hint'] },
    { label: '/clear', items: ['clear once and reprint the cockpit'] },
    { label: '/exit', items: ['close the preview'] },
  ]);
}

function printOverview(): void {
  printRows('Capability Mesh', TOOL_ROWS);
  console.log('');
  console.log(dim('Policy Broker is active. Mutating actions require scoped approval and receipts.'));
}

function printAgents(): void {
  printRows('Subagent Deck', AGENTS);
  console.log('');
  console.log(dim('Subagents are governed workers. Read-only analysis can run first; mutations stay approval-gated.'));
}

function printSkills(): void {
  printRows('Skill Memory', SKILL_ROWS);
  console.log('');
  console.log(dim('Skills are reusable governed instructions, not automatically executable code.'));
}

function printReceipts(): void {
  printRows('Receipt Preview', RECEIPTS);
  console.log('');
  console.log(dim('Every real action should end with a readable receipt and rollback path when available.'));
}

function printDoctor(): void {
  printRows('Doctor', [
    { label: 'provider', items: ['owned by main Zavorth runtime'] },
    { label: 'sandbox', items: ['preview-safe in this demo'] },
    { label: 'workspace', items: ['read-only preview'] },
    { label: 'channels', items: ['terminal cockpit only'] },
    { label: 'memory', items: ['session, persistent and skill layers in core'] },
  ]);
}

function printDashboard(): void {
  console.log(color('Dashboard', 'primary', true));
  console.log('  Open http://127.0.0.1:3000/dashboard for the main Zavorth gateway.');
}

function printMission(input: string): void {
  const text = input.trim();
  if (!text) return;
  console.log(color('queued preview', 'accent', true));
  console.log(`  ${text}`);
  console.log(dim('  This demo does not execute missions. It previews the terminal cockpit shell.'));
}

function clearTerminal(): void {
  if (!process.stdout.isTTY) return;
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);
}

function createCommands(): Command[] {
  return [
    { name: '/overview', aliases: ['overview'], run: printOverview },
    { name: '/agents', aliases: ['agents'], run: printAgents },
    { name: '/skills', aliases: ['skills'], run: printSkills },
    { name: '/receipts', aliases: ['receipts'], run: printReceipts },
    { name: '/doctor', aliases: ['doctor'], run: printDoctor },
    { name: '/dashboard', aliases: ['dashboard'], run: printDashboard },
    {
      name: '/clear',
      aliases: ['clear', 'cls'],
      run: async () => {
        clearTerminal();
        await renderCockpit();
      },
    },
    { name: '/help', aliases: ['help', '?'], run: printHelp },
  ];
}

async function runCommand(input: string, commands: Command[]): Promise<boolean> {
  const normalized = input.trim().toLowerCase();
  const command = commands.find((item) => item.name === normalized || item.aliases.includes(normalized));
  if (!command) return false;
  await command.run();
  return true;
}

function printUsage(): void {
  console.log('Zavorth terminal cockpit preview');
  console.log('');
  console.log('Run from this folder:');
  console.log('  npm run dev');
  console.log('  npm start');
  console.log('');
  console.log('Run from the repository root:');
  console.log('  npm run cli:ink-preview');
  console.log('');
  console.log('Options:');
  console.log('  --once    render the Ink cockpit once and exit');
  console.log('  --help    show this help');
}

async function runOnce(): Promise<void> {
  await renderCockpit();
}

async function runInteractive(): Promise<void> {
  const commands = createCommands();
  await renderCockpit();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('zavorth> ', 'primary'),
    terminal: process.stdin.isTTY && process.stdout.isTTY,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    rl.pause();
    const normalized = line.trim().toLowerCase();
    if (['/exit', 'exit', 'quit', 'q'].includes(normalized)) {
      rl.close();
      return;
    }

    if (!(await runCommand(line, commands))) {
      printMission(line);
    }

    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(dim('Zavorth terminal cockpit closed.'));
    process.exit(0);
  });
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (process.argv.includes('--once')) {
  await runOnce();
  process.exitCode = 0;
} else {
  await runInteractive();
}
