import { Card } from "@/shared/components";
import { METHOD_COLORS } from "./apiEndpointsConfig";
import type { CatalogData, Endpoint, TryItResult } from "./apiEndpointsTypes";

interface ApiCatalogPanelProps {
  catalog: CatalogData;
  allTags: string[];
  search: string;
  onSearchChange: (value: string) => void;
  selectedTag: string | null;
  onSelectedTagChange: (tag: string | null) => void;
  groupedEndpoints: Record<string, Endpoint[]>;
  filteredEndpoints: Endpoint[];
  expandedEndpoint: string | null;
  onExpandedEndpointChange: (key: string | null) => void;
  tryingEndpoint: string | null;
  tryBody: string;
  onTryBodyChange: (value: string) => void;
  tryResult: TryItResult | null;
  trying: boolean;
  onTryIt: (endpoint: Endpoint) => void;
  onExecuteTryIt: (endpoint: Endpoint) => void;
}

export function ApiCatalogPanel({
  catalog,
  allTags,
  search,
  onSearchChange,
  selectedTag,
  onSelectedTagChange,
  groupedEndpoints,
  filteredEndpoints,
  expandedEndpoint,
  onExpandedEndpointChange,
  tryingEndpoint,
  tryBody,
  onTryBodyChange,
  tryResult,
  trying,
  onTryIt,
  onExecuteTryIt,
}: ApiCatalogPanelProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined text-[16px] text-text-muted absolute left-3 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-black/10 dark:border-white/10
                       bg-white dark:bg-black/20 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => onSelectedTagChange(null)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors
              ${
                !selectedTag
                  ? "bg-primary/10 text-primary"
                  : "bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main"
              }`}
          >
            All
          </button>
          {allTags.slice(0, 8).map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectedTagChange(selectedTag === tag ? null : tag)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors
                ${
                  selectedTag === tag
                    ? "bg-primary/10 text-primary"
                    : "bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main"
                }`}
            >
              {tag}
            </button>
          ))}
          {allTags.length > 8 && (
            <span className="px-2 py-1 text-[10px] text-text-muted">
              +{allTags.length - 8} more
            </span>
          )}
        </div>
      </div>

      {Object.entries(groupedEndpoints).map(([tag, endpoints]) => (
        <Card key={tag} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/5">
            <span className="material-symbols-outlined text-[14px] text-primary">folder</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{tag}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-text-muted">
              {endpoints.length}
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </div>
          <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
            {endpoints.map((ep) => {
              const key = `${ep.method}:${ep.path}`;
              const isExpanded = expandedEndpoint === key;
              const isTrying = tryingEndpoint === key;

              return (
                <div key={key}>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]
                               cursor-pointer transition-colors"
                    onClick={() => onExpandedEndpointChange(isExpanded ? null : key)}
                  >
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border min-w-[42px] text-center font-mono
                        ${METHOD_COLORS[ep.method] || "bg-gray-500/15 text-gray-500"}`}
                    >
                      {ep.method}
                    </span>
                    <code className="text-xs font-mono text-text-main flex-1 truncate">{ep.path}</code>
                    <span className="text-[11px] text-text-muted hidden sm:inline truncate max-w-[200px]">
                      {ep.summary}
                    </span>
                    {ep.security && (
                      <span
                        className="material-symbols-outlined text-[12px] text-amber-500"
                        title="Requires auth"
                      >
                        lock
                      </span>
                    )}
                    <span
                      className={`material-symbols-outlined text-[14px] text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      expand_more
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-3 bg-black/[0.01] dark:bg-white/[0.01]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-text-main font-medium">{ep.summary}</p>
                          {ep.description && ep.description !== ep.summary && (
                            <p className="text-[11px] text-text-muted mt-1">{ep.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
                            {ep.security && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] text-amber-500">
                                  lock
                                </span>
                                Bearer Auth
                              </span>
                            )}
                            {ep.requestBody && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">
                                  description
                                </span>
                                Request Body
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              Responses: {ep.responses.join(", ")}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTryIt(ep);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-lg
                                     transition-colors shrink-0
                            ${
                              isTrying
                                ? "bg-primary text-white"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {isTrying ? "close" : "play_arrow"}
                          </span>
                          {isTrying ? "Close" : "Try It"}
                        </button>
                      </div>

                      <div className="rounded-lg bg-black/5 dark:bg-black/30 p-3">
                        <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                          Example
                        </p>
                        <code className="text-[11px] font-mono text-text-main break-all">
                          curl -X {ep.method} http://localhost:20128{ep.path.replace("/api/", "/")}
                          {ep.security ? ' -H "Authorization: Bearer YOUR_KEY"' : ""}
                          {ep.requestBody
                            ? " -H \"Content-Type: application/json\" -d '{...}'"
                            : ""}
                        </code>
                      </div>

                      {isTrying && (
                        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 space-y-3">
                          {ep.method !== "GET" && (
                            <div>
                              <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">
                                Request Body (JSON)
                              </label>
                              <textarea
                                value={tryBody}
                                onChange={(e) => onTryBodyChange(e.target.value)}
                                rows={4}
                                className="w-full mt-1 px-3 py-2 text-xs font-mono rounded-lg border border-black/10
                                         dark:border-white/10 bg-white dark:bg-black/30 focus:outline-none
                                         focus:ring-1 focus:ring-primary resize-none"
                                placeholder='{ "model": "gpt-4o", "messages": [...] }'
                              />
                            </div>
                          )}
                          <button
                            onClick={() => onExecuteTryIt(ep)}
                            disabled={trying}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                                       bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {trying ? "hourglass_empty" : "send"}
                            </span>
                            {trying ? "Sending..." : "Send Request"}
                          </button>

                          {tryResult && (
                            <div className="rounded-lg bg-black/5 dark:bg-black/30 p-3 space-y-2">
                              <div className="flex items-center gap-3 text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    tryResult.status >= 200 && tryResult.status < 300
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : tryResult.status >= 400
                                        ? "bg-red-500/15 text-red-500"
                                        : "bg-amber-500/15 text-amber-500"
                                  }`}
                                >
                                  {tryResult.status} {tryResult.statusText}
                                </span>
                                <span className="text-text-muted">{tryResult.latencyMs}ms</span>
                              </div>
                              <pre className="text-[11px] font-mono text-text-main overflow-auto max-h-[300px] whitespace-pre-wrap">
                                {typeof tryResult.body === "string"
                                  ? tryResult.body
                                  : JSON.stringify(tryResult.body, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {filteredEndpoints.length === 0 && (
        <Card className="p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-text-muted">search_off</span>
          <p className="text-sm text-text-muted mt-2">No endpoints match your filter</p>
        </Card>
      )}

      {catalog.schemas.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[14px] text-primary">data_object</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Data Schemas
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-text-muted">
              {catalog.schemas.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {catalog.schemas.map((schema) => (
              <span
                key={schema}
                className="text-[10px] px-2 py-1 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-300 font-mono"
              >
                {schema}
              </span>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
