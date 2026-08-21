import type { CliHelpPage, CliHelpTopic } from '../ZavorthCliSurfaceHelpers.js';

export const CLI_COMMAND_HELP_PAGES_PART2: Record<string, CliHelpPage> = {
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
          {
            command: 'zavorth go --dry-run',
            summary: 'Show URL, blocker and next command without starting persistent runtime.',
          },
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
    notes: ['When it cannot open, the command should show the likely cause and next step, not a stack trace.'],
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
          {
            command: 'zavorth zavorthControl token',
            summary: 'Show the local token only when you truly need to copy it manually.',
          },
          {
            command: 'zavorth zavorthControl status',
            summary: 'Show where local access comes from without revealing the token.',
          },
          { command: 'zavorth zavorthControl doctor', summary: 'Diagnose a missing, stale or broken local token.' },
          {
            command: 'zavorth zavorthControl repair',
            summary: 'Create or repair the local token when it comes from the runtime file.',
          },
          {
            command: 'zavorth zavorthControl generate-token',
            summary: 'Generate a new local token when ZAVORTH_WEB_AUTH_TOKEN is not fixed.',
          },
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
        entries: [{ summary: 'You want to talk normally with Zavorth without memorizing commands.' }],
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
    notes: ['In chat, any free text automatically becomes a request.'],
  },

  run: {
    topic: 'run',
    title: 'zavorth run "<request>"',
    summary: 'Send a natural-language request without opening interactive chat.',
    sections: [
      {
        title: 'Use when',
        entries: [{ summary: 'You want one direct request and then return to the normal terminal.' }],
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
    notes: ['If you prefer multiple messages, use zavorth chat.'],
  },

  continue: {
    topic: 'continue',
    title: 'zavorth continue',
    summary: 'Resume the current work in natural language without memorizing special commands.',
    sections: [
      {
        title: 'Use when',
        entries: [{ summary: 'You want Zavorth to continue where it stopped.' }],
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
    notes: ['If there is no open work thread yet, use zavorth run or zavorth chat first.'],
  },

  status: {
    topic: 'status',
    title: 'zavorth status',
    summary: 'Show a short local runtime snapshot before you act.',
    sections: [
      {
        title: 'What it checks',
        entries: [
          { summary: 'local readiness, sessions, gateway, memory and key operational signals.' },
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
    notes: ['Use --json when another tool needs to read the response.'],
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
          {
            command: 'zavorth doctor security',
            summary: 'Check profile, approvals, dangerous overrides and security-control drift.',
          },
          {
            command: 'zavorth security presets',
            summary: 'List real presets for personal, professional or enterprise use.',
          },
          {
            command: 'zavorth security preset professional --apply',
            summary: 'Apply the recommended daily preset without manual env variables.',
          },
          {
            command: 'zavorth security continuous',
            summary: 'Check doctor, baseline, hooks, CI and continuous-security commands.',
          },
          { command: 'zavorth go', summary: 'Start the main entry point after fixing the environment.' },
          { command: 'zavorth setup', summary: 'Guided First Light setup with QuickStart defaults.' },
          { command: 'zavorth setup --setup-mode safe', summary: 'Guided setup with conservative defaults.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: ['Use --json when automation or scripts need to read the response.'],
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
          {
            summary: 'You want dev repo review, PDF summary, file organization, daily assistant or safe audit presets.',
          },
        ],
      },
      {
        title: 'Commands',
        entries: [
          { command: 'zavorth templates', summary: 'Show the guided template list.' },
          { command: 'zavorth templates --json', summary: 'Return the same template projection as JSON.' },
          {
            command: 'zavorth missions --template=dev-repo-review',
            summary: 'Preview a tracked mission from a template.',
          },
        ],
      },
    ],
    notesTitle: 'Safety',
    notes: ['Templates are governed instructions. They do not bypass approvals, sandbox or Policy Broker.'],
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
          {
            command: 'zavorth missions --template=file-organization',
            summary: 'Preview a mutating mission and sandbox fallback.',
          },
          { command: 'zavorth missions --json', summary: 'Return the mission contract as JSON.' },
        ],
      },
    ],
    notesTitle: 'Boundary',
    notes: ['Home and CLI consume this projection; neither surface becomes an execution authority.'],
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
    notes: ['Evidence must keep raw secrets out and represent credentials through SecretRef-style metadata.'],
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
          {
            command: 'zavorth supervisor plan "<request>" [--json]',
            summary: 'Build a supervised DAG with planner, critic, sandbox, budget and ledger.',
          },
          {
            command: 'zavorth workflows status|process [limit] [--json]',
            summary: 'Inspect or process the durable approval queue.',
          },
          {
            command: 'zavorth memory review [--json]',
            summary: 'Review workspace profile, preferences, retention and correction actions.',
          },
          {
            command: 'zavorth heal --preview [--json]',
            summary: 'Preview the self-heal plan without applying recovery actions.',
          },
          {
            command: 'zavorth release status [--json]',
            summary: 'Show channel, version, risk, rollback and remote presence.',
          },
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
          {
            command: 'zavorth capabilities list',
            summary: 'List abilities, risk, permissions, fallbacks and MCP allowlist.',
          },
          {
            command: 'zavorth discover "<request>" [--json]',
            summary: 'Discover suggested abilities and tools without executing anything.',
          },
          {
            command: 'zavorth preview "<request>" [--json]',
            summary: 'Preview plan, risk, approvals and impact without running tools.',
          },
          {
            command: 'zavorth safety "<request>" [--json]',
            summary: 'Explain high-risk blocks and safe alternatives without leaking secrets or sensitive paths.',
          },
          { command: 'zavorth plugins list', summary: 'List integrations, skills, MCPs and collections.' },
          { command: 'zavorth gateway', summary: 'Show the channel gateway snapshot.' },
          {
            command:
              'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]',
            summary: 'Read the Gateway Control API without opening the UI.',
          },
          {
            command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]',
            summary: 'Operate Developer Workspace manifests, processes and governed hooks.',
          },
          {
            command: 'zavorth learning status',
            summary: 'Show candidates and gates (/learning = candidates; /learn = skill drafts).',
          },
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
          {
            command: 'zavorth ops quality [--json] [--live]',
            summary: 'Summarize operational score, budgets and gates.',
          },
        ],
      },
      {
        title: 'Diagnostics and access',
        entries: [
          { command: 'zavorth ops doctor [--json]', summary: 'Run aggregated doctor inside the operational surface.' },
          { command: 'zavorth ops access [--json]', summary: 'Show local and remote access readiness.' },
          {
            command: 'zavorth release status [--json]',
            summary: 'Show channel, version, risk, rollback and remote presence.',
          },
          { command: 'zavorth ops bootstrap [--json]', summary: 'Show the current operational bootstrap.' },
        ],
      },
      {
        title: 'Supervised actions',
        entries: [
          { command: 'zavorth ops actions', summary: 'List allowlisted operational actions.' },
          { command: 'zavorth ops run <actionId>', summary: 'Start an official background action.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Request a supervised runtime recycle.' },
          {
            command: 'zavorth ops autorepair status|dryrun|improve|force [--json]',
            summary: 'Inspect or run supervised autorepair.',
          },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: ['Start by reading current state; run, reload or autorepair only when you understand the expected effect.'],
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
          {
            command: 'zavorth workflows process [limit] [--json]',
            summary: 'Process approved jobs left queued after restart.',
          },
          { command: 'zavorth resume <runId> [stage]', summary: 'Resume an existing workflow.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Run a specific stage again.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Close a blocked workflow.' },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: ['For a simple flow, use "zavorth continue" and use sessions only when you need finer control.'],
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
          {
            command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]',
            summary: 'Create a pairing draft for companion bootstrap.',
          },
          {
            command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]',
            summary: 'Queue an official Node Mesh invocation.',
          },
        ],
      },
    ],
    notesTitle: 'Quick tip',
    notes: ['If you only want to chat in the terminal, you do not need nodes.'],
  },

  reference: {
    topic: 'reference',
    title: 'Zavorth CLI reference',
    summary: 'Broad command index for operators who need commands, aliases and technical surfaces directly.',
    sections: [
      {
        title: 'Main path',
        entries: [
          { command: 'zavorth setup', summary: 'Guided First Light setup with QuickStart defaults.' },
          {
            command: 'zavorth setup --setup-mode blank-slate',
            summary: 'Minimal opt-in setup with optional capabilities off.',
          },
          { command: 'zavorth go', summary: 'Start the supervised runtime and open the main surface.' },
          { command: 'zavorth zavorthControl', summary: 'Open Home with local access applied.' },
          { command: 'zavorth chat', summary: 'Open the conversational terminal shell.' },
          { command: 'zavorth run "<request>"', summary: 'Send a natural-language request.' },
          { command: 'zavorth continue [context]', summary: 'Resume current work without slash commands.' },
          { command: 'zavorth history [sessionId]', summary: 'Show recent sessions or replay one session.' },
          { command: 'zavorth context', summary: 'Show the current CLI context.' },
          {
            command: 'zavorth status [--json] [--live]',
            summary: 'Summarize health, access, sessions and core abilities.',
          },
          {
            command: 'zavorth productization [--json]',
            summary: 'Shows the productization contract shared by zavorthControl, CLI, onboarding, docs and website.',
          },
          {
            command: 'zavorth observatory [run|trace|session|status] [--json]',
            summary: 'Show runs, evidence, timeline and Run Observatory replay.',
          },
          {
            command: 'zavorth cockpit [--json] [--live]',
            summary: 'Unified cockpit for status, doctor, brief, operations and deliveries.',
          },
          {
            command: 'zavorth capabilities [list|route "<request>"] [--json]',
            summary: 'Show ability routing and explain routing decisions.',
          },
          {
            command: 'zavorth supervisor plan "<request>" [--json]',
            summary: 'Show when to use supervisor graph, reflexion, sandbox and budget.',
          },
          {
            command: 'zavorth release status [--json]',
            summary: 'Show release, rollback and remote presence without making changes.',
          },
          {
            command: 'zavorth doctor [--json]',
            summary: 'Aggregated diagnostics for runtime, channels and remote access.',
          },
        ],
      },
      {
        title: 'Runtime operations',
        entries: [
          { command: 'zavorth brief [--json] [--live]', summary: 'Narrative operator briefing.' },
          { command: 'zavorth ops [--json] [--live]', summary: 'Alias for the unified operational cockpit.' },
          { command: 'zavorth ops doctor [--json]', summary: 'Aggregated doctor inside the operational surface.' },
          { command: 'zavorth ops actions', summary: 'List official operational actions.' },
          {
            command: 'zavorth ops quality [--json] [--live]',
            summary: 'Summarize operational score, budgets and gates.',
          },
          { command: 'zavorth ops access [--json]', summary: 'local and remote access readiness.' },
          {
            command: 'zavorth heal --preview|--apply|report [--json]',
            summary: 'Self-Heal with probes, outbox, budgets and daily report.',
          },
          {
            command: 'zavorth release status|diff|rollback|presence [--json]',
            summary: 'Release channels, changelog, diff, rollback preview and remote presence.',
          },
          { command: 'zavorth ops bootstrap [--json]', summary: 'Show runtime operational bootstrap.' },
          {
            command: 'zavorth ops bootstrap repair [dryrun] [--json]',
            summary: 'Run or simulate safe bootstrap repairs.',
          },
          { command: 'zavorth ops changes [--json]', summary: 'Summarize local changes and supervised state.' },
          { command: 'zavorth ops reload [force] [--json]', summary: 'Request a supervised runtime recycle.' },
          {
            command: 'zavorth ops autorepair status|dryrun|improve|force [--json]',
            summary: 'Inspect or run supervised autorepair.',
          },
        ],
      },
      {
        title: 'Sessions and workflows',
        entries: [
          { command: 'zavorth sessions list [--json]', summary: 'List recent sessions and conversations.' },
          { command: 'zavorth sessions history <id>', summary: 'Consolidated replay or handoff for a session.' },
          {
            command: 'zavorth tasks [list|resume|retry] [taskId] [--json]',
            summary: 'Operate Task OS with formal states and predictable continuation.',
          },
          {
            command: 'zavorth artifacts task <taskId|latest> [--json]',
            summary: 'List artifacts persisted for a task.',
          },
          {
            command: 'zavorth supervisor plan "<request>" [--simulate-test-failure] [--max-cost N] [--json]',
            summary: 'Plan compound workflows with DAG, limited reflexion, budget pauses and redacted ledger.',
          },
          {
            command: 'zavorth memory review|resolve|forget|correct [--json]',
            summary: 'Review learned memories and resolve follow-ups to the right task, artifact or workspace.',
          },
          { command: 'zavorth heal --preview [--json]', summary: 'Prepare supervised recovery without executing.' },
          {
            command: 'zavorth heal report [--json]',
            summary: 'Show top failures, pending items and proposed daily-report actions.',
          },
          {
            command: 'zavorth release diff previous latest [--json]',
            summary: 'Compare snapshots/publishes recorded in the release ledger.',
          },
          {
            command: 'zavorth release rollback --preview [--json]',
            summary: 'Build rollback preflight and evidence without switching releases.',
          },
          {
            command: 'zavorth release presence [--json]',
            summary: 'Show degradable remote presence without requiring always-online transport.',
          },
          { command: 'zavorth sessions send <id> -- <message>', summary: 'Send a message to another session.' },
          { command: 'zavorth sessions spawn [web]', summary: 'Open a traceable derived session.' },
          { command: 'zavorth approve <taskId> [pin=...]', summary: 'Approve a pending task.' },
          { command: 'zavorth reject <taskId>', summary: 'Reject a pending task.' },
          {
            command: 'zavorth workflows status|process [limit] [--json]',
            summary: 'Check or process the durable universal-runtime queue.',
          },
          { command: 'zavorth resume <runId> [stage]', summary: 'Resume an existing workflow.' },
          { command: 'zavorth restart-stage <runId> <stage>', summary: 'Run a specific workflow stage again.' },
          { command: 'zavorth close-workflow <runId>', summary: 'Close a blocked workflow.' },
        ],
      },
      {
        title: 'Nodes and devices',
        entries: [
          {
            command: 'zavorth nodes list|profiles|capabilities|queue [id]|history [id]|doctor [--json]',
            summary: 'View nodes, queue, history and diagnostics.',
          },
          {
            command: 'zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]',
            summary: 'Create a node pairing draft.',
          },
          {
            command: 'zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]',
            summary: 'Queue an official Node Mesh invocation.',
          },
        ],
      },
      {
        title: 'Memory, learning and catalogs',
        entries: [
          { command: 'zavorth memory status|metrics [--json]', summary: 'Show layered memory and budgets.' },
          { command: 'zavorth memory search <query> [--json]', summary: 'Search facts, episodes and procedures.' },
          { command: 'zavorth memory procedures [--json]', summary: 'List validated procedures.' },
          {
            command: 'zavorth memory review [--json]',
            summary: 'Show Workspace Memory OS with retention and redaction.',
          },
          {
            command: 'zavorth memory resolve "continue" [--json]',
            summary: 'Resolve follow-ups to the correct task, artifact or workspace.',
          },
          { command: 'zavorth memoryplane [--json]', summary: 'Resume state, recent history and artifacts.' },
          {
            command: 'zavorth learning status|candidates|metrics [--json]',
            summary: 'Learning plane candidates (not skill drafts — use zavorth learn).',
          },
          {
            command: 'zavorth learning approve|reject|promote 1 [--json]',
            summary: 'Review or promote a candidate by ordinal from list (prefer 1 over long ids).',
          },
          {
            command: 'zavorth learn [list|show 1|promote 1|forget 1]',
            summary: 'Experience skill drafts from multi-tool workflows (not candidates — use zavorth learning).',
          },
          {
            command: 'zavorth learn-skill <url|path|notes> [--apply --consent]',
            summary: 'Learn a skill from URL/path/notes (quarantine preview).',
          },
          {
            command: 'zavorth session export --session <id> --format markdown|html|prompt',
            summary: 'Export session transcript (redact on).',
          },
          {
            command: 'zavorth session model <sessionId> <model> [--provider <name>]',
            summary: 'Switch model mid-session with usage ledger.',
          },
          {
            command: 'zavorth cost-savings [--json]',
            summary: 'Aggregate session model ledgers and estimate cost savings.',
          },
          {
            command: 'zavorth consensus <question>',
            summary: 'Multi-model consensus (natural; same as /consensus). Optional: status|preview|save-profile.',
          },
          {
            command: 'zavorth <cmd> <plain language>',
            summary: 'Natural CLI: empty=home; free text=primary action (same rules as slash).',
          },
          { command: 'zavorth gateway', summary: 'Hydrated channel gateway snapshot.' },
          {
            command: 'zavorth productization [--json]',
            summary: 'Audits productization in text/JSON with the same public runtime contract.',
          },
          {
            command: 'zavorth observatory status failed [--json]',
            summary: 'Filter observable runs by status, trace, session or run without executing tools.',
          },
          {
            command:
              'zavorth gateway status|providers|models|combos|combo test <id>|cache stats|rate-limits|doctor [--json]',
            summary: 'Status, providers, models, combos, cache, limits and doctor through Gateway Control API.',
          },
          {
            command: 'zavorth workspace init|doctor|status|up|stop|restart [--json]',
            summary: 'Create manifests, validate recipes and operate Developer Workspace processes with approvals.',
          },
          { command: 'zavorth domains [full] [--json]', summary: 'Show the consolidated domain plane.' },
          { command: 'zavorth tools [--json]', summary: 'List tool families and shortcuts.' },
          {
            command: 'zavorth skills [filter|recipe <id>|recommend <goal>|mcp] [--json]',
            summary: 'Show the curated skills and recipes catalog.',
          },
          { command: 'zavorth hooks [--json]', summary: 'Show hooks and internal automations.' },
          {
            command: 'zavorth capabilities route "<request>" [--json]',
            summary: 'Explain selected executor, risk, approval, ledger and fallback.',
          },
          {
            command: 'zavorth plugins list [id] [--json]',
            summary: 'List active integrations, skills, MCPs, collections and recipes.',
          },
          { command: 'zavorth plugins sync', summary: 'Sync the plugin-plane remote catalog.' },
          {
            command: 'zavorth plugins <action> <id>',
            summary: 'Run inspect/open/doctor/install/trust/review/remove on the plugin plane.',
          },
          {
            command: 'zavorth AIGateway [status|route|start|doctor|sync|promote|rollback] [--json]',
            summary: 'Operate Zavorth AI Gateway routing.',
          },
        ],
      },
      {
        title: 'Compatibility and legacy',
        entries: [
          {
            command: 'zavorth help advanced|ops|sessions|nodes',
            summary: 'Layered help for operators and power users.',
          },
          { command: 'zavorth help reference', summary: 'Open this full reference.' },
          { command: 'zavorth help all', summary: 'Short alias for the same full reference.' },
          {
            command: 'transports|channels|runtime|agmobile',
            summary: 'Advanced commands still available through the official CLI.',
          },
          { command: '/command', summary: 'Keeps compatibility with the full runtime command surface.' },
          {
            command: 'sessionhistory|sessionsend|sessionspawn|nodepair|nodeinvoke|platform',
            summary: 'Legacy aliases are still accepted.',
          },
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

export const CLI_HELP_TOPIC_ALIASES: Record<string, CliHelpTopic> = {
  // English-only help topic aliases (no multi-language synonym packs).
  onboard: 'onboard',
  setup: 'onboard',
  init: 'onboard',
  home: 'home',
  'start-here': 'home',
  hud: 'hud',
  cockpit: 'hud',
  tui: 'hud',
  hatch: 'hatch',
  quickstart: 'quickstart',
  configure: 'quickstart',
  constitution: 'constitution',
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
  acp: 'acp',
  acpx: 'acp',
  'acp-channel': 'acp',
  'acp-adapter': 'acp',
  start: 'start',
  demo: 'demo',
  connectors: 'connectors',
  connector: 'connectors',
  channels: 'connectors',
  channel: 'connectors',
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
  all: 'reference',
  full: 'reference',
};
