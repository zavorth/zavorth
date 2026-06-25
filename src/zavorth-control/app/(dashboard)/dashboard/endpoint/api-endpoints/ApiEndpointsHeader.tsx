import { Card } from "@/shared/components";
import type { CatalogData } from "./apiEndpointsTypes";

interface ApiEndpointsHeaderProps {
  catalog: CatalogData;
  tagCount: number;
}

export function ApiEndpointsHeader({ catalog, tagCount }: ApiEndpointsHeaderProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
            <span className="material-symbols-outlined text-primary text-[20px]">api</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{catalog.info.title || "API"}</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold">
                {catalog.info.version}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {catalog.endpoints.length} endpoints across {tagCount} categories
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/docs/openapi.yaml"
            download
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
                       bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">download</span>
            YAML
          </a>
          <a
            href="/api/openapi/spec"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg
                       bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            JSON
          </a>
        </div>
      </div>
    </Card>
  );
}
