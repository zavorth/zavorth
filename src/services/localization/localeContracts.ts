/**
 * Universal Localization Contracts and Type Definitions.
 *
 * Defines strictly typed structures for all supported UI, channel,
 * engine, and administrative surfaces across the Zavorth runtime.
 */

export const SUPPORTED_LOCALES = [
  'en',
  'pt',
  'es',
  'zh',
  'zh-hant',
  'ja',
  'de',
  'fr',
  'ru',
  'ko',
  'it',
  'ar',
  'tr',
  'uk',
  'af',
  'ga',
  'hu',
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const RTL_LOCALES = new Set<SupportedLocale>(['ar']);

export const LOCALE_ENDONYMS: Record<SupportedLocale, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  zh: '简体中文',
  'zh-hant': '繁體中文',
  ja: '日本語',
  de: 'Deutsch',
  fr: 'Français',
  ru: 'Русский',
  ko: '한국어',
  it: 'Italiano',
  ar: 'العربية',
  tr: 'Türkçe',
  uk: 'Українська',
  af: 'Afrikaans',
  ga: 'Gaeilge',
  hu: 'Magyar',
};

export interface CommonTranslations {
  save: string;
  saving: string;
  cancel: string;
  close: string;
  confirm: string;
  delete: string;
  refresh: string;
  retry: string;
  search: string;
  loading: string;
  create: string;
  creating: string;
  clear: string;
  enabled: string;
  disabled: string;
  active: string;
  inactive: string;
  status: string;
  actions: string;
  details: string;
  error: string;
  success: string;
  none: string;
}

export interface AppTranslations {
  title: string;
  tagline: string;
  chat: string;
  files: string;
  approvals: string;
  memory: string;
  plugins: string;
  channels: string;
  settings: string;
  workboard: string;
  automations: string;
  analytics: string;
}

export interface ChatTranslations {
  placeholder: string;
  send: string;
  stop: string;
  clearHistory: string;
  emptyState: string;
  tokens: string;
  thinking: string;
  errorOccurred: string;
}

export interface ChannelTranslations {
  title: string;
  description: string;
  primaryChannel: string;
  telegram: string;
  discord: string;
  slack: string;
  whatsapp: string;
  web: string;
  notConfigured: string;
  connected: string;
  disconnected: string;
}

export interface ProviderTranslations {
  title: string;
  description: string;
  primaryProvider: string;
  primaryModel: string;
  fallbackModel: string;
  apiKey: string;
  saveRoute: string;
  savedSuccessfully: string;
  saveFailed: string;
}

export interface MnemosTranslations {
  title: string;
  description: string;
  searchFacts: string;
  recall: string;
  forget: string;
  totalFacts: string;
  noFactsRecorded: string;
}

export interface KanbanTranslations {
  title: string;
  description: string;
  backlog: string;
  inProgress: string;
  review: string;
  autoRepairLane: string;
  done: string;
  createTask: string;
  taskTitle: string;
  priority: string;
}

export interface AutoRepairTranslations {
  title: string;
  description: string;
  resolvingFailure: string;
  patchApplied: string;
  testsPassing: string;
  rollbackRecovered: string;
  incidentHistory: string;
}

export interface CodeGraphTranslations {
  title: string;
  description: string;
  symbolsIndexed: string;
  callGraph: string;
  impactAnalysis: string;
  callerDependencies: string;
}

export interface DiffReviewTranslations {
  title: string;
  description: string;
  riskRating: string;
  securityAudit: string;
  secretCheck: string;
  breakingChanges: string;
  approved: string;
  rejected: string;
}

export interface ApprovalTranslations {
  title: string;
  description: string;
  pendingApprovals: string;
  approve: string;
  reject: string;
  riskLevel: string;
  commandPreview: string;
  noPendingApprovals: string;
}

export interface SettingsTranslations {
  title: string;
  language: string;
  theme: string;
  logLevel: string;
  resetDefaults: string;
}

export interface ChannelApprovalPromptTranslations {
  entry: string;
  hint: string;
}

export interface ChannelApprovalReceiptTranslations {
  approved: string;
  denied: string;
  notFound: string;
  resolvedApprovedElsewhere: string;
  resolvedDeniedElsewhere: string;
}

export interface ChannelApprovalBulkTranslations {
  approvedAll: string;
  deniedAll: string;
  approvedPartial: string;
  deniedPartial: string;
  notFound: string;
}

export interface ChannelApprovalOtherTranslations {
  armed: string;
  deniedWithReason: string;
  referencedNotFound: string;
}

export interface ChannelApprovalTranslations {
  prompt: ChannelApprovalPromptTranslations;
  receipt: ChannelApprovalReceiptTranslations;
  bulk: ChannelApprovalBulkTranslations;
  other: ChannelApprovalOtherTranslations;
}

export interface LocalizationCatalog {
  common: CommonTranslations;
  app: AppTranslations;
  chat: ChatTranslations;
  channels: ChannelTranslations;
  providers: ProviderTranslations;
  mnemos: MnemosTranslations;
  kanban: KanbanTranslations;
  autoRepair: AutoRepairTranslations;
  codeGraph: CodeGraphTranslations;
  diffReview: DiffReviewTranslations;
  approvals: ApprovalTranslations;
  settings: SettingsTranslations;
  /** Migrated surface catalogs served previously by src/i18n YAML catalogs. */
  legacy?: LegacyCatalogSection;
  /** Migrated plugin load tips served previously by src/services/plugin-i18n. */
  pluginTips?: PluginTipsSection;
  /** Channel approval prompt/receipt copy resolved through the localization facade. */
  approval?: ChannelApprovalSection;
  /** Migrated AI-gateway HTTP surface catalogs from src/ai-gateway/i18n/messages. */
  gateway?: GatewayCatalogSection;
}

// ==== Migrated legacy catalog contracts (generated once by scripts/merge-legacy-i18n-catalogs.mjs) ====

/**
 * Surface catalogs migrated from the retired YAML/JSON i18n system.
 * Keys mirror the former `<namespace>.<dotted.path>` lookup space consumed
 * through the src/i18n compatibility facade.
 */

export interface LegacyCliTranslations {
  chat: {
    assistant: string;
    empty_input: string;
    error: string;
    interrupted: string;
    thinking: string;
    you: string;
  };
  doctor: {
    checking: string;
    fail: string;
    pass: string;
    summary: string;
    title: string;
    warn: string;
  };
  errors: {
    channel_connection_failed: string;
    channel_not_configured: string;
    config_invalid: string;
    config_not_found: string;
    file_not_found: string;
    invalid_option: string;
    missing_argument: string;
    network_error: string;
    permission_denied: string;
    provider_connection_failed: string;
    provider_not_configured: string;
    runtime_already_running: string;
    runtime_not_started: string;
    timeout: string;
    unknown_command: string;
  };
  help: {
    commands: string;
    examples: string;
    more_info: string;
    options: string;
    title: string;
    usage: string;
  };
  instance: {
    already_exists: string;
    commands: {
      create: string;
      current: string;
      delete: string;
      list: string;
      switch: string;
    };
    created: string;
    created_at: string;
    current_default: string;
    current_instance: string;
    delete_active: string;
    deleted: string;
    description: string;
    env_hint: string;
    example_1: string;
    example_2: string;
    example_3: string;
    examples: string;
    has_config: string;
    has_creds: string;
    has_memory: string;
    invalid_name: string;
    list_header: string;
    list_marker: string;
    name_required: string;
    not_found: string;
    switch_hint: string;
    switch_no_change: string;
    switch_not_found: string;
    switched: string;
    title: string;
    unknown_action: string;
    usage: string;
    use_hint: string;
  };
  setup: {
    api_key_prompt: string;
    cancelled: string;
    channel_select: string;
    language_select: string;
    provider_select: string;
    success: string;
    title: string;
  };
  start: {
    failed: string;
    started: string;
    starting: string;
    stopped: string;
    stopping: string;
  };
  status: {
    agent_state: string;
    autonomy: string;
    cognition: string;
    diagnose: string;
    do_now: string;
    eyebrow: string;
    general: string;
    memory_episodic: string;
    memory_procedural: string;
    memory_semantic: string;
    no_autonomy: string;
    pressure_critical: string;
    pressure_elevated: string;
    pressure_healthy: string;
    provider: string;
    recall_pressure: string;
    resources: string;
    sessions: string;
    state_pending: string;
    state_ready: string;
    title: string;
  };
  welcome: string;
  welcome_anonymous: string;
}

export interface LegacyCommonTranslations {
  actions: {
    approve: string;
    back: string;
    cancel: string;
    close: string;
    confirm: string;
    copy: string;
    create: string;
    defer: string;
    delete: string;
    edit: string;
    export: string;
    filter: string;
    import: string;
    next: string;
    open: string;
    paste: string;
    redo: string;
    refresh: string;
    reject: string;
    restart: string;
    retry: string;
    save: string;
    search: string;
    sort: string;
    start: string;
    stop: string;
    undo: string;
    update: string;
  };
  app: {
    mascot: string;
    name: string;
    tagline: string;
  };
  status: {
    active: string;
    blocked: string;
    error: string;
    idle: string;
    loading: string;
    offline: string;
    online: string;
    paused: string;
    ready: string;
    success: string;
    warning: string;
  };
  time: {
    days_ago: string;
    hours_ago: string;
    in_days: string;
    in_hours: string;
    in_minutes: string;
    in_seconds: string;
    minutes_ago: string;
    now: string;
    seconds_ago: string;
    today: string;
    tomorrow: string;
    yesterday: string;
  };
  units: {
    bytes: string;
    days: string;
    gigabytes: string;
    hours: string;
    kilobytes: string;
    megabytes: string;
    milliseconds: string;
    minutes: string;
    seconds: string;
  };
}

export interface LegacyDashboardTranslations {
  actions: {
    cancel: string;
    confirm: string;
    copy: string;
    delete: string;
    dismiss: string;
    edit: string;
    paste: string;
    retry: string;
    save: string;
  };
  chat: {
    attachments: string;
    clear: string;
    clearHistory: string;
    export: string;
    history: string;
    import: string;
    maxTokens: string;
    model: string;
    newConversation: string;
    placeholder: string;
    search: string;
    send: string;
    settings: string;
    streaming: string;
    systemPrompt: string;
    temperature: string;
    title: string;
  };
  errors: {
    forbidden: string;
    generic: string;
    network: string;
    notFound: string;
    timeout: string;
    unauthorized: string;
    validation: string;
  };
  home: {
    subtitle: string;
    welcome: string;
  };
  labels: {
    assistant: string;
    cost: string;
    model: string;
    system: string;
    timestamp: string;
    tokens: string;
    user: string;
  };
  notifications: {
    error: string;
    info: string;
    messageReceived: string;
    taskCompleted: string;
    warning: string;
  };
  sidebar: {
    about: string;
    conversations: string;
    help: string;
    newChat: string;
    settings: string;
  };
  status: {
    away: string;
    busy: string;
    connecting: string;
    disconnected: string;
    offline: string;
    online: string;
  };
}

export interface LegacyDesktopTranslations {
  app: {
    loading: string;
    title: string;
  };
  approvals: {
    approve: string;
    no_pending: string;
    pending: string;
    reject: string;
    title: string;
  };
  chat: {
    clear: string;
    no_messages: string;
    placeholder: string;
    send: string;
    thinking: string;
  };
  notifications: {
    approval_needed: string;
    connection_lost: string;
    connection_restored: string;
    new_message: string;
    task_completed: string;
    task_failed: string;
  };
  settings: {
    language: string;
    provider: string;
    save: string;
    saved: string;
    theme: string;
    title: string;
  };
  sidebar: {
    approvals: string;
    automations: string;
    channels: string;
    chat: string;
    memory: string;
    providers: string;
    settings: string;
    skills: string;
    workspace: string;
  };
  workspace: {
    explorer: string;
    files: string;
    terminal: string;
    title: string;
  };
}

export interface LegacyErrorsTranslations {
  channel: {
    authentication_failed: string;
    connection_lost: string;
    message_send_failed: string;
    webhook_invalid: string;
  };
  generic: {
    conflict: string;
    forbidden: string;
    internal: string;
    invalid_input: string;
    not_found: string;
    not_implemented: string;
    not_supported: string;
    rate_limited: string;
    unauthorized: string;
    unexpected: string;
  };
  memory: {
    corrupted: string;
    load_failed: string;
    save_failed: string;
    search_failed: string;
  };
  provider: {
    api_key_invalid: string;
    api_key_missing: string;
    model_not_found: string;
    quota_exceeded: string;
    rate_limit: string;
    timeout: string;
    unavailable: string;
  };
  security: {
    approval_expired: string;
    approval_required: string;
    dangerous_command: string;
    permission_denied: string;
    secret_detected: string;
  };
  skill: {
    execution_failed: string;
    invalid_manifest: string;
    load_failed: string;
    not_found: string;
  };
}

export interface LegacyOnboardingTranslations {
  conversation: {
    applied: string;
    apply_failed: string;
    confirmation_invalid: string;
    questions: {
      agent_name: {
        label: string;
        prompt: string;
      };
      detail_level: {
        label: string;
        prompt: string;
      };
      experience_profile: {
        label: string;
        prompt: string;
      };
      preferred_language: {
        label: string;
        prompt: string;
      };
      user_name: {
        label: string;
        prompt: string;
      };
    };
    review_preview: string;
  };
  progress: {
    almost_done: string;
    completing: string;
    step_of: string;
  };
  steps: {
    channels: {
      prompt: string;
      title: string;
    };
    complete: {
      learning_tip: string;
      next_steps: string;
      summary: string;
      title: string;
    };
    identity: {
      agent_name: string;
      title: string;
      user_name: string;
    };
    language: {
      en: string;
      prompt: string;
      pt: string;
      title: string;
    };
    provider: {
      api_key: string;
      prompt: string;
      title: string;
    };
    safety: {
      autonomous: string;
      balanced: string;
      conservative: string;
      prompt: string;
      title: string;
    };
  };
  welcome: {
    description: string;
    subtitle: string;
    title: string;
  };
}

export interface LegacyQuickstartTranslations {
  cancelled: string;
  channels: {
    discord_token: string;
    email_smtp: string;
    slack_token: string;
    telegram_token: string;
    telegram_users: string;
    title: string;
  };
  config_handling: {
    keep: string;
    prompt: string;
    reset: string;
    review: string;
  };
  config_issues: {
    doctor_hint: string;
    env_not_found: string;
    env_unreadable: string;
    no_api_keys: string;
    run_doctor: string;
    title: string;
  };
  existing_config: {
    channels: string;
    home: string;
    model: string;
    provider: string;
    title: string;
  };
  gateway: {
    installed: string;
    not_installed: string;
    reinstall: string;
    skip: string;
    start_cmd: string;
    title: string;
  };
  hatch: {
    browser: string;
    later: string;
    prompt: string;
    terminal: string;
    title: string;
  };
  headless: {
    cmd_apply: string;
    cmd_dry: string;
    cmd_json: string;
    docker_hint: string;
    message: string;
    non_interactive: string;
    or_run: string;
    ssh_hint: string;
  };
  home: {
    choose_custom: string;
    keep_current: string;
    path_prompt: string;
    prompt: string;
    use_isolated: string;
  };
  hooks: {
    hint: string;
    prompt: string;
    title: string;
  };
  marketplace: {
    help_info: string;
    help_install: string;
    help_list: string;
    help_publish: string;
    help_remove: string;
    help_search: string;
    help_title: string;
    help_update: string;
    info_not_found: string;
    install_already: string;
    install_from_file: string;
    install_from_repo: string;
    install_not_found: string;
    install_success: string;
    publish_exported: string;
    publish_invalid: string;
    publish_registered: string;
    publish_success: string;
    remove_not_installed: string;
    remove_success: string;
    search_no_results: string;
    search_results: string;
    update_not_installed: string;
    update_success: string;
  };
  memory: {
    custom: string;
    documents: string;
    downloads: string;
    local_metadata: string;
    local_summary: string;
    off: string;
    prompt: string;
    skip: string;
    title: string;
    vault_scope: string;
    whole_pc: string;
  };
  migration: {
    complete: string;
    path_prompt: string;
    prompt: string;
    skipped: string;
  };
  mode: {
    blank: string;
    blank_hint: string;
    complete: string;
    complete_hint: string;
    prompt_first_run: string;
    prompt_reconfigure: string;
    quickstart: string;
    quickstart_hint: string;
    safe: string;
    safe_hint: string;
  };
  provider: {
    all_providers: string;
    api_key_prompt: string;
    auto_detected: string;
    auto_selected: string;
    manual_prompt: string;
    models_prompt: string;
    more: string;
    none_found: string;
    select_prompt: string;
    skip: string;
    skip_hint: string;
    test_failed: string;
    testing: string;
    verified: string;
  };
  search: {
    brave: string;
    google: string;
    local: string;
    prompt: string;
    skip: string;
    title: string;
  };
  section: {
    title: string;
  };
  security: {
    confirm_first_run: string;
    confirm_reconfigure: string;
    short: string;
  };
  skill_governance: {
    casual: string;
    casual_hint: string;
    governed: string;
    governed_hint: string;
    prompt: string;
  };
  summary: {
    backup: string;
    channels_label: string;
    env_updated: string;
    governance: string;
    memory_label: string;
    model: string;
    next_steps: string;
    provider: string;
    step_channels: string;
    step_chat: string;
    step_doctor: string;
    step_providers: string;
    title: string;
  };
  wake_detector: {
    args_prompt: string;
    command_prompt: string;
    custom_command: string;
    default_local: string;
    disabled: string;
    prompt: string;
  };
  welcome: {
    banner_line1: string;
    banner_line2: string;
    subtitle: string;
    title: string;
  };
}

export interface LegacyServicesTranslations {
  approval: {
    approved: string;
    auto_approved: string;
    expired: string;
    rejected: string;
    requested: string;
  };
  codex_remote: {
    active: string;
    active_profile: string;
    active_profile_now: string;
    enabled: string;
    permission_label: string;
    profile: string;
    profile_management: string;
    profiles_title: string;
    recent_tail: string;
    registry_health: string;
    running: string;
    tracked_sessions: string;
    visibility: string;
  };
  contract: {
    auto_attachment_description: string;
    auto_description: string;
    auto_input_description: string;
    autorepair_description: string;
    autorepair_mode_description: string;
    changes_description: string;
    choice_run: string;
    command_unavailable: string;
    commands_description: string;
    commands_input_description: string;
    help_description: string;
    learn_description: string;
    learning_description: string;
    model_description: string;
    model_name_description: string;
    model_provider_description: string;
    plan_attachment_description: string;
    plan_description: string;
    plan_input_description: string;
    selfupdate_description: string;
    selfupdate_force_description: string;
    status_description: string;
    strong_description: string;
    strong_mode_description: string;
    task_attachment_description: string;
    task_description: string;
    task_input_description: string;
    this_surface: string;
  };
  desktop: {
    active_grant: string;
    active_profile: string;
    aligned: string;
    approve_with: string;
    cli: string;
    commands: string;
    companion_control_unavailable: string;
    current_mode: string;
    effective_mode: string;
    effective_mode_now: string;
    expected_base_profile: string;
    hidden_by_default: string;
    mode_escalation_unavailable: string;
    no_active_grant_created: string;
    none: string;
    nothing: string;
    outside_mode_baseline: string;
    pending_mode_escalation: string;
    possible_escalations: string;
    product_mode_unavailable: string;
    recommend_restart: string;
    reject_with: string;
    resource_plane_unavailable: string;
    use_doctor_desktop: string;
    visible_surfaces: string;
    workspace_optimizer_unavailable: string;
  };
  guided_fixes: {
    no_pending: string;
  };
  learning: {
    candidate_pending: string;
    memory_consolidated: string;
    nudge_applied: string;
    skill_created: string;
    skill_improved: string;
  };
  learning_loop: {
    badge_workflows: string;
    badge_zero: string;
    header: string;
    nudge_compacted: string;
    nudge_created: string;
    nudge_improved: string;
    nudge_promote: string;
    nudge_reuse: string;
    nudge_review: string;
    nudge_tools: string;
    one_liner: string;
    status_disabled: string;
    status_drafts: string;
    status_enabled: string;
    status_improved: string;
    status_last_trigger: string;
    status_none: string;
    status_promoted: string;
    status_top_tools: string;
  };
  live_smartness: {
    no_selected_provider: string;
    runtime_failure: string;
    runtime_multi_pass: string;
    runtime_multi_token_mismatch: string;
    runtime_probe_pass: string;
    runtime_probe_token_mismatch: string;
    runtime_tool_missing: string;
  };
  llm_roles: {
    force_strong_off: string;
    force_strong_on: string;
    setup_prompt_body: string;
    setup_prompt_reply_hint: string;
    setup_prompt_suggestion: string;
    setup_prompt_surface: string;
    status_header: string;
    unconfigured_strong: string;
  };
  memory_runtime: {
    auto_local_only: string;
    auto_synced: string;
    local_saved: string;
    mem0_saved: string;
  };
  operations: {
    apply_after_approval: string;
    automation_action_completed: string;
    governed_reports: string;
    governed_schedules: string;
    mutation_shortcuts: string;
    next_step: string;
    plan_label: string;
    policy_change: string;
    posture: string;
    trust_plane_adjustment_applied: string;
    trust_plane_blocked: string;
    trust_plane_preview: string;
    trust_plane_title: string;
    trust_plane_updated: string;
  };
  provider: {
    connected: string;
    disconnected: string;
    fallback_activated: string;
    model_switched: string;
  };
  pulse: {
    active_task: string;
    active_task_fallback: string;
    approval_reason: string;
    approvals_pending: string;
    ask_zavorth: string;
    has_pending_approvals: string;
    headline_active_task: string;
    headline_approvals: string;
    headline_learning: string;
    headline_needs_attention: string;
    headline_ready: string;
    high_risk_action_card: string;
    last_activity: string;
    learning_pending: string;
    learning_reason: string;
    learning_up_to_date: string;
    natural_input_reason: string;
    no_pending_approvals: string;
    profile_dev_label: string;
    profile_dev_struct_changes: string;
    profile_dev_struct_plan: string;
    profile_dev_struct_risks: string;
    profile_dev_struct_validation: string;
    profile_dev_summary: string;
    profile_dev_tone: string;
    profile_executive_label: string;
    profile_executive_struct_decision: string;
    profile_executive_struct_evidence: string;
    profile_executive_struct_impact: string;
    profile_executive_struct_risk: string;
    profile_executive_summary: string;
    profile_executive_tone: string;
    profile_label: string;
    profile_mentor_label: string;
    profile_mentor_struct_action: string;
    profile_mentor_struct_understood: string;
    profile_mentor_struct_validate: string;
    profile_mentor_struct_why: string;
    profile_mentor_summary: string;
    profile_mentor_tone: string;
    profile_short_label: string;
    profile_short_struct_next: string;
    profile_short_struct_result: string;
    profile_short_struct_risk: string;
    profile_short_summary: string;
    profile_short_tone: string;
    review_approval: string;
    review_approvals: string;
    review_learning: string;
    sandbox: string;
    trust_risk: string;
    workspace: string;
  };
  receipt: {
    action: string;
    approved_by: string;
    created: string;
    duration: string;
    result: string;
  };
  scheduler: {
    no_tasks: string;
    task_completed: string;
    task_created: string;
    task_failed: string;
    task_paused: string;
    task_removed: string;
    task_resumed: string;
    task_started: string;
  };
  scheduler_runtime: {
    auto_paused: string;
    trigger_failed: string;
  };
  session_node: {
    base_capabilities: string;
    category: string;
    channel_label: string;
    chat_label: string;
    completed_recently: string;
    could_not_dispatch_message: string;
    could_not_open_derived_session: string;
    could_not_queue_invocation: string;
    could_not_read_history: string;
    derived_session_opened: string;
    high: string;
    low: string;
    message_dispatched: string;
    next_step: string;
    no_additional_summary: string;
    no_additional_summary_after_send: string;
    no_capabilities_declared: string;
    no_node_selected_for_history: string;
    no_node_selected_for_queue: string;
    no_pending_invocations: string;
    no_recent_invocations: string;
    node_in_focus: string;
    node_mesh_capabilities: string;
    node_mesh_history: string;
    node_mesh_invocation_queued: string;
    node_mesh_profiles: string;
    node_mesh_queue: string;
    none: string;
    none_registered: string;
    official_spawn_partial: string;
    paired: string;
    pairing_draft_created: string;
    pending_unit: string;
    profile: string;
    queue: string;
    recent: string;
    recent_invocation: string;
    risk: string;
    session_label: string;
    session_plane_unavailable: string;
    suggested_bootstrap: string;
    task_created_label: string;
    transport: string;
    zavorth_node_mesh: string;
  };
  slash: {
    active: string;
    apply: string;
    apply_requested: string;
    candidates: string;
    consensus_failed: string;
    empty: string;
    learn_skill_failed: string;
    learn_skill_usage_title: string;
    materialized: string;
    messages: string;
    next: string;
    preview_truncated: string;
    quarantine: string;
    redacted: string;
    session: string;
    session_export: string;
    session_export_empty: string;
    session_export_failed: string;
    session_model_cleared: string;
    session_model_failed: string;
    session_model_route: string;
    session_model_updated: string;
    source_kind: string;
    status: string;
    subsequent_turns_note: string;
    usage: string;
    usage_by_model: string;
    write_full_file: string;
  };
  surface: {
    actions: string;
    approval_pending: string;
    capability_awaiting: string;
    error_ai_gateway: string;
    error_bridge_mobile: string;
    error_channel_flow: string;
    error_channel_mesh: string;
    error_codex_remote: string;
    error_companion_plane: string;
    error_desktop_plane: string;
    error_hub_action: string;
    error_layered_memory: string;
    error_learning_plane: string;
    error_memory_plane: string;
    error_mode_escalation: string;
    error_plugin_flow: string;
    error_plugin_plane: string;
    error_product_mode: string;
    error_remote_plane: string;
    error_selfmod: string;
    error_session_plane: string;
    error_tenant_action: string;
    error_transport_flow: string;
    error_workflow: string;
    error_workspace_optimizer: string;
    no_recent_workflow: string;
    permission_not_found: string;
    status_pending: string;
    status_ready: string;
  };
  swarm: {
    synthesis_completed: string;
    synthesis_started: string;
    task_assigned: string;
    task_completed: string;
    task_failed: string;
  };
  swarm_runtime: {
    batch_failed: string;
  };
  voice: {
    listening: string;
    processing: string;
    transcription: string;
    tts_generated: string;
    tts_generating: string;
  };
}

export interface LegacyTelegramTranslations {
  auth: {
    access_restricted: string;
    host_readonly: string;
    unauthorized_group_admin: string;
    unauthorized_sarcasm_1: string;
    unauthorized_sarcasm_2: string;
    unauthorized_sarcasm_3: string;
  };
  error: {
    broadcast_failed: string;
    dm_failed: string;
    startup_timeout: string;
    zavorthControl_failed: string;
  };
  inspection: {
    no_logs: string;
  };
  media: {
    audio_connectivity_en: string;
    audio_connectivity_es: string;
    audio_connectivity_pt: string;
    audio_inconsistent_en: string;
    audio_inconsistent_es: string;
    audio_inconsistent_pt: string;
    audio_processing_capability: string;
    audio_transcription_failed: string;
    document_no_text: string;
    document_prefix: string;
    document_reading_capability: string;
    document_reading_failed: string;
    document_truncated: string;
    image_attached: string;
    image_attached_prompt: string;
    path_not_returned: string;
    pdf_reader_missing: string;
    photo_analysis_failed: string;
    safety_detail_en: string;
    safety_detail_es: string;
    safety_detail_pt: string;
    transcription_unavailable: string;
    transcription_unavailable_detail: string;
    transcription_unavailable_fallback: string;
    unknown_error: string;
    unsupported_format: string;
    video_processing_capability: string;
    video_processing_failed: string;
  };
  mode: {
    operator_activated: string;
    operator_deactivated: string;
    operator_preparing: string;
    operator_resuming: string;
    operator_status_active: string;
    operator_status_inactive: string;
    presentation_activated: string;
    presentation_deactivated: string;
    presentation_status_active: string;
    presentation_status_inactive: string;
  };
  model: {
    fallback_off: string;
    fallback_on: string;
    role_usage: string;
    setup_applied: string;
    setup_cancelled: string;
    setup_confirm_nearest: string;
    setup_deferred: string;
    setup_failed: string;
    setup_prompt: string;
    setup_unclear: string;
    status_background: string;
    status_default: string;
    status_fallback: string;
    status_header: string;
    status_help: string;
    status_strong: string;
    strong_cleared: string;
    strong_turn_off: string;
    strong_turn_on: string;
    strong_unconfigured: string;
    switched_model: string;
    switched_provider: string;
    unrecognized: string;
  };
  output: {
    audio_sent: string;
    no_audio_method: string;
    tts_fallback: string;
  };
  pipeline: {
    close_help: string;
    missing_close_id: string;
    missing_objective: string;
    missing_stage: string;
    missing_step: string;
    missing_workflow_id: string;
    missing_workflow_id_resume: string;
    missing_workflow_objective: string;
    unknown_workflow: string;
    unknown_workflow_short: string;
    workflow_usage: string;
  };
  scheduler: {
    create_failed: string;
    id_required: string;
    invalid_format: string;
    removal: string;
    report_blocked: string;
    report_format: string;
    report_scheduled: string;
    report_usage: string;
    starting: string;
    task_list: string;
    task_list_empty: string;
    task_scheduled: string;
    usage: string;
  };
  security: {
    cleanup_error: string;
    clear_deleting: string;
    clear_empty: string;
    clear_error: string;
    deep_clean_started: string;
    host_unavailable: string;
    lock_error: string;
    lock_password_min: string;
    lock_success: string;
    locked: string;
    no_tracked_messages: string;
    not_locked: string;
    password_required: string;
    password_set: string;
    unlock_error: string;
    unlock_usage: string;
    unlocked: string;
    wrong_password: string;
  };
  selfmod: {
    build_mode_required: string;
    owner_required: string;
    private_only: string;
  };
  task: {
    file_not_found: string;
    operator_mode_redirect: string;
    unknown_command: string;
  };
  video: {
    description_fallback: string;
    description_fallback_full: string;
    gemini_skipped_long: string;
    no_subtitle: string;
    no_textual_content: string;
    no_transcript: string;
    no_transcript_or_inline: string;
    no_youtube_id: string;
    size_exceeded: string;
    transcription_failed: string;
  };
  wsl: {
    access_error: string;
    default_marker: string;
    shutting_down: string;
    starting: string;
    starting_distro: string;
    usage: string;
  };
  ytdlp: {
    captions_unavailable: string;
    ffmpeg_warning: string;
    no_audio_file: string;
    provision_warning: string;
    unavailable: string;
  };
  zavorthControl: {
    failed_to_start: string;
    public_url: string;
    remote_bridge: string;
    warnings: string;
  };
}

export interface LegacyTrustLoopTranslations {
  absorb: {
    quarantine: string;
    riskReport: string;
    title: string;
  };
  approval: {
    approved: string;
    decide: string;
    pending: string;
    rejected: string;
    title: string;
  };
  changePreview: {
    limited: string;
    title: string;
    unavailable: string;
  };
  honesty: {
    blocked: string;
    catalogOnly: string;
    live: string;
    needsSetup: string;
  };
  memoryPrivacy: {
    candidates: string;
    empty: string;
    forget: string;
    origin: string;
    title: string;
    why: string;
  };
  migration: {
    profile: string;
    title: string;
  };
  proof: {
    description: string;
    empty: string;
    ledger: string;
    title: string;
  };
  riskBudget: {
    autopilot: string;
    chipLabel: string;
    observer: string;
    operator: string;
    title: string;
  };
}

export interface LegacyZavorthControlTranslations {
  approvals: {
    approved: string;
    no_pending: string;
    pending: string;
    rejected: string;
    title: string;
  };
  channels: {
    active: string;
    add: string;
    configure: string;
    disconnect: string;
    inactive: string;
    title: string;
  };
  chat: {
    clear: string;
    export: string;
    no_messages: string;
    placeholder: string;
    send: string;
    thinking: string;
    title: string;
  };
  home: {
    quick_actions: string;
    recent_activity: string;
    status: string;
    title: string;
    welcome: string;
  };
  nav: {
    approvals: string;
    channels: string;
    chat: string;
    help: string;
    home: string;
    logs: string;
    memory: string;
    providers: string;
    settings: string;
    skills: string;
  };
  providers: {
    add: string;
    configure: string;
    connected: string;
    disconnected: string;
    remove: string;
    test_connection: string;
    testing: string;
    title: string;
  };
  settings: {
    appearance: string;
    general: string;
    language: string;
    save: string;
    saved: string;
    security: string;
    title: string;
  };
  skills: {
    available: string;
    configure: string;
    install: string;
    installed: string;
    marketplace: string;
    title: string;
    uninstall: string;
  };
}

export interface LocalizationCatalogLegacy {
  cli: LegacyCliTranslations;
  common: LegacyCommonTranslations;
  dashboard: LegacyDashboardTranslations;
  desktop: LegacyDesktopTranslations;
  errors: LegacyErrorsTranslations;
  onboarding: LegacyOnboardingTranslations;
  quickstart: LegacyQuickstartTranslations;
  services: LegacyServicesTranslations;
  telegram: LegacyTelegramTranslations;
  'trust-loop': LegacyTrustLoopTranslations;
  zavorthControl: LegacyZavorthControlTranslations;
}

export interface PluginTipTranslations {
  tip: {
    add_manifest: string;
    bind_all_capabilities: string;
    bind_capability: string;
    clear_block: string;
    declare_capabilities: string;
    declare_capability: string;
    enable_plugin: string;
    entrypoint_module: string;
    export_function: string;
    export_register: string;
    fast_register: string;
    install_enable: string;
  };
}

/** Partial view for locale catalogs whose migrated coverage is incomplete. */
export type DeepPartialTranslations<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartialTranslations<T[K]>;
};

export type LegacyCatalogSection = DeepPartialTranslations<LocalizationCatalogLegacy>;
export type PluginTipsSection = DeepPartialTranslations<PluginTipTranslations>;
export type ChannelApprovalSection = DeepPartialTranslations<ChannelApprovalTranslations>;

// ==== Migrated AI-gateway catalog contracts (generated by scripts/sync-gateway-i18n-catalogs.mjs) ====

/**
 * Recursive string tree mirroring the next-intl message JSON shape served at
 * src/ai-gateway/i18n/messages.
 */
export type LocalizedMessageTree = string | { [key: string]: LocalizedMessageTree };

/** Per-locale gateway message namespace tree seeded into localization catalogs. */
export interface GatewayCatalogSection {
  [namespace: string]: LocalizedMessageTree;
}
