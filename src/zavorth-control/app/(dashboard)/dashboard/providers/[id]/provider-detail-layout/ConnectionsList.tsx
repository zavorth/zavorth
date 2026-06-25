"use client";

import { pickMaskedDisplayValue } from "@/shared/utils/maskEmail";
import { ConnectionRow as ProviderConnectionRow } from "../provider-detail-connection-row";
import { groupConnectionsByTag, sortConnections } from "./helpers";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type ConnectionsListProps = Pick<
  ProviderDetailPageModel,
  | "connections"
  | "providerId"
  | "handleSwapPriority"
  | "handleUpdateConnectionStatus"
  | "handleToggleRateLimit"
  | "handleToggleCodexLimit"
  | "handleRetestConnection"
  | "retestingId"
  | "setSelectedConnection"
  | "setShowEditModal"
  | "handleDelete"
  | "setShowOAuthModal"
  | "handleRefreshToken"
  | "refreshingId"
  | "handleApplyCodexAuthLocal"
  | "applyingCodexAuthId"
  | "handleExportCodexAuthFile"
  | "exportingCodexAuthId"
  | "setProxyTarget"
  | "connProxyMap"
>;

export function ProviderDetailConnectionsList({
  connections,
  providerId,
  handleSwapPriority,
  handleUpdateConnectionStatus,
  handleToggleRateLimit,
  handleToggleCodexLimit,
  handleRetestConnection,
  retestingId,
  setSelectedConnection,
  setShowEditModal,
  handleDelete,
  setShowOAuthModal,
  handleRefreshToken,
  refreshingId,
  handleApplyCodexAuthLocal,
  applyingCodexAuthId,
  handleExportCodexAuthFile,
  exportingCodexAuthId,
  setProxyTarget,
  connProxyMap,
}: ConnectionsListProps) {
  const sortedConnections = sortConnections(connections);
  const { hasAnyTag, groupKeys, groupMap } = groupConnectionsByTag(sortedConnections);
  const sortedIndexById = new Map(
    sortedConnections.map((connection, index) => [connection.id, index]),
  );

  const renderConnectionRow = (
    connection: (typeof sortedConnections)[number],
    position: {
      isFirst: boolean;
      isLast: boolean;
    },
  ) => {
    const sortedIndex = sortedIndexById.get(connection.id) ?? -1;

    return (
      <ProviderConnectionRow
        key={connection.id}
        connection={connection}
        isOAuth={connection.authType === "oauth"}
        isFirst={position.isFirst}
        isLast={position.isLast}
        onMoveUp={() => handleSwapPriority(connection, sortedConnections[sortedIndex - 1])}
        onMoveDown={() => handleSwapPriority(connection, sortedConnections[sortedIndex + 1])}
        onToggleActive={(isActive) => handleUpdateConnectionStatus(connection.id, isActive)}
        onToggleRateLimit={(enabled) => handleToggleRateLimit(connection.id, enabled)}
        isCodex={providerId === "codex"}
        onToggleCodex5h={(enabled) => handleToggleCodexLimit(connection.id, "use5h", enabled)}
        onToggleCodexWeekly={(enabled) =>
          handleToggleCodexLimit(connection.id, "useWeekly", enabled)
        }
        onRetest={() => handleRetestConnection(connection.id)}
        isRetesting={retestingId === connection.id}
        onEdit={() => {
          setSelectedConnection(connection);
          setShowEditModal(true);
        }}
        onDelete={() => handleDelete(connection.id)}
        onReauth={connection.authType === "oauth" ? () => setShowOAuthModal(true) : undefined}
        onRefreshToken={
          connection.authType === "oauth" ? () => handleRefreshToken(connection.id) : undefined
        }
        isRefreshing={refreshingId === connection.id}
        onApplyCodexAuthLocal={
          providerId === "codex" ? () => handleApplyCodexAuthLocal(connection.id) : undefined
        }
        isApplyingCodexAuthLocal={applyingCodexAuthId === connection.id}
        onExportCodexAuthFile={
          providerId === "codex" ? () => handleExportCodexAuthFile(connection.id) : undefined
        }
        isExportingCodexAuthFile={exportingCodexAuthId === connection.id}
        onProxy={() =>
          setProxyTarget({
            level: "key",
            id: connection.id,
            label: pickMaskedDisplayValue([connection.name, connection.email], connection.id),
          })
        }
        hasProxy={!!connProxyMap[connection.id]?.proxy}
        proxySource={connProxyMap[connection.id]?.level || null}
        proxyHost={connProxyMap[connection.id]?.proxy?.host || null}
      />
    );
  };

  if (!hasAnyTag) {
    return (
      <div className="flex flex-col divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {sortedConnections.map((connection, index) =>
          renderConnectionRow(connection, {
            isFirst: index === 0,
            isLast: index === sortedConnections.length - 1,
          }),
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {groupKeys.map((tag, groupIndex) => {
        const groupConnections = groupMap.get(tag)!;

        return (
          <div
            key={tag || "__untagged__"}
            className={
              groupIndex > 0
                ? "border-t border-black/[0.06] dark:border-white/[0.06] mt-1 pt-1"
                : ""
            }
          >
            {tag && (
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <span className="material-symbols-outlined text-[13px] text-text-muted/50">
                  label
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted/60 select-none">
                  {tag}
                </span>
                <div className="flex-1 h-px bg-black/[0.04] dark:bg-white/[0.04]" />
                <span className="text-[10px] text-text-muted/40">{groupConnections.length}</span>
              </div>
            )}
            <div className="flex flex-col divide-y divide-black/[0.03] dark:divide-white/[0.03]">
              {groupConnections.map((connection, index) =>
                renderConnectionRow(connection, {
                  isFirst: groupIndex === 0 && index === 0,
                  isLast:
                    groupIndex === groupKeys.length - 1 &&
                    index === groupConnections.length - 1,
                }),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
