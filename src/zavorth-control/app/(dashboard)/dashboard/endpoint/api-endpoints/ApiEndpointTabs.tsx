import type { ApiEndpointSection } from "./apiEndpointsTypes";

interface ApiEndpointTabsProps {
  section: ApiEndpointSection;
  onSectionChange: (section: ApiEndpointSection) => void;
}

const TABS = [
  { id: "catalog" as const, label: "API Catalog", icon: "menu_book" },
  { id: "webhooks" as const, label: "Webhooks", icon: "webhook" },
];

export function ApiEndpointTabs({ section, onSectionChange }: ApiEndpointTabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/[0.03] w-fit">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSectionChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
            ${
              section === tab.id
                ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                : "text-text-muted hover:text-text-main"
            }`}
        >
          <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
