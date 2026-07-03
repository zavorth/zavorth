import * as path from 'path';
import { config } from '../config/index.js';
// /zavorthControl
// Open ZavorthControl.
import type { ZavorthCliFlags } from './ZavorthCliContract.js';
import type { ZavorthGatewaySnapshot } from '../services/ZavorthGatewayService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneActionExecution,
  type LearningPlaneSnapshot,
} from '../services/ZavorthLearningPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import type {
  ZavorthPlatformRegistrySnapshot,
} from '../services/ZavorthPlatformRegistryService.js';
import { ZavorthPlatformCatalogSyncService } from '../services/ZavorthPlatformCatalogSyncService.js';
import { CLI_REPL_HISTORY_FILE } from './ZavorthCliReplConfig.js';
import { formatAdditionalCount, formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen, type CliVisualPanel } from './ZavorthCliVisualSystem.js';
import {
  ZAVORTH_CLI_BRAND_NAME,
} from './ZavorthCliMascot.js';
import { padCliVisualText, paintCliTone, stripCliAnsi } from './ZavorthCliVisualTheme.js';
import {
  formatZavorthCertificationHelp,
  getZavorthPublicCommandRows,
} from './ZavorthCliCertificationCommands.js';

export type CliHelpSnapshot = {
  surface: 'zavorth-cli';
  topic:
    | 'root'
    | 'home'
    | 'hud'
    | 'hatch'
    | 'quickstart'
    | 'constitution'
    | 'disk'
    | 'branch'
    | 'commit'
    | 'pr'
    | 'review'
    | 'acp'
    | 'start'
    | 'demo'
    | 'connectors'
    | 'onboard'
    | 'go'
    | 'zavorthControl'
    | 'chat'
    | 'run'
    | 'continue'
    | 'status'
    | 'doctor'
    | 'templates'
    | 'missions'
    | 'receipts'
    | 'advanced'
    | 'ops'
    | 'sessions'
    | 'nodes'
    | 'reference';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

export type CliHelpTopic = CliHelpSnapshot['topic'];
export type CliHelpPage = Omit<CliHelpSnapshot, 'surface'>;

export type CliContextSnapshot = {
  surface: 'zavorth-cli';
  userId: string;
  platform: ZavorthCliFlags['platform'];
  chatId: string;
  sessionId: string;
  workspace: string;
  workspaceHint: string | null;
  historyFile: string;
  notes: string[];
};

export type CliChatWelcomeSnapshot = {
  surface: 'zavorth-cli';
  title: string;
  summary: string;
  sections: Array<{
    title: string;
    entries: Array<{
      command?: string;
      summary: string;
    }>;
  }>;
  notesTitle?: string;
  notes: string[];
};

export type CliDomainsSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    initialized: number;
    pending: number;
  };
  domains: Array<{
    id: string;
    label: string;
    initialized: boolean;
    initializedAt: string | null;
    summary?: string;
    metrics?: Record<string, unknown>;
  }>;
};

export type CliStatusSnapshot = {
  generatedAt: string;
  headline: string;
  nextAction: {
    label: string;
    command: string;
    reason: string;
  } | null;
  brief: {
    posture: string;
    headline: string;
  } | null;
  cockpit: {
    status: string;
    headline: string;
    topAlert: string | null;
  } | null;
  gateway: {
    channelsReady: number;
    channelsTotal: number;
    runtimeModesReady: number;
    securityPosture: string;
  } | null;
  domains: {
    total: number;
    initialized: number;
    pending: number;
  } | null;
  platform: {
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
    syncSummary: string | null;
  } | null;
  sessions: {
    total: number;
    historyItems: number;
    pendingPermissions: number;
    sendReady: boolean;
    spawnReady: boolean;
  } | null;
  nodes: {
    total: number;
    paired: number;
    online: number;
    queued: number;
    staleQueued: number;
  } | null;
  transports: {
    status: string;
    healthy: number;
    total: number;
    stale: boolean;
    summary: string | null;
    recommendedAction: string | null;
  } | null;
};

const CLI_HELP_TOPIC_ALIASES: Record<string, CliHelpTopic> = {
  onboard: 'onboard',
  setup: 'onboard',
  init: 'onboard',
  home: 'home',
  inicio: 'home',
  'start-here': 'home',
  hud: 'hud',
  cockpit: 'hud',
  tui: 'hud',
  hatch: 'hatch',
  acordar: 'hatch',
  despertar: 'hatch',
  quickstart: 'quickstart',
  configure: 'quickstart',
  configurar: 'quickstart',
  constitution: 'constitution',
  constituicao: 'constitution',
  ['constituiÃ§Ã£o']: 'constitution',
  ['constituição']: 'constitution',
  projectconstitution: 'constitution',
  disk: 'disk',
  diskgate: 'disk',
  'disk-gate': 'disk',
  mutationgate: 'disk',
  'mutation-gate': 'disk',
  branch: 'branch',
  commit: 'commit',
  pr: 'pr',
  pullrequest: 'pr',
  'pull-request': 'pr',
  review: 'review',
  codereview: 'review',
  'code-review': 'review',
  revisao: 'review',
  acp: 'acp',
  acpx: 'acp',
  'acp-channel': 'acp',
  'acp-adapter': 'acp',
  start: 'start',
  comecar: 'start',
  demo: 'demo',
  demonstracao: 'demo',
  connectors: 'connectors',
  connector: 'connectors',
  conectores: 'connectors',
  channels: 'connectors',
  channel: 'connectors',
  canais: 'connectors',
  canal: 'connectors',
  go: 'go',
  zavorthControl: 'zavorthControl',
  control: 'zavorthControl',
  commandcenter: 'zavorthControl',
  chat: 'chat',
  run: 'run',
  task: 'run',
  continue: 'continue',
  status: 'status',
  doctor: 'doctor',
  templates: 'templates',
  template: 'templates',
  missions: 'missions',
  mission: 'missions',
  receipts: 'receipts',
  receipt: 'receipts',
  advanced: 'advanced',
  avancado: 'advanced',
  capabilities: 'advanced',
  capability: 'advanced',
  supervisor: 'advanced',
  graph: 'advanced',
  ops: 'ops',
  operations: 'ops',
  heal: 'ops',
  selfheal: 'ops',
  release: 'ops',
  releases: 'ops',
  presence: 'ops',
  sessions: 'sessions',
  tasks: 'sessions',
  artifacts: 'sessions',
  workflows: 'sessions',
  workflowqueue: 'sessions',
  history: 'sessions',
  nodes: 'nodes',
  node: 'nodes',
  devices: 'nodes',
  companions: 'nodes',
  reference: 'reference',
  referencia: 'reference',
  all: 'reference',
  full: 'reference',
  completo: 'reference',
  completa: 'reference',
};

const CLI_COMMAND_HELP_PAGES: Record<Exclude<CliHelpTopic, 'root'>, CliHelpPage> = {
  home: {
    topic: 'home',
    title: 'zavorth',
    summary: 'Opens the premium terminal home: status, provider, channels, approvals, safety and next step.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You just opened the terminal and want to know what to do next.' },
          { summary: 'You want the same local truth without starting tools or mutations.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth', summary: 'Open the premium home.' },
          { command: 'zavorth home', summary: 'Open the same panel explicitly.' },
          { command: 'zavorth home --json', summary: 'Export the stable snapshot for automation.' },
        ],
      },
      {
        title: 'After that',
        entries: [
          { command: 'zavorth hatch', summary: 'Prepare the first agent session.' },
          { command: 'zavorth quickstart', summary: 'Configure provider/channels in preview-first mode.' },
          { command: 'zavorth approve', summary: 'Review pending approvals before continuing.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Home reads local state and redacts secrets. It does not run tools or write files.',
    ],
  },
  hud: {
    topic: 'hud',
    title: 'zavorth tui / zavorth hud',
    summary: 'Opens the daily terminal TUI with chat, timeline, approvals, diff, runtime, channels and logs.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want the daily operating surface without opening the zavorthControl.' },
          { summary: 'You want one clean terminal view for chat state, approvals, diff, runtime health and channels.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth tui', summary: 'Open the daily operational terminal view.' },
          { command: 'zavorth hud', summary: 'Alias for the same daily TUI.' },
          { command: 'zavorth tui --json', summary: 'Export the stable runtime TUI contract.' },
          { command: 'zavorth hud review', summary: 'Focused approval queue and decision mode.' },
          { command: 'zavorth hud guide', summary: 'Guided approval flow: select, inspect, diff, decide, evidence.' },
          { command: 'zavorth hud --action approve --yes', summary: 'Approve a plan only; never applies host changes.' },
          { command: 'zavorth hud --action reject --yes', summary: 'Reject and block a plan with audit.' },
          { command: 'zavorth hud --action defer --yes', summary: 'Defer a plan and keep evidence.' },
        ],
      },
      {
        title: 'Daily keys',
        entries: [
          { command: 'p', summary: 'Open terminal chat.' },
          { command: 'a', summary: 'Review approvals.' },
          { command: 'd', summary: 'Open diff previews.' },
          { command: 'c', summary: 'Check channel readiness.' },
          { command: 'o', summary: 'Open ZavorthControl.' },
          { command: 'r', summary: 'Refresh the TUI.' },
          { command: 'q', summary: 'Quit.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'The daily TUI routes actions. Sensitive work still requires preview, approval and evidence.',
    ],
  },
  hatch: {
    topic: 'hatch',
    title: 'zavorth hatch',
    summary: 'Shows the first-run cockpit and recommends the safest way to wake the agent.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to start a real session without memorizing start, setup, approvals or zavorthControl commands.' },
          { summary: 'You want to know whether to approve something, configure a provider or open the zavorthControl.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth hatch', summary: 'Premium first-run checklist.' },
          { command: 'zavorth hatch --json', summary: 'The same cockpit as a stable contract.' },
          { command: 'zavorth hatch --start', summary: 'Delegate to the existing start/go path when you choose to start.' },
        ],
      },
      {
        title: 'When ready',
        entries: [
          { command: 'zavorth ask "wake up and review this workspace"', summary: 'Suggested first natural request.' },
          { command: 'zavorth open', summary: 'Open the visual zavorthControl.' },
          { command: 'zavorth start', summary: 'Start or resume the local runtime.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Hatch does not apply host mutations. Sensitive actions still use policy, preview, approval and evidence.',
    ],
  },
  quickstart: {
    topic: 'quickstart',
    title: 'zavorth quickstart',
    summary: 'Configure provider and channels with a short, preview-first, secret-redacted flow.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to connect a provider/model without the full setup flow.' },
          { summary: 'You want to prepare Telegram or Discord with allowlists and no token leakage.' },
        ],
      },
      {
        title: 'Provider',
        entries: [
          { command: 'zavorth providers add --provider openai --model gpt-4.1', summary: 'Provider preview; does not write without --apply.' },
          { command: 'zavorth providers add --provider openai --model gpt-4.1 --apply', summary: 'Writes local .env with redacted output.' },
          { command: 'zavorth providers add --provider openai --secret-env OPENAI_API_KEY', summary: 'Reads a local secret variable without printing it.' },
        ],
      },
      {
        title: 'Channels',
        entries: [
          { command: 'zavorth channels telegram', summary: 'Telegram wizard with secret token and allowlist.' },
          { command: 'zavorth channels telegram --allowed-users <id> --apply', summary: 'Writes a local allowlist for safe ChatOps.' },
          { command: 'zavorth channels discord', summary: 'Discord wizard with guild/channel/owners.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'QuickStart does not start runtime or run a live probe without explicit consent.',
      'Use "zavorth setup" when you want full profile, memory and preference setup.',
    ],
  },
  constitution: {
    topic: 'constitution',
    title: 'zavorth constitution',
    summary: 'Safely imports AGENTS.md and CLAUDE.md into ZAVORTH_PROJECT.md as approved advisory project context.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You already have agent instruction files and want Zavorth to learn the project rules without trusting them blindly.' },
          { summary: 'You want a preview, approval phrase and receipt before changing persistent project context.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth constitution status', summary: 'Show candidates, current target and import receipts.' },
          { command: 'zavorth constitution import', summary: 'Create preview only; no file write.' },
          { command: 'zavorth constitution import --apply --yes', summary: 'Preview, redact and apply with local owner approval.' },
          { command: 'zavorth constitution apply <previewId> --approval-phrase "..."', summary: 'Apply a saved preview using the exact approval phrase.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Imported content is advisory context only. It cannot grant tools, bypass approval or override Zavorth policy.',
      'Secrets are redacted before persistence and the receipt records the source files and hashes.',
    ],
  },
  disk: {
    topic: 'disk',
    title: 'zavorth disk',
    summary: 'Universal disk mutation gate with preview, explicit approval and receipts for local file changes.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want a governed path for writing, appending, deleting or creating local files.' },
          { summary: 'You need a stable receipt proving what changed without storing raw file contents.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth disk status', summary: 'Show recent disk mutation receipts.' },
          { command: 'zavorth disk preview --write output/a.txt --content "hello"', summary: 'Create preview only; no target write.' },
          { command: 'zavorth disk preview --append output/a.txt --content "\\nmore"', summary: 'Preview append with hash precondition.' },
          { command: 'zavorth disk preview --delete output/a.txt', summary: 'Preview file deletion.' },
          { command: 'zavorth disk preview --apply --yes --write output/a.txt --content "hello"', summary: 'Preview and apply with local owner approval.' },
          { command: 'zavorth disk apply <previewId> --approval-phrase "..."', summary: 'Apply a saved preview using the exact approval phrase.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Writes outside the workspace, symlinks, protected paths and secret-like content are blocked.',
      'Apply rechecks the original file hash before writing and records a receipt under .zavorth/receipts.',
    ],
  },
  branch: {
    topic: 'branch',
    title: 'zavorth branch',
    summary: 'Preview or create a git branch through the governed Zavorth Git workflow.',
    sections: [
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth branch feature/name', summary: 'Preview git switch -c without mutating refs.' },
          { command: 'zavorth branch feature/name --apply --yes', summary: 'Create and switch branch with local owner approval.' },
          { command: 'zavorth git-status', summary: 'Show current branch and dirty file count.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: ['Branch names are validated; mutation requires --apply plus --yes or --approval-id.'],
  },
  commit: {
    topic: 'commit',
    title: 'zavorth commit',
    summary: 'Preview or create a git commit through Zavorth approval-aware workflow.',
    sections: [
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth commit -m "message"', summary: 'Preview git add --all and git commit.' },
          { command: 'zavorth commit -m "message" --apply --yes', summary: 'Stage all changes and commit with local owner approval.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: ['Commit uses explicit git args, no shell interpolation, and writes a git workflow receipt on apply.'],
  },
  pr: {
    topic: 'pr',
    title: 'zavorth pr',
    summary: 'Preview or create a GitHub pull request through gh with approval-aware execution.',
    sections: [
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth pr --title "Feature" --base main', summary: 'Preview gh pr create.' },
          { command: 'zavorth pr --title "Feature" --base main --apply --yes', summary: 'Create PR through gh with local owner approval.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: ['PR creation is external IO and requires --apply plus --yes or --approval-id.'],
  },
  review: {
    topic: 'review',
    title: 'zavorth review',
    summary: 'Run the official governed Agent Review surface over workspace diffs or GitHub PRs.',
    sections: [
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth review', summary: 'Review current workspace diff in read-only mode.' },
          { command: 'zavorth review --security', summary: 'Run governed security review mode.' },
          { command: 'zavorth review --pr 42 --repo owner/repo', summary: 'Collect GitHub PR metadata/diff through gh and review read-only.' },
          { command: 'zavorth review --pr 42 --post-comment --approval-id <id>', summary: 'Post approved governed review comment.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: ['Read-only by default. Comments, patches and live agents remain approval-gated.'],
  },
  acp: {
    topic: 'acp',
    title: 'zavorth acp',
    summary: 'Zavorth-native ACP-compatible channel adapter for ACP frames, handshakes and tool requests.',
    sections: [
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth acp channel status', summary: 'Show the generic ACP channel adapter contract and counters.' },
          { command: 'zavorth acp channel ingest --text "hello"', summary: 'Normalize an ACP-compatible message into Zavorth inbound contracts.' },
          { command: 'zavorth acp channel ingest --kind tool_request --tool Write --text "edit file"', summary: 'Create an approval-required receipt without executing the tool.' },
          { command: 'zavorth acp session --prompt "ping"', summary: 'Run the older governed ACP live-session path.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'The generic channel adapter is Zavorth-native: source tokens are evidence only and never become authority.',
      'It normalizes frames and approval requests; it does not mutate disk or execute external tools.',
    ],
  },
  start: {
    topic: 'start',
    title: 'zavorth start',
    summary: 'Start or resume the local runtime and open the main Zavorth surface.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to start Zavorth without memorizing internal scripts.' },
          { summary: 'You want to open the local zavorthControl and continue daily work.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth start', summary: 'Start or resume the local runtime and open the zavorthControl.' },
          { command: 'zavorth open', summary: 'Open the local zavorthControl without rereading docs.' },
          { command: 'zavorth ready', summary: 'Check provider, channels, approvals and readiness.' },
          { command: 'zavorth setup', summary: 'Guided First Light setup with QuickStart defaults.' },
          { command: 'zavorth setup --setup-mode safe', summary: 'Guided setup with conservative defaults.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Start does not remove approvals or publish to external channels.',
      'Sensitive actions still use preview, approval and evidence.',
    ],
  },
  demo: {
    topic: 'demo',
    title: 'zavorth demo',
    summary: 'Shows the product path, local visual demo and honest connector checklist.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to try Zavorth as a product before memorizing internal commands.' },
          { summary: 'You want to open Home, see the path and understand whether GitHub or Telegram still need setup.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth demo', summary: 'Show product path, Home, checklists and smoke.' },
          { command: 'zavorth demo browser', summary: 'Open the local visual demo in the browser.' },
          { command: 'zavorth demo doctor', summary: 'Show only what GitHub, Telegram and local demo still need.' },
          { command: 'zavorth demo --json', summary: 'Export the same truth for automation.' },
          { command: 'zavorth go', summary: 'Open the visual Home at /zavorthControl.' },
        ],
      },
      {
        title: 'Safety',
        entries: [
          { summary: 'Demo does not paste secrets, fake live connectors or post to PRs without approval.' },
          { summary: 'Smoke uses deterministic fixtures; real GitHub/Telegram use stays approval-aware.' },
        ],
      },
    ],
    notesTitle: 'Next',
    notes: [
      'Run: zavorth go',
      'Connectors: zavorth connectors doctor',
      'Then: zavorth review github --pr=<number> --repo=<owner/repo>',
      'For Telegram: zavorth connectors setup telegram --apply --allowed-user=<id>',
    ],
  },
  connectors: {
    topic: 'connectors',
    title: 'zavorth connectors',
    summary: 'Wizards and doctors for channels like Telegram, Discord, Slack, WhatsApp, Signal and Email without raw secrets in prompts.',
    sections: [
      {
        title: 'Doctor',
        entries: [
          { command: 'zavorth connectors doctor', summary: 'Show every public connector and exactly what is missing.' },
          { command: 'zavorth connectors doctor telegram', summary: 'Focus Telegram and run provider doctor when available.' },
          { command: 'zavorth connectors doctor discord', summary: 'Focus Discord and show minimum bot/guild/channel setup.' },
          { command: 'zavorth connectors doctor --json', summary: 'Export the same diagnostics for automation.' },
        ],
      },
      {
        title: 'Setup',
        entries: [
          { command: 'zavorth channels telegram', summary: 'Guided token, allowlist and Telegram policy setup.' },
          { command: 'zavorth channels discord', summary: 'Guided token, guild/channel and owner setup for Discord.' },
          { command: 'zavorth channels slack|whatsapp|signal|email', summary: 'Prepare configurable channels without claiming live status before proof.' },
          { command: 'zavorth channels telegram --apply --allowed-users=<id>', summary: 'Write local .env values with redacted screen output.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'GitHub uses gh auth login; Zavorth does not store GitHub credentials for you.',
      'Channel wizards preserve existing secrets, do not post real messages and only write with --apply.',
    ],
  },
  onboard: {
    topic: 'onboard',
    title: 'zavorth first light',
    summary: 'First Light prepares workspace, provider, model, channels, Mnemos and trust in one guided flow.',
    sections: [
      {
        title: 'First run',
        entries: [
          { summary: 'Asks your operator name, agent name, preferred tone and primary workspace.' },
          { summary: 'Lets you choose provider/model and enter keys through secret fields.' },
          { summary: 'Configures Telegram, Mnemos/vault and approval posture without starting persistent runtime.' },
        ],
      },
      {
        title: 'Setup modes',
        entries: [
          { command: 'zavorth setup', summary: 'Guided First Light setup with QuickStart defaults.' },
          { command: 'zavorth setup provider', summary: 'Start at provider, model and credential setup.' },
          { command: 'zavorth setup channels', summary: 'Start at communication surfaces and channel credentials.' },
          { command: 'zavorth setup tools', summary: 'Start at web/search, skills and automation templates.' },
          { command: 'zavorth setup agent', summary: 'Start at memory, trust, runtime and first hatch controls.' },
          { command: 'zavorth setup --setup-mode safe', summary: 'Governed defaults: stricter skills, local search and no wake detector.' },
          { command: 'zavorth setup --setup-mode blank-slate', summary: 'Minimal opt-in setup with memory, web search and remote channels off.' },
          { command: 'zavorth setup --config-handling reset', summary: 'Back up .env, remove setup-managed keys and write the new plan.' },
        ],
      },
      {
        title: 'Preview',
        entries: [
          { command: 'zavorth setup --dry-run', summary: 'Shows the plan without writing files.' },
          { command: 'zavorth onboarding --dry-run', summary: 'Friendly alias for the same setup preview.' },
          { command: 'zavorth onboard --dry-run', summary: 'Short alias for users who prefer the old command.' },
          { command: 'zavorth setup --json --dry-run', summary: 'Prints a redacted snapshot for safe automation.' },
        ],
      },
      {
        title: 'After setup',
        entries: [
          { command: 'zavorth ready', summary: 'Checks whether setup is ready for daily use.' },
          { command: 'zavorth start', summary: 'Starts or resumes the local runtime.' },
          { command: 'zavorth open', summary: 'Opens the visual zavorthControl.' },
          { command: 'zavorth chat', summary: 'Chats in the terminal when you do not want the panel.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Setup is idempotent: running it again reviews the environment instead of doing anything dangerous.',
    ],
  },
  go: {
    topic: 'go',
    title: 'zavorth go',
    summary: 'Open Zavorth Home at /zavorthControl or explain the exact blocker.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want the simple Home: Inbox, Tasks, Approvals, Evidence and Connectors.' },
          { summary: 'You want to resume Zavorth after setup without memorizing internal names.' },
        ],
      },
      {
        title: 'Safe mode',
        entries: [
          { command: 'zavorth go --dry-run', summary: 'Show URL, blocker and next command without starting persistent runtime.' },
          { command: 'zavorth doctor', summary: 'Go deeper when dry-run reports a blocker.' },
        ],
      },
      {
        title: 'After that',
        entries: [
          { command: 'zavorth chat', summary: 'Talk in the terminal.' },
          { command: 'zavorth receipts', summary: 'See evidence for what happened or was blocked.' },
          { command: 'zavorth status', summary: 'Confirm runtime readiness.' },
        ],
      },
    ],
    notesTitle: 'Expected output',
    notes: [
      'When it cannot open, the command should show the likely cause and next step, not a stack trace.',
    ],
  },
  zavorthControl: {
    topic: 'zavorthControl',
    title: 'zavorth zavorthControl',
    summary: 'Open Zavorth Home with local access applied when possible.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to open the visual gateway without hunting for a token in .env.' },
          { summary: 'You want to copy a local unlocked link into the browser.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth zavorthControl', summary: 'Open Home with the local token applied.' },
          { command: 'zavorth zavorthControl url', summary: 'Show a local link you can paste into the browser.' },
          { command: 'zavorth zavorthControl token', summary: 'Show the local token only when you truly need to copy it manually.' },
          { command: 'zavorth zavorthControl status', summary: 'Show where local access comes from without revealing the token.' },
          { command: 'zavorth zavorthControl doctor', summary: 'Diagnose a missing, stale or broken local token.' },
          { command: 'zavorth zavorthControl repair', summary: 'Create or repair the local token when it comes from the runtime file.' },
          { command: 'zavorth zavorthControl generate-token', summary: 'Generate a new local token when ZAVORTH_WEB_AUTH_TOKEN is not fixed.' },
        ],
      },
    ],
    notesTitle: 'Security',
    notes: [
      'The link/token is local to this install. Do not share it in chat, screenshots or public issues.',
      'The zavorthControl stores the token only in the current browser tab.',
      'If an old tab says the token is invalid, open a new one with "zavorth zavorthControl".',
    ],
  },
  chat: {
    topic: 'chat',
    title: 'zavorth chat',
    summary: 'Open the main Zavorth conversation in the terminal.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to talk normally with Zavorth without memorizing commands.' },
        ],
      },
      {
        title: 'Examples',
        entries: [
          { command: 'review this module', summary: 'Ask for a quick code review.' },
          { command: 'resume what we were doing', summary: 'Continue the current work inside chat.' },
          { command: 'compare what changed in this folder', summary: 'Summarize changes in this folder.' },
        ],
      },
      {
        title: 'Useful shortcuts',
        entries: [
          { command: 'status', summary: 'Show whether Zavorth is ready.' },
          { command: 'doctor', summary: 'Diagnose issues and suggest the next step.' },
          { command: 'history', summary: 'Show recent sessions or replay one session.' },
          { command: 'quit', summary: 'Close the current chat.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'In chat, any free text automatically becomes a request.',
    ],
  },
  run: {
    topic: 'run',
    title: 'zavorth run "<request>"',
    summary: 'Send a natural-language request without opening interactive chat.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want one direct request and then return to the normal terminal.' },
        ],
      },
      {
        title: 'Examples',
        entries: [
          { command: 'zavorth run "review this module"', summary: 'Send one request for analysis.' },
          { command: 'zavorth run "compare what changed in this folder"', summary: 'Ask for a quick workspace read.' },
        ],
      },
      {
        title: 'If you want to continue',
        entries: [
          { command: 'zavorth continue', summary: 'Resume the same work without special commands.' },
          { command: 'zavorth chat', summary: 'Open a full terminal conversation.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'If you prefer multiple messages, use zavorth chat.',
    ],
  },
  continue: {
    topic: 'continue',
    title: 'zavorth continue',
    summary: 'Resume the current work in natural language without memorizing special commands.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want Zavorth to continue where it stopped.' },
        ],
      },
      {
        title: 'Examples',
        entries: [
          { command: 'zavorth continue', summary: 'Resume the current work with no extra context.' },
          { command: 'zavorth continue "now focus on docs"', summary: 'Resume and change the work focus.' },
        ],
      },
      {
        title: 'If you need more context',
        entries: [
          { command: 'zavorth history', summary: 'Show recent sessions or replay one session.' },
          { command: 'zavorth status', summary: 'Summarize whether Zavorth is ready to continue.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'If there is no open work thread yet, use zavorth run or zavorth chat first.',
    ],
  },
  status: {
    topic: 'status',
    title: 'zavorth status',
    summary: 'Show a short local runtime snapshot before you act.',
    sections: [
      {
        title: 'What it checks',
        entries: [
          { summary: 'Local readiness, sessions, gateway, memory and key operational signals.' },
          { summary: 'A next command when something needs attention.' },
        ],
      },
      {
        title: 'Use when',
        entries: [
          { summary: 'You want a quick read before starting.' },
          { summary: 'You want to confirm Zavorth is ready after onboard or go.' },
        ],
      },
      {
        title: 'Related commands',
        entries: [
          { command: 'zavorth doctor', summary: 'Go deeper when something looks wrong.' },
          { command: 'zavorth go', summary: 'Start or resume the main Zavorth entry point.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'Use --json when another tool needs to read the response.',
    ],
  },
  doctor: {
    topic: 'doctor',
    title: 'zavorth doctor',
    summary: 'Diagnose the local environment and turn blockers into next steps.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'Something is not working as expected.' },
          { summary: 'You want the recommended next step without searching manually.' },
        ],
      },
      {
        title: 'What it checks',
        entries: [
          { summary: 'Node/npm/build/env, provider/model, SecretRefs, ports, Home and sessions.' },
          { summary: 'Separates the current blocker from optional steps when possible.' },
        ],
      },
      {
        title: 'Related commands',
        entries: [
          { command: 'zavorth status', summary: 'Show a quick snapshot before full diagnostics.' },
          { command: 'zavorth doctor security', summary: 'Check profile, approvals, dangerous overrides and security-control drift.' },
          { command: 'zavorth security presets', summary: 'List real presets for personal, professional or enterprise use.' },
          { command: 'zavorth security preset professional --apply', summary: 'Apply the recommended daily preset without manual env variables.' },
          { command: 'zavorth security continuous', summary: 'Check doctor, baseline, hooks, CI and continuous-security commands.' },
          { command: 'zavorth go', summary: 'Start the main entry point after fixing the environment.' },
          { command: 'zavorth setup', summary: 'Guided First Light setup with QuickStart defaults.' },
          { command: 'zavorth setup --setup-mode blank-slate', summary: 'Minimal opt-in setup with optional capabilities off.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'Use --json when automation or scripts need to read the response.',
    ],
  },
  templates: {
    topic: 'templates',
    title: 'zavorth templates',
    summary: 'Lists guided daily-use mission templates before any marketplace or advanced skill flow.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want a safe first mission without knowing internal architecture.' },
          { summary: 'You want dev repo review, PDF summary, file organization, daily assistant or safe audit presets.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth templates', summary: 'Show the guided template list.' },
          { command: 'zavorth templates --json', summary: 'Return the same template projection as JSON.' },
          { command: 'zavorth missions --template=dev-repo-review', summary: 'Preview a tracked mission from a template.' },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: [
      'Templates are governed instructions. They do not bypass approvals, sandbox or Policy Broker.',
    ],
  },
  missions: {
    topic: 'missions',
    title: 'zavorth missions',
    summary: 'Shows the current mission projection: request, status, risk, approvals, artifacts and timeline.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want the CLI view of what Home will show for a task.' },
          { summary: 'You want to confirm whether a mission is read-only, dry-run, blocked or waiting for approval.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth missions', summary: 'Show the default safe mission projection.' },
          { command: 'zavorth missions --template=file-organization', summary: 'Preview a mutating mission and sandbox fallback.' },
          { command: 'zavorth missions --json', summary: 'Return the mission contract as JSON.' },
        ],
      },
    ],
    notesTitle: 'Boundary',
    notes: [
      'Home and CLI consume this projection; neither surface becomes an execution authority.',
    ],
  },
  receipts: {
    topic: 'receipts',
    title: 'zavorth receipts',
    summary: 'Shows human-readable evidence plus advanced trust details for the current mission.',
    sections: [
      {
        title: 'Use when',
        entries: [
          { summary: 'You want to see files read/changed, approvals, blocked actions, network and rollback posture.' },
          { summary: 'You want a short proof of what happened without exposing raw secrets.' },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth receipts', summary: 'Show the current evidence projection.' },
          { command: 'zavorth receipts --advanced', summary: 'Show advanced trust details.' },
          { command: 'zavorth receipts --json', summary: 'Return the evidence contract as JSON.' },
        ],
      },
    ],
    notesTitle: 'Redaction',
    notes: [
      'Evidence must keep raw secrets out and represent credentials through SecretRef-style metadata.',
    ],
  },
  advanced: {
    topic: 'advanced',
    title: 'Zavorth advanced help',
    summary: 'For operators who already know the main path and need runtime, sessions, nodes and technical surfaces.',
    sections: [
      {
        title: 'Runtime operations',
        entries: [
          { command: 'zavorth help ops', summary: 'Show the cockpit, safe actions and operational bootstrap.' },
          { command: 'zavorth cockpit', summary: 'Open the unified operational cockpit.' },
          { command: 'zavorth ops', summary: 'Short alias for the cockpit.' },
          { command: 'zavorth brief', summary: 'Summarize operator state in a narrative format.' },
        ],
      },
      {
        title: 'Sessions and resumes',
        entries: [
          { command: 'zavorth help sessions', summary: 'Group replay, cross-session messages and workflows.' },
          { command: 'zavorth history [sessionId]', summary: 'Show recent sessions or replay one session.' },
          { command: 'zavorth tasks [taskId] [--json]', summary: 'Show Task OS state, resume, retry and permissions.' },
          { command: 'zavorth artifacts task <taskId|latest>', summary: 'List structured artifacts for a task.' },
          { command: 'zavorth supervisor plan "<request>" [--json]', summary: 'Build a supervised DAG with planner, critic, sandbox, budget and ledger.' },
          { command: 'zavorth workflows status|process [limit] [--json]', summary: 'Inspect or process the durable approval queue.' },
          { command: 'zavorth memory review [--json]', summary: 'Review workspace profile, preferences, retention and correction actions.' },
          { command: 'zavorth heal --preview [--json]', summary: 'Preview the self-heal plan without applying recovery actions.' },
          { command: 'zavorth release status [--json]', summary: 'Show channel, version, risk, rollback and remote presence.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Open a traceable derived session.' },
        ],
      },
      {
        title: 'Nodes and devices',
        entries: [
          { command: 'zavorth help nodes', summary: 'Show pairing, queue, abilities and Node Mesh diagnostics.' },
          { command: 'zavorth nodes list', summary: 'List connected companions and devices.' },
          { command: 'zavorth nodes doctor', summary: 'Diagnose one node or the mesh.' },
        ],
      },
      {
        title: 'Plans and catalogs',
        entries: [
          { command: 'zavorth memory status', summary: 'Show layered memory and budgets.' },
          { command: 'zavorth capabilities list', summary: 'List abilities, risk, permissions, fallbacks and MCP allowlist.' },
          { command: 'zavorth discover "<request>" [--json]', summary: 'Discover suggested abilities and tools without executing anything.' },
          { command: 'zavorth preview "<request>" [--json]', summary: 'Preview plan, risk, approvals and impact without running tools.' },
          { command: 'zavorth safety "<request>" [--json]', summary: 'Explain high-risk blocks and safe alternatives without leaking secrets or sensitive paths.' },
          { command: 'zavorth plugins list', summary: 'List integrations, skills, MCPs and collections.' },
          { command: 'zavorth gateway', summary: 'Show the channel gateway snapshot.' },
          { command: 'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]', summary: 'Read the Gateway Control API without opening the UI.' },
          { command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]', summary: 'Operate Developer Workspace manifests, processes and governed hooks.' },
          { command: 'zavorth learning status', summary: 'Show candidates, gates and learning-plane metrics.' },
        ],
      },
    ],
    notesTitle: 'Important notes',
    notes: [
      'If you only want to start, chat or diagnose, use "zavorth help".',
      'This layer exists for operators, power users and runtime maintenance.',
      'For a broad command index, use "zavorth help reference".',
    ],
  },
  ops: {
    topic: 'ops',
    title: 'Advanced help: runtime operations',
    summary: 'Groups the operational cockpit, official actions, bootstrap and supervised autorepair.',
    sections: [
      {
        title: 'Quick reads',
        entries: [
          { command: 'zavorth cockpit', summary: 'Open the unified operational cockpit.' },
          { command: 'zavorth ops', summary: 'Short alias for the same cockpit.' },
          { command: 'zavorth brief', summary: 'Show a narrative operator briefing.' },
          { command: 'zavorth ops quality [--json] [--live]', summary: 'Summarize operational score, budgets and gates.' },
        ],
      },
      {
        title: 'Diagnostics and access',
        entries: [
          { command: 'zavorth ops doctor [--json]', summary: 'Run aggregated doctor inside the operational surface.' },
          { command: 'zavorth ops access [--json]', summary: 'Show local and remote access readiness.' },
          { command: 'zavorth release status [--json]', summary: 'Show channel, version, risk, rollback and remote presence.' },
          { command: 'zavorth ops bootstrap [--json]', summary: 'Show the current operational bootstrap.' },
        ],
      },
      {
        title: 'Supervised actions',
        entries: [
          { command: 'zavorth ops actions', summary: 'List allowlisted operational actions.' },
          { command: 'zavorth ops run <actionId>', summary: 'Start an official background action.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Request a supervised runtime recycle.' },
          { command: 'zavorth ops autorepair status|dryrun|improve|force [--json]', summary: 'Inspect or run supervised autorepair.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'Start by reading current state; run, reload or autorepair only when you understand the expected effect.',
    ],
  },
  sessions: {
    topic: 'sessions',
    title: 'Advanced help: sessions and resumes',
    summary: 'Controls history, replay, cross-session messaging and traceable workflows.',
    sections: [
      {
        title: 'View and resume',
        entries: [
          { command: 'zavorth history [sessionId]', summary: 'Show recent sessions or replay one session.' },
          { command: 'zavorth sessions list [--json]', summary: 'List recent sessions and conversations.' },
          { command: 'zavorth sessions history <id>', summary: 'Consolidated replay for a specific session.' },
        ],
      },
      {
        title: 'Send and derive',
        entries: [
          { command: 'zavorth sessions send <id> -- <message>', summary: 'Send a message to another session.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Open a traceable derived session.' },
        ],
      },
      {
        title: 'Workflows and approvals',
        entries: [
          { command: 'zavorth approve <taskId> [pin=...]', summary: 'Approve a pending task.' },
          { command: 'zavorth reject <taskId>', summary: 'Reject a pending task.' },
          { command: 'zavorth workflows status [--json]', summary: 'Show the durable universal-runtime queue.' },
          { command: 'zavorth workflows process [limit] [--json]', summary: 'Process approved jobs left queued after restart.' },
          { command: 'zavorth resume <runId> [stage]', summary: 'Resume an existing workflow.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Run a specific stage again.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Close a blocked workflow.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'For a simple flow, use "zavorth continue" and use sessions only when you need finer control.',
    ],
  },
  nodes: {
    topic: 'nodes',
    title: 'Advanced help: nodes and devices',
    summary: 'Shows companions, pairing, queue, history and official Node Mesh invocation.',
    sections: [
      {
        title: 'Overview',
        entries: [
          { command: 'zavorth nodes list [--json]', summary: 'List connected companions and devices.' },
          { command: 'zavorth nodes profiles [--json]', summary: 'Show supported device profiles.' },
          { command: 'zavorth nodes capabilities [--json]', summary: 'Show available abilities by node.' },
        ],
      },
      {
        title: 'Diagnostics',
        entries: [
          { command: 'zavorth nodes doctor [--json]', summary: 'Summarize state, queue and problem signals.' },
          { command: 'zavorth nodes queue [id] [--json]', summary: 'Show the local queue or one specific node queue.' },
          { command: 'zavorth nodes history [id] [--json]', summary: 'Show recent activity history.' },
        ],
      },
      {
        title: 'Operation',
        entries: [
          { command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]', summary: 'Create a pairing draft for companion bootstrap.' },
          { command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]', summary: 'Queue an official Node Mesh invocation.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: [
      'If you only want to chat in the terminal, you do not need nodes.',
    ],
  },
  reference: {
    topic: 'reference',
    title: 'Zavorth CLI reference',
    summary: 'Broad command index for operators who need commands, aliases and technical surfaces directly.',
    sections: [
      {
        title: 'Main path',
        entries: [
          { command: 'zavorth setup', summary: 'Official Zavorth setup.' },
          { command: 'zavorth go', summary: 'Start the supervised runtime and open the main surface.' },
          { command: 'zavorth zavorthControl', summary: 'Open Home with local access applied.' },
          { command: 'zavorth chat', summary: 'Open the conversational terminal shell.' },
          { command: 'zavorth run "<request>"', summary: 'Send a natural-language request.' },
          { command: 'zavorth continue [context]', summary: 'Resume current work without slash commands.' },
          { command: 'zavorth history [sessionId]', summary: 'Show recent sessions or replay one session.' },
          { command: 'zavorth context', summary: 'Show the current CLI context.' },
          { command: 'zavorth status [--json] [--live]', summary: 'Summarize health, access, sessions and core abilities.' },
          { command: 'zavorth productization [--json]', summary: 'Shows the productization contract shared by zavorthControl, CLI, onboarding, docs and website.' },
          { command: 'zavorth observatory [run|trace|session|status] [--json]', summary: 'Show runs, evidence, timeline and Run Observatory replay.' },
          { command: 'zavorth cockpit [--json] [--live]', summary: 'Unified cockpit for status, doctor, brief, operations and deliveries.' },
          { command: 'zavorth capabilities [list|route "<request>"] [--json]', summary: 'Show ability routing and explain routing decisions.' },
          { command: 'zavorth supervisor plan "<request>" [--json]', summary: 'Show when to use supervisor graph, reflexion, sandbox and budget.' },
          { command: 'zavorth release status [--json]', summary: 'Show release, rollback and remote presence without making changes.' },
          { command: 'zavorth doctor [--json]', summary: 'Aggregated diagnostics for runtime, channels and remote access.' },
        ],
      },
      {
        title: 'Runtime operations',
        entries: [
          { command: 'zavorth brief [--json] [--live]', summary: 'Narrative operator briefing.' },
          { command: 'zavorth ops [--json] [--live]', summary: 'Alias for the unified operational cockpit.' },
          { command: 'zavorth ops doctor [--json]', summary: 'Aggregated doctor inside the operational surface.' },
          { command: 'zavorth ops actions', summary: 'List official operational actions.' },
          { command: 'zavorth ops quality [--json] [--live]', summary: 'Summarize operational score, budgets and gates.' },
            { command: 'zavorth ops access [--json]', summary: 'Local and remote access readiness.' },
            { command: 'zavorth heal --preview|--apply|report [--json]', summary: 'Self-Heal with probes, outbox, budgets and daily report.' },
            { command: 'zavorth release status|diff|rollback|presence [--json]', summary: 'Release channels, changelog, diff, rollback preview and remote presence.' },
            { command: 'zavorth ops bootstrap [--json]', summary: 'Show runtime operational bootstrap.' },
          { command: 'zavorth ops bootstrap repair [dryrun] [--json]', summary: 'Run or simulate safe bootstrap repairs.' },
          { command: 'zavorth ops changes [--json]', summary: 'Summarize local changes and supervised state.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Request a supervised runtime recycle.' },
          { command: 'zavorth ops autorepair status|dryrun|improve|force [--json]', summary: 'Inspect or run supervised autorepair.' },
        ],
      },
      {
        title: 'Sessions and workflows',
        entries: [
          { command: 'zavorth sessions list [--json]', summary: 'List recent sessions and conversations.' },
          { command: 'zavorth sessions history <id>', summary: 'Consolidated replay or handoff for a session.' },
          { command: 'zavorth tasks [list|resume|retry] [taskId] [--json]', summary: 'Operate Task OS with formal states and predictable continuation.' },
          { command: 'zavorth artifacts task <taskId|latest> [--json]', summary: 'List artifacts persisted for a task.' },
          { command: 'zavorth supervisor plan "<request>" [--simulate-test-failure] [--max-cost N] [--json]', summary: 'Plan compound workflows with DAG, limited reflexion, budget pauses and redacted ledger.' },
          { command: 'zavorth memory review|resolve|forget|correct [--json]', summary: 'Review learned memories and resolve follow-ups to the right task, artifact or workspace.' },
          { command: 'zavorth heal --preview [--json]', summary: 'Prepare supervised recovery without executing.' },
          { command: 'zavorth heal report [--json]', summary: 'Show top failures, pending items and proposed daily-report actions.' },
          { command: 'zavorth release diff previous latest [--json]', summary: 'Compare snapshots/publishes recorded in the release ledger.' },
          { command: 'zavorth release rollback --preview [--json]', summary: 'Build rollback preflight and evidence without switching releases.' },
          { command: 'zavorth release presence [--json]', summary: 'Show degradable remote presence without requiring always-online transport.' },
          { command: 'zavorth sessions send <id> -- <message>', summary: 'Send a message to another session.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Open a traceable derived session.' },
          { command: 'zavorth approve <taskId> [pin=...]', summary: 'Approve a pending task.' },
          { command: 'zavorth reject <taskId>', summary: 'Reject a pending task.' },
          { command: 'zavorth workflows status|process [limit] [--json]', summary: 'Check or process the durable universal-runtime queue.' },
          { command: 'zavorth resume <runId> [stage]', summary: 'Resume an existing workflow.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Run a specific workflow stage again.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Close a blocked workflow.' },
        ],
      },
      {
        title: 'Nodes and devices',
        entries: [
          { command: 'zavorth nodes list|profiles|capabilities|queue [id]|history [id]|doctor [--json]', summary: 'View nodes, queue, history and diagnostics.' },
          { command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]', summary: 'Create a node pairing draft.' },
          { command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]', summary: 'Queue an official Node Mesh invocation.' },
        ],
      },
      {
        title: 'Memory, learning and catalogs',
        entries: [
          { command: 'zavorth memory status|metrics [--json]', summary: 'Show layered memory and budgets.' },
          { command: 'zavorth memory search <query> [--json]', summary: 'Search facts, episodes and procedures.' },
          { command: 'zavorth memory procedures [--json]', summary: 'List validated procedures.' },
          { command: 'zavorth memory review [--json]', summary: 'Show Workspace Memory OS with retention and redaction.' },
          { command: 'zavorth memory resolve "continue" [--json]', summary: 'Resolve follow-ups to the correct task, artifact or workspace.' },
          { command: 'zavorth memoryplane [--json]', summary: 'Resume state, recent history and artifacts.' },
          { command: 'zavorth learning status|candidates|metrics [--json]', summary: 'Show state, candidates and learning-plane metrics.' },
          { command: 'zavorth learning approve|reject|promote <candidateId> [--json]', summary: 'Review or promote a learned candidate.' },
          { command: 'zavorth gateway', summary: 'Hydrated channel gateway snapshot.' },
          { command: 'zavorth productization [--json]', summary: 'Audits productization in text/JSON with the same public runtime contract.' },
          { command: 'zavorth observatory status failed [--json]', summary: 'Filter observable runs by status, trace, session or run without executing tools.' },
          { command: 'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]', summary: 'Status, providers, models, combos, cache, limits and doctor through Gateway Control API.' },
          { command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]', summary: 'Create manifests, validate recipes and operate Developer Workspace processes with approvals.' },
          { command: 'zavorth domains [full] [--json]', summary: 'Show the consolidated domain plane.' },
          { command: 'zavorth tools [--json]', summary: 'List tool families and shortcuts.' },
          { command: 'zavorth skills [filter|recipe <id>|recommend <goal>|mcp] [--json]', summary: 'Show the curated skills and recipes catalog.' },
          { command: 'zavorth hooks [--json]', summary: 'Show hooks and internal automations.' },
          { command: 'zavorth capabilities route "<request>" [--json]', summary: 'Explain selected executor, risk, approval, ledger and fallback.' },
          { command: 'zavorth plugins list [id] [--json]', summary: 'List active integrations, skills, MCPs, collections and recipes.' },
          { command: 'zavorth plugins sync', summary: 'Sync the plugin-plane remote catalog.' },
          { command: 'zavorth plugins <action> <id>', summary: 'Run inspect/open/doctor/install/trust/review/remove on the plugin plane.' },
          { command: 'zavorth AIGateway [status|route|start|doctor|sync|promote|rollback] [--json]', summary: 'Operate Zavorth AI Gateway routing.' },
        ],
      },
      {
        title: 'Compatibility and legacy',
        entries: [
          { command: 'zavorth help advanced|ops|sessions|nodes', summary: 'Layered help for operators and power users.' },
          { command: 'zavorth help reference', summary: 'Open this full reference.' },
          { command: 'zavorth help all', summary: 'Short alias for the same full reference.' },
          { command: 'transports|channels|runtime|agmobile', summary: 'Advanced commands still available through the official CLI.' },
          { command: '/command', summary: 'Keeps compatibility with the full runtime command surface.' },
          { command: 'sessionhistory|sessionsend|sessionspawn|nodepair|nodeinvoke|platform', summary: 'Legacy aliases are still accepted.' },
        ],
      },
    ],
    notesTitle: 'Usage tips',
    notes: [
      'Use "zavorth help" for the short human entry point and "zavorth help advanced" for the middle layer.',
      'Use "--json" when another tool should read the response.',
    ],
  },
};

export function resolveCliHelpTopic(target?: string | null): CliHelpTopic {
  const normalized = String(target || '').trim().toLowerCase();
  if (!normalized) {
    return 'root';
  }

  const firstToken = normalized.split(/\s+/u)[0] || '';
  return CLI_HELP_TOPIC_ALIASES[firstToken] || 'root';
}

function applyZavorthPublicBranding(output: string): string {
  if (process.env.ZAVORTH_PUBLIC_CLI !== '1') {
    return output;
  }

  return output
    .replace(/\bZavorth\b/gu, 'Zavorth')
    .replace(/\bzavorth\b/gu, 'zavorth');
}

export function buildCliHelpSnapshot(target?: string | null): CliHelpSnapshot {
  const topic = resolveCliHelpTopic(target);
  if (topic !== 'root') {
    return {
      surface: 'zavorth-cli',
      ...CLI_COMMAND_HELP_PAGES[topic],
    };
  }

  return {
    surface: 'zavorth-cli',
    topic: 'root',
    title: ZAVORTH_CLI_BRAND_NAME,
    summary: 'Natural language in front. Governed tools behind it. Evidence when it matters.',
    sections: [
      {
        title: 'Start here',
        entries: [
          { command: 'zavorth', summary: 'Open the interactive terminal agent session.' },
          { command: 'zavorth home', summary: 'Show status, approvals and next steps.' },
          { command: 'zavorth setup', summary: 'Guided setup for provider, channels, Mnemos and trust.' },
          { command: 'zavorth inspect', summary: 'Provider, workspace, channels, hooks, MCP and evidence.' },
          { command: 'zavorth open', summary: 'Open the visual ZavorthControl.' },
        ],
      },
      {
        title: 'Daily work',
        entries: [
          { command: 'zavorth -p "explain this repo"', summary: 'One-shot prompt with governed tools.' },
          { command: 'zavorth ask "question"', summary: 'Natural language through the LLM-first agent.' },
          { command: 'zavorth run "task"', summary: 'Governed task with timeline and evidence.' },
          { command: 'zavorth todo "task"', summary: 'Add a simple item to the persistent work queue.' },
          { command: 'zavorth later "task amanhã 9h"', summary: 'Schedule work to appear as a task when due.' },
          { command: 'zavorth work', summary: 'Show current work and materialize due scheduled items.' },
          { command: 'zavorth approve', summary: 'Review pending approvals.' },
          { command: 'zavorth diff', summary: 'Inspect sandbox diffs before host changes.' },
          { command: 'zavorth learn', summary: 'Review learning before future behavior changes.' },
        ],
      },
      {
        title: 'Setup and maintenance',
        entries: [
          { command: 'zavorth install', summary: 'Install dependencies with a clean panel.' },
          { command: 'zavorth build', summary: 'Build with progress and next actions.' },
          { command: 'zavorth check', summary: 'Run premium CLI/distribution QA.' },
          { command: 'zavorth doctor', summary: 'Diagnose setup and suggest safe fixes.' },
          { command: 'zavorth version', summary: 'Show version and release channels.' },
          { command: 'zavorth update --channel beta', summary: 'Preview a channel update.' },
        ],
      },
      {
        title: 'Advanced without clutter',
        entries: [
          { command: 'zavorth completions powershell', summary: 'Generate shell completions.' },
          { command: 'zavorth managed-config', summary: 'Preview managed config with checksum protection.' },
          { command: 'zavorth help advanced', summary: 'Show operator commands.' },
          { command: 'zavorth help reference', summary: 'Open the full engineering reference.' },
        ],
      },
      {
        title: 'Safety',
        entries: [
          { command: 'zavorth doctor --json', summary: 'Machine-readable diagnostics for automation.' },
          { command: 'zavorth managed-config apply', summary: 'Apply only after checksum verification.' },
          { summary: 'Sensitive actions stay behind policy, preview, approval and evidence.' },
        ],
      },
    ],
    notesTitle: 'Next',
    notes: [
      'First time? Run: zavorth setup',
      'Testing a local clone? Run: zavorth install, then zavorth build',
      'Daily use? Run: zavorth and follow the next action.',
    ],
  };
}

function formatCliHelpEntry(entry: { command?: string; summary: string }): string {
  if (entry.command && entry.summary) {
    const command = paintCliTone(entry.command, 'brand');
    return `${padCliVisualText(command, 32)} ${entry.summary}`;
  }
  if (entry.command) {
    return entry.command;
  }
  return entry.summary;
}

export function formatCliHelp(target?: string | null): string {
  const publicCommandHelp = formatPublicCommandHelp(target);
  if (publicCommandHelp) {
    return applyZavorthPublicBranding(publicCommandHelp);
  }
  const snapshot = buildCliHelpSnapshot(target);
  if (snapshot.topic === 'root') {
    return applyZavorthPublicBranding(formatPublicRootHelp());
  }
  const panels: CliVisualPanel[] = snapshot.sections.map((section) => ({
    title: section.title,
    lines: section.entries.map((entry) => formatCliHelpEntry(entry)),
    tone: 'info',
  }));

  if (snapshot.notes.length > 0) {
    panels.push({
      title: snapshot.notesTitle || 'Quick tips',
      lines: snapshot.notes.map((note) => `- ${note}`),
      tone: 'muted',
    });
  }

  return applyZavorthPublicBranding(renderCliScreen({
    eyebrow: `Help ${snapshot.topic}`,
    eyebrowTone: 'info',
    title: snapshot.title,
    summary: snapshot.summary,
    panels,
    mode: 'compact',
    showWordmark: false,
  }));
}

function formatPublicCommandHelp(target?: string | null): string | null {
  const topic = String(target || '').trim().toLowerCase().split(/\s+/u)[0] || '';
  const localGuidedPages = new Set(['home', 'hatch', 'quickstart', 'setup', 'onboard', 'onboarding']);
  if (!localGuidedPages.has(topic)) {
    const certificationHelp = formatZavorthCertificationHelp(topic);
    if (certificationHelp) {
      return certificationHelp;
    }
  }
  const pages: Record<string, {
    title: string;
    usage: string;
    description: string;
    options?: string[];
    commands: Array<[string, string]>;
    examples: Array<[string, string]>;
    docs?: string;
  }> = {
    channels: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      options: ['--json           Output JSON when supported'],
      commands: [
        ['add', 'Add or update a channel account.'],
        ['status', 'Show channel readiness and proof state.'],
        ['list', 'List configured and available channels.'],
        ['telegram', 'Configure Telegram ChatOps.'],
        ['discord', 'Configure Discord.'],
        ['slack', 'Configure Slack.'],
        ['email', 'Configure email delivery.'],
      ],
      examples: [
        ['zavorth channels add', 'Open guided channel setup.'],
        ['zavorth channels telegram', 'Configure Telegram token and allowlist.'],
        ['zavorth channels list', 'Show the channel catalog.'],
      ],
      docs: 'zavorth help connectors',
    },
    connector: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      commands: [],
      examples: [],
      docs: 'zavorth help connectors',
    },
    connectors: {
      title: 'Zavorth channels',
      usage: 'zavorth channels [options] [command]',
      description: 'Manage connected chat channels and accounts.',
      options: ['--json           Output JSON when supported'],
      commands: [
        ['doctor', 'Show missing configuration for public connectors.'],
        ['status', 'Show channel readiness.'],
        ['add', 'Open guided setup.'],
        ['list', 'List supported connectors.'],
      ],
      examples: [
        ['zavorth connectors doctor', 'Diagnose all public connectors.'],
        ['zavorth channels telegram', 'Configure Telegram safely.'],
      ],
      docs: 'zavorth help reference',
    },
    status: {
      title: 'Zavorth status',
      usage: 'zavorth status [options]',
      description: 'Show runtime, provider, channel and approval readiness.',
      options: ['--json           Output JSON when supported', '--strict         Exit non-zero when readiness is not clean'],
      commands: [],
      examples: [
        ['zavorth status', 'Show a short readiness report.'],
        ['zavorth ready --json', 'Print the same readiness projection as JSON.'],
      ],
      docs: 'zavorth doctor',
    },
    ready: {
      title: 'Zavorth status',
      usage: 'zavorth status [options]',
      description: 'Show runtime, provider, channel and approval readiness.',
      options: ['--json           Output JSON when supported', '--strict         Exit non-zero when readiness is not clean'],
      commands: [],
      examples: [
        ['zavorth status', 'Show a short readiness report.'],
        ['zavorth ready --json', 'Print the same readiness projection as JSON.'],
      ],
      docs: 'zavorth doctor',
    },
    doctor: {
      title: 'Zavorth doctor',
      usage: 'zavorth doctor [options] [scope]',
      description: 'Diagnose setup, runtime, provider, channel and security problems.',
      options: ['--json           Output JSON when supported', '--fix            Apply safe repairs when available', '--strict         Exit non-zero on warnings'],
      commands: [
        ['provider', 'Diagnose provider/model configuration.'],
        ['channels', 'Diagnose channel setup.'],
        ['security', 'Run operational security checks.'],
        ['runtime', 'Check runtime resource budget.'],
      ],
      examples: [
        ['zavorth doctor', 'Run the normal diagnostic path.'],
        ['zavorth doctor provider', 'Focus model/provider issues.'],
        ['zavorth doctor --json', 'Machine-readable diagnostic output.'],
      ],
      docs: 'zavorth status',
    },
    advanced: {
      title: 'Zavorth advanced',
      usage: 'zavorth advanced [command]',
      description: 'Operator commands hidden from the normal daily path.',
      commands: [
        ['sessions', 'Inspect sessions, history and resumable workflows.'],
        ['nodes', 'Manage companion devices and node mesh.'],
        ['memory', 'Inspect memory, learning and retention.'],
        ['gateway', 'Inspect gateway projections.'],
        ['workspace', 'Operate workspace manifests and processes.'],
      ],
      examples: [
        ['zavorth advanced sessions', 'Open session-oriented commands.'],
        ['zavorth advanced gateway status', 'Route to gateway status.'],
        ['zavorth help reference', 'Show the full engineering reference.'],
      ],
      docs: 'zavorth help reference',
    },
    ops: {
      title: 'Zavorth ops',
      usage: 'zavorth ops [command]',
      description: 'Runtime, gateway and maintenance operations.',
      commands: [
        ['start', 'Start or resume local runtime.'],
        ['gateway', 'Inspect gateway state.'],
        ['logs', 'Inspect runtime logs when available.'],
        ['release', 'Inspect release/update status.'],
        ['heal', 'Preview self-healing actions.'],
      ],
      examples: [
        ['zavorth ops start', 'Start the local runtime path.'],
        ['zavorth ops gateway status', 'Show gateway status.'],
        ['zavorth ops heal --preview', 'Preview repair actions.'],
      ],
      docs: 'zavorth doctor',
    },
  };
  const page = pages[topic];
  if (!page) return null;
  return formatPublicHelpPage(page);
}

function formatPublicHelpPage(page: {
  title: string;
  usage: string;
  description: string;
  options?: string[];
  commands: Array<[string, string]>;
  examples: Array<[string, string]>;
  docs?: string;
}): string {
  const panels: CliVisualPanel[] = [
    {
      title: page.title,
      tone: 'brand',
      lines: [page.description],
    },
    {
      title: 'Usage',
      tone: 'muted',
      lines: [page.usage],
    },
    {
      title: 'Options',
      tone: 'info',
      lines: ['-h, --help       Display help for command', ...(page.options || [])],
    },
    ...(page.commands.length
      ? [{
          title: 'Commands',
          tone: 'brand' as const,
          lines: page.commands.map(([command, description]) => formatCliHelpEntry({ command, summary: description })),
        }]
      : []),
    {
      title: 'Examples',
      tone: 'success',
      lines: page.examples.flatMap(([command, description]) => [command, `  ${description}`]),
    },
    {
      title: 'Docs',
      tone: 'muted',
      lines: [page.docs || 'zavorth help reference'],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Zavorth CLI',
    title: page.title,
    summary: page.description,
    panels,
    mode: 'compact',
    showWordmark: false,
  });
}

function formatPublicRootHelp(): string {
  const panels: CliVisualPanel[] = [
    {
      title: 'Usage',
      tone: 'muted',
      lines: [
        'Usage: zavorth [options] [command]',
        'Commands:',
      ],
    },
    {
      title: 'Daily commands',
      tone: 'brand',
      lines: [
        formatCliHelpEntry({ command: 'zavorth', summary: 'Open the terminal agent session.' }),
        formatCliHelpEntry({ command: 'zavorth chat', summary: 'Alias for the terminal agent session.' }),
        formatCliHelpEntry({ command: 'zavorth ask "review this repo"', summary: 'Run one governed request.' }),
        formatCliHelpEntry({ command: 'zavorth setup', summary: 'Configure provider, channels, Mnemos and trust.' }),
        formatCliHelpEntry({ command: 'zavorth start', summary: 'Start or resume the local runtime.' }),
        formatCliHelpEntry({ command: 'zavorth providers', summary: 'Inspect or configure model providers.' }),
        formatCliHelpEntry({ command: 'zavorth approve', summary: 'Review sensitive actions.' }),
        formatCliHelpEntry({ command: 'zavorth open', summary: 'Open ZavorthControl.' }),
      ],
    },
    {
      title: 'When needed',
      tone: 'info',
      lines: [
        formatCliHelpEntry({ command: 'zavorth home', summary: 'Short status and next step.' }),
        formatCliHelpEntry({ command: 'zavorth status', summary: 'Runtime readiness.' }),
        formatCliHelpEntry({ command: 'zavorth trust', summary: 'Review trust boundaries and permission memory.' }),
        formatCliHelpEntry({ command: 'zavorth doctor', summary: 'Diagnose setup and suggest fixes.' }),
        formatCliHelpEntry({ command: 'zavorth diff', summary: 'Inspect sandbox changes before approval.' }),
        formatCliHelpEntry({ command: 'zavorth inspect', summary: 'Provider, workspace, channels and evidence.' }),
      ],
    },
    {
      title: 'Advanced groups',
      tone: 'muted',
      lines: [
        formatCliHelpEntry({ command: 'zavorth help advanced', summary: 'Operator namespaces.' }),
        formatCliHelpEntry({ command: 'zavorth help reference', summary: 'Full engineering reference.' }),
        formatCliHelpEntry({ command: 'zavorth native catalog', summary: 'Provider/channel/ability inventory.' }),
        formatCliHelpEntry({ command: 'zavorth completions powershell', summary: 'Shell completion setup.' }),
      ],
    },
  ];

  return renderCliScreen({
    eyebrow: 'Zavorth CLI',
    title: 'ZAVORTH',
    summary: 'Speak naturally. Approve sensitive work. Keep evidence.',
    panels,
    mode: 'hero',
    showWordmark: false,
  });
}

export function buildCliChatWelcomeSnapshot(): CliChatWelcomeSnapshot {
  return {
    surface: 'zavorth-cli',
    title: 'Zavorth',
    summary: 'I am ready. Write naturally; I will explain, plan, use tools when useful, and ask before sensitive work.',
    sections: [
      {
        title: 'Try this first',
        entries: [
          { command: 'review this module', summary: 'Inspect the current code and call out what deserves attention.' },
          { command: 'resume what we were doing', summary: 'Continue the active line of work.' },
          { command: 'compare what changed in this folder', summary: 'Summarize recent changes without making you hunt through files.' },
        ],
      },
      {
        title: 'Shortcuts',
        entries: [
          { command: 'status', summary: 'Check whether everything is ready.' },
          { command: 'doctor', summary: 'Find and fix setup problems.' },
          { command: 'history', summary: 'Show recent conversations.' },
          { command: 'new', summary: 'Start a fresh conversation.' },
          { command: 'quit', summary: 'Leave the chat.' },
        ],
      },
    ],
    notesTitle: 'Tip',
    notes: [
      'You do not need to memorize commands. Free text becomes an agent request automatically.',
    ],
  };
}

function clipCliChatText(value: string, maxWidth: number): string {
  const normalized = stripCliAnsi(sanitizeHumanCliText(value)).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxWidth) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxWidth - 3)).trimEnd()}...`;
}

function formatCliChatWorkspaceLabel(): string {
  const workspace = String(config.defaultWorkspace || process.cwd()).trim() || process.cwd();
  const legacyProductName = ['Bas', 'ilisk'].join('');
  const legacyProductPattern = new RegExp(legacyProductName, 'gi');
  const workspaceName = (path.basename(workspace) || workspace).replace(legacyProductPattern, 'workspace');
  const normalizedPath = workspace.replace(/\\/g, '/').replace(legacyProductPattern, 'workspace');
  return `${workspaceName} - ${normalizedPath}`;
}

function resolveCliChatCurrentModel(): string {
  const provider = String(config.llmProvider || 'runtime').trim();
  const normalizedProvider = provider.toLowerCase().replace(/[\s_-]+/g, '');
  const modelCandidatesByProvider: Record<string, Array<string | null | undefined>> = {
    gemini: [config.geminiModel, config.geminiDefaultModel],
    google: [config.geminiModel, config.geminiDefaultModel],
    aistudio: [config.aiStudioModel, config.geminiModel, config.geminiDefaultModel],
    gemma: [config.gemmaModel],
    openai: [config.openaiModel],
    deepseek: [config.deepseekModel],
    minimax: [config.minimaxModel],
    aigateway: [config.AIGatewayModel, config.openaiModel],
    openrouter: [config.openRouterModel],
    opencode: [config.openCodeModel],
    qwen: [config.qwenModel],
  };
  const candidates = modelCandidatesByProvider[normalizedProvider] || [];
  const model = candidates
    .map((candidate) => sanitizeHumanCliText(candidate || '').trim())
    .find(Boolean);
  return model || provider || 'modelo atual';
}

function formatCliChatRuntimeLabel(): string {
  return `${resolveCliChatCurrentModel()} - natural chat`;
}

function formatCliChatCommand(entry: { command?: string; summary: string }): string {
  const command = sanitizeHumanCliText(entry.command || '').trim();
  const summary = sanitizeHumanCliText(entry.summary).trim();
  if (!command) {
    return `${paintCliTone('*', 'brand')} ${summary}`;
  }
  return [
    `${paintCliTone('>', 'brand')} ${paintCliTone(command, 'brand')}`,
    `  ${paintCliTone('->', 'muted')} ${summary}`,
  ].join('\n');
}

function formatCliChatFooter(shortcuts: Array<{ command?: string; summary: string }>): string {
  const shortcutLabels = shortcuts
    .map((entry) => sanitizeHumanCliText(entry.command || '').trim())
    .filter(Boolean);
  const shortcutLine = shortcutLabels.length > 0
    ? shortcutLabels.join(' | ')
    : 'status | doctor | history | quit';
  return [
    paintCliTone('--------------------------------------------------------', 'muted'),
    `${paintCliTone('?', 'muted')} shortcuts: ${shortcutLine}`,
    `${paintCliTone('safe', 'success')}: sensitive actions ask before they run`,
  ].join('\n');
}

export function formatCliChatWelcome(): string {
  const snapshot = buildCliChatWelcomeSnapshot();
  const examples = snapshot.sections[0]?.entries || [];
  const shortcuts = snapshot.sections[1]?.entries || [];
  const note = snapshot.notes[0] || 'Type a request in your own words.';
  const workspaceLabel = formatCliChatWorkspaceLabel();
  const runtimeLabel = formatCliChatRuntimeLabel();

  return [
    paintCliTone('* Runtime connected', 'success'),
    `${paintCliTone('zavorth', 'brand')} ${paintCliTone('agent', 'muted')} - ${paintCliTone(runtimeLabel, 'muted')}`,
    '',
    `${paintCliTone('workspace', 'muted')} ${clipCliChatText(workspaceLabel, 70)}`,
    '',
    `${paintCliTone("Hi, I'm Zavorth.", 'brand')} ${paintCliTone(sanitizeHumanCliText(snapshot.summary), 'muted')}`,
    '',
    `${paintCliTone('suggestions', 'muted')}`,
    examples.map((entry) => formatCliChatCommand(entry)).join('\n\n'),
    `${paintCliTone('tip', 'muted')}  ${sanitizeHumanCliText(note)}`,
    formatCliChatFooter(shortcuts),
  ].filter(Boolean).join('\n\n');
}

export function buildCliContextSnapshot(
  flags: Pick<ZavorthCliFlags, 'userId' | 'platform' | 'chatId' | 'sessionId' | 'workspaceHint'>,
  historyFile: string = CLI_REPL_HISTORY_FILE,
): CliContextSnapshot {
  return {
    surface: 'zavorth-cli',
    userId: flags.userId,
    platform: flags.platform,
    chatId: flags.chatId,
    sessionId: flags.sessionId,
    workspace: flags.workspaceHint || config.defaultWorkspace,
    workspaceHint: flags.workspaceHint,
    historyFile,
    notes: [
      'Native reads run directly through the official terminal.',
      'Free-form requests and short aliases use the same Zavorth runtime.',
    ],
  };
}

export function formatCliContextSnapshot(snapshot: CliContextSnapshot): string {
  return [
    'Zavorth terminal context',
    '',
    'Now',
    `- user: ${snapshot.userId}`,
    `- platform: ${snapshot.platform}`,
    `- chat: ${snapshot.chatId}`,
    `- session: ${snapshot.sessionId}`,
    '',
    'Useful files',
    `- workspace: ${snapshot.workspace}`,
    `- workspace hint: ${snapshot.workspaceHint || 'none; using default workspace'}`,
    `- history: ${snapshot.historyFile}`,
    '',
    'Notes',
    ...snapshot.notes.map((note) => `- ${note}`),
  ].join('\n');
}

export function formatGatewaySnapshot(snapshot: ZavorthGatewaySnapshot): string {
  return [
    'Zavorth gateway',
    sanitizeHumanCliText(snapshot.narrative.headline),
    '',
    'Now',
    `- ready channels: ${snapshot.summary.channelsReady}/${snapshot.summary.channelsTotal}`,
    `- runtime modes: ${snapshot.summary.runtimeModesReady}`,
    `- security: ${snapshot.summary.securityPosture}`,
    '',
    'Capacity',
    `- memory and artifacts: ${snapshot.summary.memoryArtifacts}`,
    `- teams: ${snapshot.summary.teams} | sessions: ${snapshot.summary.sessionTargets}`,
    `- tools: ${snapshot.summary.toolFamilies} families | plugins: ${snapshot.summary.plugins}`,
    '',
    'Mesh',
    `- companions pareados: ${snapshot.summary.nodesPaired}`,
    `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
  ].join('\n');
}

function formatSurfaceSection(title: string, lines: Array<string | null | undefined>): string[] {
  const items = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  return items.length > 0 ? ['', title, ...items] : [];
}

function formatUsagePercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'not reported';
  }
  return `${Math.round(value * 100)}%`;
}

function normalizePlatformActionHint(actionHint: string | null | undefined): string | null {
  const normalized = String(actionHint || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('/platform ')) {
    return `zavorth platform ${normalized.slice('/platform '.length)}`.trim();
  }
  if (normalized.startsWith('/integrations ')) {
    return `zavorth plugins ${normalized.slice('/integrations '.length)}`.trim();
  }

  return normalized;
}

type PlatformSnapshotRenderOptions = {
  focusExplicit?: boolean;
};

function formatPlatformOverflow(total: number, shown: number, singular: string, plural: string): string | null {
  const remaining = total - shown;
  return remaining > 0 ? `- ${formatAdditionalCount(remaining, singular, plural)}` : null;
}

function formatPlatformOverviewCollection(
  collection: ZavorthPlatformRegistrySnapshot['collections'][number],
): string {
  return `- ${collection.label}: ${formatCount(collection.itemCount, 'item', 'items')} | ${formatCount(collection.readyCount, 'ready', 'ready')} | ${formatCount(collection.adoptedCount, 'adopted', 'adopted')}`;
}

function formatPlatformOverviewRecipe(
  recipe: ZavorthPlatformRegistrySnapshot['recipes'][number],
): string {
  return `- ${recipe.label}: ${formatCount(recipe.itemCount, 'target', 'targets')} | ${formatCount(recipe.readyCount, 'ready', 'ready')} | ${formatCount(recipe.adoptedCount, 'adopted', 'adopted')}`;
}

function formatPlatformOverviewEntry(
  entry: ZavorthPlatformRegistrySnapshot['entries'][number],
): string {
  return `- ${entry.label} [${entry.kind}] ${entry.readiness}/${entry.installState} | trust ${formatCliValue(entry.trust)}`;
}

export function formatMemoryPlaneSnapshot(
  snapshot: Awaited<ReturnType<ZavorthMemoryPlaneService['buildSnapshot']>>,
): string {
  const recentArtifact = snapshot.artifacts.recent[0];
  const suggested = snapshot.suggestedActions[0];

  return [
    'Zavorth resume and deliveries',
    `- ${sanitizeHumanCliText(snapshot.narrative.headline)}`,
    `- ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    `- persisted memories: ${snapshot.summary.persistedMemories}`,
    `- relevant memories: ${snapshot.summary.relevantMemories}`,
    `- replay tasks: ${snapshot.summary.replayTasks}`,
    `- artifacts: ${snapshot.summary.artifacts}`,
    recentArtifact ? `- recent artifact: ${recentArtifact.label}` : '- recent artifact: none',
    suggested ? `- next step: ${suggested.label} (${suggested.command})` : '- next step: none',
  ].join('\n');
}

export function formatLearningSnapshot(
  snapshot: LearningPlaneSnapshot,
  mode: 'status' | 'candidates' = 'status',
): string {
  const featuredCandidate = snapshot.candidates[0] || null;
  const lines = [
    'Zavorth learning',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- candidates: ${formatCount(snapshot.summary.total, 'total', 'total')} | ${formatCount(snapshot.summary.pending, 'pending', 'pending')} | ${formatCount(snapshot.summary.highConfidence, 'high confidence', 'high confidence')}`,
      `- review: ${formatCount(snapshot.summary.approved, 'approved', 'approved')} | ${formatCount(snapshot.summary.rejected, 'rejected', 'rejected')} | ${snapshot.summary.quarantined} quarantined`,
      `- rollout: ${formatCount(snapshot.summary.promoted, 'promoted', 'promoted')} | ${formatCount(snapshot.summary.published, 'published', 'published')}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (mode === 'candidates' && snapshot.candidates.length > 0) {
    lines.push('', 'Focused candidates');
    for (const candidate of snapshot.candidates.slice(0, 5)) {
      lines.push(
        `- ${candidate.title} [${candidate.kind}]`,
        `  score ${candidate.score.toFixed(2)} | review ${candidate.reviewState} | state ${candidate.lifecycle}`,
      );
      lines.push(`  ${candidate.summary}`);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    mode === 'candidates' && featuredCandidate
      ? `- zavorth learning approve ${featuredCandidate.id}`
      : '- zavorth learning candidates',
    featuredCandidate ? `- zavorth learning promote ${featuredCandidate.id}` : '- zavorth learning metrics',
  ]));

  return lines.join('\n');
}

export function formatLearningMetricsSnapshot(
  metrics: ReturnType<ZavorthLearningPlaneService['readMetrics']>,
): string {
  return [
    'Learning metrics',
    'Quality and throughput snapshot for the learning plane.',
    ...formatSurfaceSection('Now', [
      `- candidates: ${formatCount(metrics.summary.totalCandidates, 'candidate', 'candidates')}`,
      `- average score: ${metrics.summary.averageScore}`,
      `- queue: ${formatCount(metrics.counts.pending, 'pending', 'pending')} | ${metrics.counts.quarantined} quarantined | ${formatCount(metrics.counts.highConfidence, 'high confidence', 'high confidence')}`,
    ]),
    ...formatSurfaceSection('Quality', [
      `- accepted: ${metrics.summary.acceptedRate}`,
      `- rejected: ${metrics.summary.rejectedRate}`,
      `- promoted: ${metrics.summary.promotedRate}`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth learning candidates',
    ]),
  ].join('\n');
}

export function formatLearningActionExecution(result: LearningPlaneActionExecution): string {
  return [
    'Learning updated',
    result.summary,
    ...formatSurfaceSection('Now', [
      `- candidate: ${result.candidateId}`,
      `- action: ${result.actionId}`,
      `- status: ${result.status}`,
    ]),
    ...formatSurfaceSection('Details', result.details.slice(0, 4).map((detail) => `- ${detail}`)),
    ...formatSurfaceSection('Do now', [
      '- zavorth learning candidates',
      '- zavorth learning metrics',
    ]),
  ].join('\n');
}

export function formatLayeredMemoryStatus(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['buildStatus']>>,
): string {
  return [
    'Zavorth memory',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- entries: ${formatCount(snapshot.summary.total, 'entry', 'entries')}`,
      `- layers: episodic ${snapshot.summary.episodic} | semantic ${snapshot.summary.semantic} | procedural ${snapshot.summary.procedural}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
    ...formatSurfaceSection('Usage', [
      `- budget per layer: ${snapshot.budgets.perLayer}`,
      `- episodic: ${formatUsagePercent(snapshot.budgets.episodicUsage)}`,
      `- semantic: ${formatUsagePercent(snapshot.budgets.semanticUsage)}`,
      `- procedural: ${formatUsagePercent(snapshot.budgets.proceduralUsage)}`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth memory search <topic>',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}

export function formatLayeredMemorySearch(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['search']>>,
): string {
  const lines = [
    'Zavorth memory search',
    `Query: ${snapshot.query}`,
    ...formatSurfaceSection('Now', [
      `- results: ${formatCount(snapshot.total, 'result', 'results')}`,
    ]),
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Results', [
      '- no relevant result found',
    ]));
    lines.push(...formatSurfaceSection('Do now', [
      '- zavorth memory procedures',
    ]));
    return lines.join('\n');
  }

  lines.push('', 'Focused results');
  for (const entry of snapshot.data.slice(0, 6)) {
    lines.push(
      `- ${entry.label} [${entry.memoryLayer}]`,
      `  confidence ${entry.confidence.toFixed(2)} | source ${entry.source}`,
    );
    lines.push(`  ${entry.summary}`);
  }

  lines.push(...formatSurfaceSection('Do now', [
    '- zavorth memory procedures',
  ]));

  return lines.join('\n');
}

export function formatLayeredMemoryProcedures(
  snapshot: Awaited<ReturnType<ZavorthLayeredMemoryService['readProcedures']>>,
): string {
  const lines = [
    'Zavorth procedures',
    snapshot.total > 0
      ? `There are ${formatCount(snapshot.total, 'validated procedure', 'validated procedures')} to reuse.`
      : 'There is no validated procedure to reuse yet.',
  ];

  if (snapshot.data.length === 0) {
    lines.push(...formatSurfaceSection('Now', [
      '- no validated procedure available',
    ]));
    return lines.join('\n');
  }

  lines.push(...formatSurfaceSection('Now', [
    `- validated procedures: ${formatCount(snapshot.total, 'procedure', 'procedures')}`,
  ]));
  lines.push('', 'Focused procedures');
  for (const procedure of snapshot.data.slice(0, 5)) {
    lines.push(`- ${procedure.label}`);
    lines.push(`  confidence ${procedure.confidence.toFixed(2)} | source ${procedure.source}`);
    lines.push(`  ${procedure.summary}`);
    for (const step of procedure.steps.slice(0, 3)) {
      lines.push(`  -> ${step}`);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    '- zavorth memory search <topic>',
  ]));

  return lines.join('\n');
}

export function formatPlatformSnapshot(
  snapshot: ZavorthPlatformRegistrySnapshot,
  options: PlatformSnapshotRenderOptions = {},
): string {
  const focusExplicit = options.focusExplicit === true;
  const selected = focusExplicit ? snapshot.selected : null;
  const selectedCollection = focusExplicit ? (snapshot.selectedCollection || null) : null;
  const selectedRecipe = focusExplicit ? (snapshot.selectedRecipe || null) : null;
  const highlighted = snapshot.entries.slice(0, 3);
  const collections = Array.isArray(snapshot.collections) ? snapshot.collections.slice(0, 2) : [];
  const recipes = Array.isArray(snapshot.recipes) ? snapshot.recipes.slice(0, 2) : [];

  const lines = [
    'Zavorth platform',
    sanitizeHumanCliText(snapshot.narrative.headline),
    ...formatSurfaceSection('Now', [
      `- plugins: ${snapshot.summary.plugins} | skills: ${snapshot.summary.skills} | MCPs: ${snapshot.summary.mcps}`,
      `- collections: ${String(snapshot.summary.collections || 0)} | recipes: ${String(snapshot.summary.recipes || 0)}`,
      `- sync: ${formatCliValue(snapshot.catalogSync?.summary)}`,
      `- summary: ${sanitizeHumanCliText(snapshot.narrative.operatorSummary)}`,
    ]),
  ];

  if (selectedCollection) {
    lines.push(...formatSurfaceSection('Focused collection', [
      `- ${selectedCollection.label}`,
      `- items: ${formatCount(selectedCollection.itemCount, 'item', 'items')} | ${formatCount(selectedCollection.readyCount, 'ready', 'ready')} | ${formatCount(selectedCollection.adoptedCount, 'adopted', 'adopted')}`,
      `- next step: ${normalizePlatformActionHint(selectedCollection.actionHint) || formatCliValue(selectedCollection.actionHint)}`,
    ]));
    if (selectedCollection.items.length > 0) {
      lines.push('', 'Focused items');
      lines.push(...selectedCollection.items.slice(0, 4).map((item) =>
        `- ${item.label} [${item.kind}] ${item.readiness}/${item.installState}`));
    }
    return lines.join('\n');
  }

  if (selectedRecipe) {
    lines.push(...formatSurfaceSection('Focused recipe', [
      `- ${selectedRecipe.label}`,
      `- targets: ${formatCount(selectedRecipe.itemCount, 'target', 'targets')} | ${formatCount(selectedRecipe.readyCount, 'ready', 'ready')} | ${formatCount(selectedRecipe.adoptedCount, 'adopted', 'adopted')}`,
      `- next step: ${normalizePlatformActionHint(selectedRecipe.actionHint) || formatCliValue(selectedRecipe.actionHint)}`,
    ]));
    if (selectedRecipe.steps.length > 0) {
      lines.push('', 'Focused steps');
      lines.push(...selectedRecipe.steps.slice(0, 3).map((step) => `- ${step}`));
    }
    return lines.join('\n');
  }

  if (selected) {
    lines.push(...formatSurfaceSection('Focused item', [
      `- ${selected.label}`,
      `- type: ${selected.kind}`,
      `- state: ${selected.readiness} | trust: ${formatCliValue(selected.trust)} | install: ${selected.installState}`,
      `- next step: ${normalizePlatformActionHint(selected.actionHint) || formatCliValue(selected.actionHint)}`,
      `- summary: ${sanitizeHumanCliText(selected.summary)}`,
    ]));
    if (selected.details.length > 0) {
      lines.push('', 'Details');
      lines.push(...selected.details.slice(0, 3).map((detail) => `- ${detail}`));
    }
    return lines.join('\n');
  }

  if (collections.length > 0) {
    lines.push('', 'Focused collections');
    for (const collection of collections) {
      lines.push(formatPlatformOverviewCollection(collection));
    }
    const overflow = formatPlatformOverflow(snapshot.collections.length, collections.length, 'other collection in catalog', 'other collections in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (recipes.length > 0) {
    lines.push('', 'Focused recipes');
    for (const recipe of recipes) {
      lines.push(formatPlatformOverviewRecipe(recipe));
    }
    const overflow = formatPlatformOverflow(snapshot.recipes.length, recipes.length, 'other recipe in catalog', 'other recipes in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  if (highlighted.length > 0) {
    lines.push('', 'Focused items');
    for (const entry of highlighted) {
      lines.push(formatPlatformOverviewEntry(entry));
    }
    const overflow = formatPlatformOverflow(snapshot.entries.length, highlighted.length, 'other item in catalog', 'other items in catalog');
    if (overflow) {
      lines.push(overflow);
    }
  }

  lines.push(...formatSurfaceSection('Do now', [
    collections[0] ? `- zavorth platform ${collections[0].id}` : '- zavorth plugins list',
  ]));

  return lines.join('\n');
}

export function formatPlatformSyncResult(result: Awaited<ReturnType<ZavorthPlatformCatalogSyncService['sync']>>): string {
  return [
    'Plugin catalog synced',
    sanitizeHumanCliText(result.summary),
    ...formatSurfaceSection('Now', [
      `- status: ${result.status}`,
      `- items: ${formatCount(result.entryCount, 'item', 'items')} | collections: ${formatCount(result.collectionCount, 'collection', 'collections')} | recipes: ${formatCount(result.recipeCount, 'recipe', 'recipes')}`,
      `- cache: ${formatCliValue(result.cacheFile)}`,
      result.error ? `- error: ${result.error}` : null,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth plugins list',
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return [
    'Memory metrics',
    'Pressure and distribution snapshot for layered memory.',
    ...formatSurfaceSection('Now', [
      `- entries: ${formatCount(metrics.summary.totalEntries, 'entry', 'entries')} | episodic ${metrics.summary.episodic} | semantic ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
      `- average budget usage: ${metrics.summary.averageBudgetUsage} | pressure: ${metrics.summary.pressure}`,
      `- procedures: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
    ]),
    ...formatSurfaceSection('Do now', [
      '- zavorth memory status',
      '- zavorth memory procedures',
    ]),
  ].join('\n');
}
