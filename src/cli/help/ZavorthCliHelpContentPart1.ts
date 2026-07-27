import type { CliHelpPage, CliHelpTopic } from '../ZavorthCliSurfaceHelpers.js';

export const CLI_COMMAND_HELP_PAGES_PART1: Record<string, CliHelpPage> = {
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
      'Use "zavorth setup --setup-mode safe" for stricter defaults in the same First Light flow.',
      'Use "zavorth setup --setup-mode blank-slate" when you want a minimal opt-in start.',
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
          { command: 'zavorth setup', summary: 'Run First Light when configuration is missing.' },
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
          { summary: 'Demo does not paste secrets, synthetic live connectors or post to PRs without approval.' },
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
};
