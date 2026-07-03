export const HIDEABLE_SIDEBAR_ITEM_IDS = [
  "home",
  "endpoints",
  "api-manager",
  "providers",
  "combos",
  "auto-combo",
  "costs",
  "analytics",
  "cache",
  "limits",
  "cli-tools",
  "agents",
  "memory",
  "skills",
  "expressive",
  "translator",
  "playground",
  "media",
  "search-tools",
  "logs",
  "health",
  "audit",
  "settings",
  "docs",
  "issues",
] as const;

export type HideableSidebarItemId = (typeof HIDEABLE_SIDEBAR_ITEM_IDS)[number];
export type SidebarSectionId = "primary" | "cli" | "debug" | "system" | "help";

export interface SidebarItemDefinition {
  id: HideableSidebarItemId;
  href: string;
  i18nKey: string;
  icon: string;
  exact?: boolean;
  external?: boolean;
}

export interface SidebarSectionDefinition {
  id: SidebarSectionId;
  titleKey: string;
  titleFallback: string;
  items: readonly SidebarItemDefinition[];
  showTitleInSidebar?: boolean;
  visibility?: "always" | "debug";
}

const PRIMARY_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "home", href: "/zavorthControl", i18nKey: "home", icon: "home", exact: true },
  { id: "providers", href: "/zavorthControl/providers", i18nKey: "providers", icon: "dns" },
  { id: "skills", href: "/zavorthControl/skills", i18nKey: "skills", icon: "auto_fix_high" },
  { id: "memory", href: "/zavorthControl/memory", i18nKey: "memory", icon: "psychology" },
];

const CLI_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "cli-tools", href: "/zavorthControl/cli-tools", i18nKey: "cliToolsShort", icon: "terminal" },
  { id: "agents", href: "/zavorthControl/agents", i18nKey: "agents", icon: "smart_toy" },
  { id: "expressive" as any, href: "/zavorthControl/expressive", i18nKey: "expressive", icon: "blur_on" },
];

const DEBUG_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "endpoints", href: "/zavorthControl/endpoint", i18nKey: "endpoints", icon: "api" },
  { id: "api-manager", href: "/zavorthControl/api-manager", i18nKey: "apiManager", icon: "vpn_key" },
  { id: "combos", href: "/zavorthControl/combos", i18nKey: "combos", icon: "layers" },
  { id: "auto-combo", href: "/zavorthControl/auto-combo", i18nKey: "autoCombo", icon: "auto_awesome" },
  { id: "costs", href: "/zavorthControl/costs", i18nKey: "costs", icon: "account_balance_wallet" },
  { id: "analytics", href: "/zavorthControl/analytics", i18nKey: "analytics", icon: "analytics" },
  { id: "cache", href: "/zavorthControl/cache", i18nKey: "cache", icon: "cached" },
  { id: "limits", href: "/zavorthControl/limits", i18nKey: "limits", icon: "tune" },
  { id: "media", href: "/zavorthControl/cache/media", i18nKey: "media", icon: "perm_media" },
  { id: "translator", href: "/zavorthControl/translator", i18nKey: "translator", icon: "translate" },
  { id: "playground", href: "/zavorthControl/playground", i18nKey: "playground", icon: "science" },
  {
    id: "search-tools",
    href: "/zavorthControl/search-tools",
    i18nKey: "searchTools",
    icon: "manage_search",
  },
];

const SYSTEM_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "logs", href: "/zavorthControl/logs", i18nKey: "logs", icon: "description" },
  { id: "health", href: "/zavorthControl/health", i18nKey: "health", icon: "health_and_safety" },
  { id: "audit", href: "/zavorthControl/audit", i18nKey: "auditLog", icon: "history" },
  { id: "settings", href: "/zavorthControl/settings", i18nKey: "settings", icon: "settings" },
];

const HELP_SIDEBAR_ITEMS: readonly SidebarItemDefinition[] = [
  { id: "docs", href: "/docs", i18nKey: "docs", icon: "menu_book", external: true },
  {
    id: "issues",
    href: "https://github.com/zavorth-core/ZavorthGateway/issues",
    i18nKey: "issues",
    icon: "bug_report",
    external: true,
  },
];

export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  {
    id: "primary",
    titleKey: "primarySection",
    titleFallback: "Main",
    items: PRIMARY_SIDEBAR_ITEMS,
    showTitleInSidebar: false,
  },
  {
    id: "cli",
    titleKey: "cliSection",
    titleFallback: "CLI",
    items: CLI_SIDEBAR_ITEMS,
  },
  {
    id: "debug",
    titleKey: "debugSection",
    titleFallback: "Debug",
    items: DEBUG_SIDEBAR_ITEMS,
    visibility: "debug",
  },
  {
    id: "system",
    titleKey: "systemSection",
    titleFallback: "System",
    items: SYSTEM_SIDEBAR_ITEMS,
  },
  {
    id: "help",
    titleKey: "helpSection",
    titleFallback: "Help",
    items: HELP_SIDEBAR_ITEMS,
  },
] as const;

export const HIDDEN_SIDEBAR_ITEMS_SETTING_KEY = "hiddenSidebarItems";
export const SIDEBAR_SETTINGS_UPDATED_EVENT = "ZavorthGateway:settings-updated";

export function normalizeHiddenSidebarItems(value: unknown): HideableSidebarItemId[] {
  if (!Array.isArray(value)) return [];

  const hiddenItems = new Set<HideableSidebarItemId>();

  for (const item of value) {
    if (
      typeof item === "string" &&
      HIDEABLE_SIDEBAR_ITEM_IDS.includes(item as HideableSidebarItemId)
    ) {
      hiddenItems.add(item as HideableSidebarItemId);
    }
  }

  return HIDEABLE_SIDEBAR_ITEM_IDS.filter((item) => hiddenItems.has(item));
}
